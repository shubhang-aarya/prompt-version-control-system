import "./utils/env.js";
import express from "express";
import cors from "cors";
import { initDatabase } from "./db/init.js";
import healthRoutes from "./routes/healthRoutes.js";
import promptRoutes from "./routes/promptRoutes.js";
import datasetRoutes from "./routes/datasetRoutes.js";
import evaluationRoutes from "./routes/evaluationRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;

initDatabase();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRoutes);
app.use("/prompts", promptRoutes);
app.use("/datasets", datasetRoutes);
app.use("/evaluations", evaluationRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, _next) => {
  if (!err.status || err.status >= 500) {
    console.error(err);
  }

  const status = err.status || 500;
  const response = {
    error: err.message || "Internal Server Error"
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(status).json(response);
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
