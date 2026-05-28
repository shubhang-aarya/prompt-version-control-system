import { z } from "zod";
import db from "../db/connection.js";
import { safeParseJson } from "../utils/json.js";
import { renderPromptTemplate } from "../utils/templateRenderer.js";
import { makeHttpError } from "../utils/http.js";
import { generateTextWithOpenAI, judgeWithOpenAI } from "./openaiService.js";

const judgeResultSchema = z.object({
  score: z.coerce.number().min(1).max(10),
  reasoning: z.string().trim().min(1).transform((value) => value.trim())
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJudgeResult(outputText) {
  let parsedJson = safeParseJson(outputText, null);

  if (!parsedJson) {
    const jsonBlockMatch = outputText.match(/\{[\s\S]*\}/);

    if (jsonBlockMatch) {
      parsedJson = safeParseJson(jsonBlockMatch[0], null);
    }
  }

  if (!parsedJson) {
    throw makeHttpError(502, "Judge response was not valid JSON", {
      rawJudgeOutput: outputText
    });
  }

  const validated = judgeResultSchema.safeParse(parsedJson);

  if (!validated.success) {
    throw makeHttpError(502, "Judge JSON did not match expected schema", {
      validationErrors: validated.error.issues,
      rawJudgeOutput: parsedJson
    });
  }

  return validated.data;
}

function buildJudgePrompt(rubric, response) {
  return `You are an AI evaluator.

Score the following response from 1-10.

Rubric:
${rubric}

Response:
${response}

Return ONLY valid JSON:
{
  "score": number,
  "reasoning": string
}`;
}

function getPromptById(promptId) {
  return db
    .prepare("SELECT id, name FROM prompts WHERE id = ?")
    .get(promptId);
}

function getDatasetById(datasetId) {
  return db
    .prepare(
      `SELECT
        id,
        prompt_id,
        input_json,
        rubric_text,
        expected_behavior,
        created_at
      FROM datasets
      WHERE id = ?`
    )
    .get(datasetId);
}

function getPromptVersionByNumber(promptId, versionNumber) {
  return db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        is_production
      FROM prompt_versions
      WHERE prompt_id = ?
        AND version_number = ?`
    )
    .get(promptId, versionNumber);
}

function getProductionPromptVersion(promptId) {
  return db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        is_production
      FROM prompt_versions
      WHERE prompt_id = ?
        AND is_production = 1
      LIMIT 1`
    )
    .get(promptId);
}

function getLatestEvaluationScoresByDataset(versionId) {
  return db
    .prepare(
      `SELECT
        e.dataset_id,
        e.judge_score
      FROM evaluations e
      INNER JOIN (
        SELECT dataset_id, MAX(id) AS latest_evaluation_id
        FROM evaluations
        WHERE version_id = ?
        GROUP BY dataset_id
      ) latest
        ON latest.latest_evaluation_id = e.id`
    )
    .all(versionId);
}

function calculateAverage(numbers) {
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return total / numbers.length;
}

function roundScore(value) {
  return Number(value.toFixed(4));
}

function mapEvaluationRow(row) {
  return {
    id: row.id,
    generatedOutput: row.generated_output,
    judgeScore: row.judge_score,
    judgeReasoning: row.judge_reasoning,
    createdAt: row.created_at,
    prompt: {
      id: row.prompt_id,
      name: row.prompt_name
    },
    version: {
      id: row.version_id,
      versionNumber: row.version_number,
      isProduction: row.is_production === 1
    },
    dataset: {
      id: row.dataset_id,
      inputVariables: safeParseJson(row.input_json, {}),
      rubric: row.rubric_text
    }
  };
}

function storeEvaluation({
  versionId,
  datasetId,
  generatedOutput,
  judgeScore,
  judgeReasoning
}) {
  const insertResult = db
    .prepare(
      `INSERT INTO evaluations (
        version_id,
        dataset_id,
        generated_output,
        judge_score,
        judge_reasoning
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(versionId, datasetId, generatedOutput, judgeScore, judgeReasoning);

  return db
    .prepare(
      `SELECT
        id,
        version_id,
        dataset_id,
        generated_output,
        judge_score,
        judge_reasoning,
        created_at
      FROM evaluations
      WHERE id = ?`
    )
    .get(insertResult.lastInsertRowid);
}

export async function runEvaluation({
  promptId,
  datasetId,
  versionNumber,
  generationModel,
  judgeModel
}) {
  const prompt = getPromptById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const dataset = getDatasetById(datasetId);

  if (!dataset) {
    throw makeHttpError(404, "Dataset not found");
  }

  if (dataset.prompt_id !== promptId) {
    throw makeHttpError(400, "Dataset does not belong to the provided prompt");
  }

  const versionRow =
    versionNumber !== undefined
      ? getPromptVersionByNumber(promptId, versionNumber)
      : getProductionPromptVersion(promptId);

  if (!versionRow) {
    if (versionNumber !== undefined) {
      throw makeHttpError(
        404,
        `Prompt version ${versionNumber} was not found for prompt ${promptId}`
      );
    }

    throw makeHttpError(409, "Prompt has no production version");
  }

  const datasetVariables = safeParseJson(dataset.input_json, null);

  if (!isPlainObject(datasetVariables)) {
    throw makeHttpError(500, "Dataset input_json is not a valid object");
  }

  const renderedPrompt = renderPromptTemplate(versionRow.template_text, datasetVariables);

  const generation = await generateTextWithOpenAI({
    promptText: renderedPrompt,
    model: generationModel
  });

  const rubricForJudge = dataset.expected_behavior
    ? `${dataset.rubric_text}\n\nExpected behavior notes:\n${dataset.expected_behavior}`
    : dataset.rubric_text;

  const judgePrompt = buildJudgePrompt(rubricForJudge, generation.outputText);

  const judgeResponse = await judgeWithOpenAI({
    judgePrompt,
    model: judgeModel
  });

  const judgeResult = parseJudgeResult(judgeResponse.outputText);

  const storedEvaluation = storeEvaluation({
    versionId: versionRow.id,
    datasetId,
    generatedOutput: generation.outputText,
    judgeScore: judgeResult.score,
    judgeReasoning: judgeResult.reasoning
  });

  return {
    evaluation: {
      id: storedEvaluation.id,
      versionId: storedEvaluation.version_id,
      datasetId: storedEvaluation.dataset_id,
      generatedOutput: storedEvaluation.generated_output,
      judgeScore: storedEvaluation.judge_score,
      judgeReasoning: storedEvaluation.judge_reasoning,
      createdAt: storedEvaluation.created_at
    },
    prompt: {
      id: prompt.id,
      name: prompt.name
    },
    version: {
      id: versionRow.id,
      versionNumber: versionRow.version_number,
      isProduction: versionRow.is_production === 1
    },
    dataset: {
      id: dataset.id
    },
    execution: {
      renderedPrompt,
      generationModel: generation.model,
      generationResponseId: generation.responseId,
      judgeModel: judgeResponse.model,
      judgeResponseId: judgeResponse.responseId
    }
  };
}

export function listEvaluations({ promptId } = {}) {
  const filters = [];
  const params = [];

  if (promptId) {
    filters.push("p.id = ?");
    params.push(promptId);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT
        e.id,
        e.version_id,
        e.dataset_id,
        e.generated_output,
        e.judge_score,
        e.judge_reasoning,
        e.created_at,
        p.id AS prompt_id,
        p.name AS prompt_name,
        pv.version_number,
        pv.is_production,
        d.input_json,
        d.rubric_text
      FROM evaluations e
      JOIN prompt_versions pv ON pv.id = e.version_id
      JOIN prompts p ON p.id = pv.prompt_id
      JOIN datasets d ON d.id = e.dataset_id
      ${whereClause}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 100`
    )
    .all(...params);

  return {
    evaluations: rows.map(mapEvaluationRow)
  };
}

export function compareCandidateWithProduction({
  promptId,
  candidateVersionNumber
}) {
  const prompt = getPromptById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const candidateVersion = getPromptVersionByNumber(promptId, candidateVersionNumber);

  if (!candidateVersion) {
    throw makeHttpError(
      404,
      `Prompt version ${candidateVersionNumber} was not found for prompt ${promptId}`
    );
  }

  const productionVersion = getProductionPromptVersion(promptId);

  if (!productionVersion) {
    throw makeHttpError(409, "Prompt has no production version");
  }

  const candidateRows = getLatestEvaluationScoresByDataset(candidateVersion.id);
  const productionRows = getLatestEvaluationScoresByDataset(productionVersion.id);

  if (candidateRows.length === 0) {
    throw makeHttpError(
      409,
      "Candidate version has no evaluation results. Run /evaluations/run first."
    );
  }

  if (productionRows.length === 0) {
    throw makeHttpError(
      409,
      "Production version has no evaluation results. Run /evaluations/run first."
    );
  }

  const candidateScoreMap = new Map(
    candidateRows.map((row) => [row.dataset_id, row.judge_score])
  );
  const productionScoreMap = new Map(
    productionRows.map((row) => [row.dataset_id, row.judge_score])
  );
  const sharedDatasetIds = candidateRows
    .map((row) => row.dataset_id)
    .filter((datasetId) => productionScoreMap.has(datasetId));

  if (sharedDatasetIds.length === 0) {
    throw makeHttpError(
      409,
      "Candidate and production versions do not share evaluated datasets."
    );
  }

  const candidateScores = sharedDatasetIds.map((datasetId) =>
    candidateScoreMap.get(datasetId)
  );
  const productionScores = sharedDatasetIds.map((datasetId) =>
    productionScoreMap.get(datasetId)
  );

  const candidateAverage = calculateAverage(candidateScores);
  const productionAverage = calculateAverage(productionScores);

  return {
    candidateScore: roundScore(candidateAverage),
    productionScore: roundScore(productionAverage),
    regression: candidateAverage < productionAverage,
    sharedDatasetCount: sharedDatasetIds.length
  };
}
