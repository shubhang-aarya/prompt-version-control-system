import db from "../db/connection.js";
import { safeParseJson } from "../utils/json.js";
import { diffText } from "../utils/diff.js";
import { makeHttpError } from "../utils/http.js";
import { renderPromptTemplate } from "../utils/templateRenderer.js";
import { generateTextWithOpenAI } from "./openaiService.js";

function getPromptRowById(promptId) {
  return db.prepare("SELECT id, name, created_at FROM prompts WHERE id = ?").get(promptId);
}

function getPromptRowByName(name) {
  return db.prepare("SELECT id, name, created_at FROM prompts WHERE name = ?").get(name);
}

function getPromptWithProductionInfo(promptId) {
  return db
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.created_at,
        pv.id AS production_version_id,
        pv.version_number AS production_version_number,
        pv.created_at AS production_promoted_at
      FROM prompts p
      LEFT JOIN prompt_versions pv
        ON pv.prompt_id = p.id
        AND pv.is_production = 1
      WHERE p.id = ?`
    )
    .get(promptId);
}

function getProductionVersionByPromptId(promptId) {
  return db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production,
        created_at
      FROM prompt_versions
      WHERE prompt_id = ?
        AND is_production = 1
      LIMIT 1`
    )
    .get(promptId);
}

function getPromptVersionByNumber(promptId, versionNumber) {
  return db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production,
        created_at
      FROM prompt_versions
      WHERE prompt_id = ?
        AND version_number = ?`
    )
    .get(promptId, versionNumber);
}

function getPromptVersionById(promptId, versionId) {
  return db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production,
        created_at
      FROM prompt_versions
      WHERE prompt_id = ?
        AND id = ?`
    )
    .get(promptId, versionId);
}

function getLatestPromptVersion(promptId) {
  return db
    .prepare(
      `SELECT
        id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production,
        created_at
      FROM prompt_versions
      WHERE prompt_id = ?
      ORDER BY version_number DESC
      LIMIT 1`
    )
    .get(promptId);
}

function mapPromptSummary(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    productionVersion: row.production_version_id
      ? {
          id: row.production_version_id,
          versionNumber: row.production_version_number,
          promotedAt: row.production_promoted_at
        }
      : null
  };
}

function mapPromptVersion(row) {
  return {
    id: row.id,
    promptId: row.prompt_id,
    versionNumber: row.version_number,
    templateText: row.template_text,
    variables: safeParseJson(row.variables_json, {}),
    metadata: safeParseJson(row.metadata_json, {}),
    isProduction: row.is_production === 1,
    createdAt: row.created_at
  };
}

export function listPrompts() {
  const rows = db
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.created_at,
        pv.id AS production_version_id,
        pv.version_number AS production_version_number,
        pv.created_at AS production_promoted_at
      FROM prompts p
      LEFT JOIN prompt_versions pv
        ON pv.prompt_id = p.id
        AND pv.is_production = 1
      ORDER BY p.created_at DESC`
    )
    .all();

  return rows.map(mapPromptSummary);
}

export function getPromptProductionVersionByName(promptName) {
  const prompt = getPromptRowByName(promptName);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const productionVersion = getProductionVersionByPromptId(prompt.id);

  if (!productionVersion) {
    throw makeHttpError(409, "Prompt has no production version");
  }

  return {
    prompt: {
      id: prompt.id,
      name: prompt.name,
      createdAt: prompt.created_at
    },
    productionVersion: mapPromptVersion(productionVersion)
  };
}

export function getPromptById(promptId) {
  const row = getPromptWithProductionInfo(promptId);

  if (!row) {
    return null;
  }

  return mapPromptSummary(row);
}

export function listPromptVersions(promptId) {
  const prompt = getPromptRowById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const rows = db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production,
        created_at
      FROM prompt_versions
      WHERE prompt_id = ?
      ORDER BY version_number DESC`
    )
    .all(promptId);

  return {
    prompt: {
      id: prompt.id,
      name: prompt.name,
      createdAt: prompt.created_at
    },
    versions: rows.map(mapPromptVersion)
  };
}

