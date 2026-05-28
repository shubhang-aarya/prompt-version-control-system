import db from "../db/connection.js";
import { safeParseJson } from "../utils/json.js";
import { makeHttpError } from "../utils/http.js";

function getPromptById(promptId) {
  return db
    .prepare("SELECT id, name, created_at FROM prompts WHERE id = ?")
    .get(promptId);
}

function mapDatasetRow(row) {
  return {
    id: row.id,
    promptId: row.prompt_id,
    inputVariables: safeParseJson(row.input_json, {}),
    rubric: row.rubric_text,
    expectedBehaviorNotes: row.expected_behavior,
    createdAt: row.created_at
  };
}

export function createDataset({
  promptId,
  inputVariables,
  rubric,
  expectedBehaviorNotes
}) {
  const prompt = getPromptById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const insertResult = db
    .prepare(
      `INSERT INTO datasets (
        prompt_id,
        input_json,
        rubric_text,
        expected_behavior
      ) VALUES (?, ?, ?, ?)`
    )
    .run(
      promptId,
      JSON.stringify(inputVariables),
      rubric,
      expectedBehaviorNotes
    );

  const createdDataset = db
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
    .get(insertResult.lastInsertRowid);

  return mapDatasetRow(createdDataset);
}

export function listPromptDatasets(promptId) {
  const prompt = getPromptById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const rows = db
    .prepare(
      `SELECT
        id,
        prompt_id,
        input_json,
        rubric_text,
        expected_behavior,
        created_at
      FROM datasets
      WHERE prompt_id = ?
      ORDER BY created_at DESC, id DESC`
    )
    .all(promptId);

  return {
    prompt: {
      id: prompt.id,
      name: prompt.name,
      createdAt: prompt.created_at
    },
    datasets: rows.map(mapDatasetRow)
  };
}
