import { Router } from "express";
import { z } from "zod";
import {
  compareCandidateWithProduction,
  listEvaluations,
  runEvaluation
} from "../services/evaluationService.js";
import { asyncHandler, validate } from "../utils/http.js";

const router = Router();

const listEvaluationsSchema = z
  .object({
    promptId: z.coerce.number().int().positive().optional()
  })
  .strict();

const runEvaluationSchema = z
  .object({
    promptId: z.coerce.number().int().positive(),
    datasetId: z.coerce.number().int().positive(),
    versionNumber: z.coerce.number().int().positive().optional(),
    generationModel: z.string().trim().min(1).optional(),
    judgeModel: z.string().trim().min(1).optional()
  })
  .strict();

const compareEvaluationSchema = z
  .object({
    promptId: z.coerce.number().int().positive(),
    candidateVersionNumber: z.coerce.number().int().positive()
  })
  .strict();

router.get(
  "/",
  asyncHandler((req, res) => {
    const query = validate(
      listEvaluationsSchema,
      req.query,
      "Invalid evaluation query parameters"
    );
    res.json(listEvaluations(query));
  })
);

router.post(
  "/run",
  asyncHandler(async (req, res) => {
    const payload = validate(
      runEvaluationSchema,
      req.body,
      "Invalid evaluation run payload"
    );
    res.status(201).json(await runEvaluation(payload));
  })
);

router.post(
  "/compare",
  asyncHandler((req, res) => {
    const payload = validate(
      compareEvaluationSchema,
      req.body,
      "Invalid evaluation compare payload"
    );
    res.json(compareCandidateWithProduction(payload));
  })
);

export default router;