export function createPrompt({ name, templateText, variables = {}, metadata = {} }) {
  const createPromptTx = db.transaction(() => {
    const insertPrompt = db.prepare("INSERT INTO prompts (name) VALUES (?)").run(name);

    db
      .prepare(
        `INSERT INTO prompt_versions (
          prompt_id,
          version_number,
          template_text,
          variables_json,
          metadata_json,
          is_production
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        insertPrompt.lastInsertRowid,
        1,
        templateText,
        JSON.stringify(variables),
        JSON.stringify(metadata),
        1
      );

    return Number(insertPrompt.lastInsertRowid);
  });

  let promptId;

  try {
    promptId = createPromptTx();
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed: prompts.name")) {
      throw makeHttpError(409, "Prompt name already exists");
    }

    throw error;
  }

  return getPromptById(promptId);
}

export function createPromptVersion(promptId, payload) {
  const prompt = getPromptRowById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const latestVersion = getLatestPromptVersion(promptId);

  if (!latestVersion) {
    throw makeHttpError(500, "Prompt has no base version");
  }

  const nextVersionNumber = latestVersion.version_number + 1;
  const templateText = payload.templateText ?? latestVersion.template_text;
  const variablesJson = payload.variables
    ? JSON.stringify(payload.variables)
    : latestVersion.variables_json;
  const metadataJson = payload.metadata
    ? JSON.stringify(payload.metadata)
    : latestVersion.metadata_json;

  const insertResult = db
    .prepare(
      `INSERT INTO prompt_versions (
        prompt_id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(promptId, nextVersionNumber, templateText, variablesJson, metadataJson, 0);

  const createdVersion = db
    .prepare(
      `SELECT
        id,
        prompt_id,
        version_number,
        template_text,
        variables_json,
        metadata_json,
        is_production,
        created_at
      FROM prompt_versions
      WHERE id = ?`
    )
    .get(insertResult.lastInsertRowid);

  return mapPromptVersion(createdVersion);
}

export function getPromptVersionDiff(promptId, version1Number, version2Number) {
  const prompt = getPromptRowById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  if (version1Number === version2Number) {
    return { added: [], removed: [] };
  }

  const version1 = getPromptVersionByNumber(promptId, version1Number);
  const version2 = getPromptVersionByNumber(promptId, version2Number);

  if (!version1) {
    throw makeHttpError(
      404,
      `Version ${version1Number} was not found for prompt ${promptId}`
    );
  }

  if (!version2) {
    throw makeHttpError(
      404,
      `Version ${version2Number} was not found for prompt ${promptId}`
    );
  }

  return diffText(version1.template_text, version2.template_text);
}

function switchProductionVersion(promptId, targetVersionId, operation) {
  const prompt = getPromptRowById(promptId);

  if (!prompt) {
    throw makeHttpError(404, "Prompt not found");
  }

  const targetVersion = getPromptVersionById(promptId, targetVersionId);

  if (!targetVersion) {
    throw makeHttpError(
      404,
      `Version ${targetVersionId} was not found for prompt ${promptId}`
    );
  }

  const previousProduction = getProductionVersionByPromptId(promptId);

  const setProductionTx = db.transaction(() => {
    db
      .prepare(
        `UPDATE prompt_versions
         SET is_production = 0
         WHERE prompt_id = ?
           AND is_production = 1
           AND id != ?`
      )
      .run(promptId, targetVersionId);

    db
      .prepare(
        `UPDATE prompt_versions
         SET is_production = 1
         WHERE prompt_id = ?
           AND id = ?`
      )
      .run(promptId, targetVersionId);
  });

  setProductionTx();

  const currentProduction = getProductionVersionByPromptId(promptId);

  return {
    prompt: {
      id: prompt.id,
      name: prompt.name
    },
    operation,
    previousProductionVersionId: previousProduction ? previousProduction.id : null,
    productionVersion: mapPromptVersion(currentProduction)
  };
}

export function promotePromptVersion(promptId, versionId) {
  return switchProductionVersion(promptId, versionId, "promote");
}

export function rollbackPromptVersion(promptId, versionId) {
  return switchProductionVersion(promptId, versionId, "rollback");
}

export async function runProductionPrompt(promptName, variables = {}) {
  const { prompt, productionVersion } = getPromptProductionVersionByName(promptName);
  const renderedPrompt = renderPromptTemplate(
    productionVersion.templateText,
    variables
  );
  const completion = await generateTextWithOpenAI({ promptText: renderedPrompt });

  return {
    prompt: {
      id: prompt.id,
      name: prompt.name
    },
    productionVersion: {
      id: productionVersion.id,
      versionNumber: productionVersion.versionNumber
    },
    renderedPrompt,
    output: completion.outputText,
    model: completion.model,
    responseId: completion.responseId
  };
}
