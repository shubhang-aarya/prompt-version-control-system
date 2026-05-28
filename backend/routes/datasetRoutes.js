import { Router } from "express";
import { z } from "zod";
import { createDataset } from "../services/datasetService.js";
import { asyncHandler, validate } from "../utils/http.js";

const router = Router();

const createDatasetSchema = z
  .object({
    promptId: z.coerce.number().int().positive(),
    inputVariables: z.record(z.any()),
    rubric: z.string().trim().min(1),
    expectedBehaviorNotes: z.string().trim().min(1)
  })
  .strict();

router.post(
  "/",
  asyncHandler((req, res) => {
    const payload = validate(createDatasetSchema, req.body, "Invalid dataset payload");
    res.status(201).json(createDataset(payload));
  })
);

export default router;
