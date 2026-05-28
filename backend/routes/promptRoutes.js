import { Router } from "express";
import { z } from "zod";
import {
  createPrompt,
  createPromptVersion,
  getPromptById,
  getPromptVersionDiff,
  listPromptVersions,
  listPrompts,
  promotePromptVersion,
  rollbackPromptVersion,
  runProductionPrompt
} from "../services/promptService.js";
import { listPromptDatasets } from "../services/datasetService.js";
import { asyncHandler, validate } from "../utils/http.js";

const router = Router();

const variableTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "json",
  "array",
  "object"
]);

const typedVariablesSchema = z.record(variableTypeSchema);
const metadataSchema = z.record(z.any());
const promptIdSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
const promptNameSchema = z.object({ name: z.string().trim().min(1) }).strict();
const versionActionSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    versionId: z.coerce.number().int().positive()
  })
  .strict();

const createPromptSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    templateText: z.string().trim().min(1),
    variables: typedVariablesSchema.optional(),
    metadata: metadataSchema.optional()
  })
  .strict();

const createPromptVersionSchema = z
  .object({
    templateText: z.string().trim().min(1).optional(),
    variables: typedVariablesSchema.optional(),
    metadata: metadataSchema.optional()
  })
  .strict()
  .refine(
    (value) =>
      value.templateText !== undefined ||
      value.variables !== undefined ||
      value.metadata !== undefined,
    {
      message: "At least one of templateText, variables, or metadata is required"
    }
  );

const promptDiffSchema = z
  .object({
    v1: z.coerce.number().int().positive(),
    v2: z.coerce.number().int().positive()
  })
  .strict();

const runPromptSchema = z
  .object({
    variables: z.record(z.any()).optional()
  })
  .strict();

router.get(
  "/",
  asyncHandler((req, res) => {
    res.json(listPrompts());
  })
);

router.post(
  "/",
  asyncHandler((req, res) => {
    const payload = validate(createPromptSchema, req.body, "Invalid prompt payload");
    res.status(201).json(createPrompt(payload));
  })
);

router.post(
  "/:name/run",
  asyncHandler(async (req, res) => {
    const { name } = validate(promptNameSchema, req.params, "Invalid prompt name");
    const payload = validate(runPromptSchema, req.body, "Invalid run prompt payload");
    res.json(await runProductionPrompt(name, payload.variables || {}));
  })
);

router.post(
  "/:id/version",
  asyncHandler((req, res) => {
    const { id } = validate(promptIdSchema, req.params, "Invalid prompt id");
    const payload = validate(
      createPromptVersionSchema,
      req.body,
      "Invalid prompt version payload"
    );
    res.status(201).json(createPromptVersion(id, payload));
  })
);

router.post(
  "/:id/promote/:versionId",
  asyncHandler((req, res) => {
    const { id, versionId } = validate(
      versionActionSchema,
      req.params,
      "Invalid prompt/version params"
    );
    res.json(promotePromptVersion(id, versionId));
  })
);

router.post(
  "/:id/rollback/:versionId",
  asyncHandler((req, res) => {
    const { id, versionId } = validate(
      versionActionSchema,
      req.params,
      "Invalid prompt/version params"
    );
    res.json(rollbackPromptVersion(id, versionId));
  })
);

router.get(
  "/:id/versions",
  asyncHandler((req, res) => {
    const { id } = validate(promptIdSchema, req.params, "Invalid prompt id");
    res.json(listPromptVersions(id));
  })
);

router.get(
  "/:id/diff",
  asyncHandler((req, res) => {
    const { id } = validate(promptIdSchema, req.params, "Invalid prompt id");
    const { v1, v2 } = validate(
      promptDiffSchema,
      req.query,
      "Invalid diff query parameters"
    );
    res.json(getPromptVersionDiff(id, v1, v2));
  })
);

router.get(
  "/:id/datasets",
  asyncHandler((req, res) => {
    const { id } = validate(promptIdSchema, req.params, "Invalid prompt id");
    res.json(listPromptDatasets(id));
  })
);

router.get(
  "/:id",
  asyncHandler((req, res) => {
    const { id } = validate(promptIdSchema, req.params, "Invalid prompt id");
    const prompt = getPromptById(id);

    if (!prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    return res.json(prompt);
  })
);

export default router;
