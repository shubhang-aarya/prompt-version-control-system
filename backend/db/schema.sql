-- Latest schema snapshot for Prompt Version Control System.
-- For runtime setup, use /db/migrations/001_prompt_vcs_schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  template_text TEXT NOT NULL,
  variables_json TEXT NOT NULL CHECK (json_valid(variables_json)),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  is_production INTEGER NOT NULL DEFAULT 0 CHECK (is_production IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  UNIQUE (prompt_id, version_number)
);

CREATE UNIQUE INDEX idx_prompt_versions_single_production
  ON prompt_versions(prompt_id)
  WHERE is_production = 1;

CREATE INDEX idx_prompt_versions_prompt_id
  ON prompt_versions(prompt_id);

CREATE TABLE datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER NOT NULL,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  rubric_text TEXT NOT NULL,
  expected_behavior TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE INDEX idx_datasets_prompt_id
  ON datasets(prompt_id);

CREATE TABLE evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  generated_output TEXT NOT NULL,
  judge_score REAL NOT NULL CHECK (judge_score >= 1 AND judge_score <= 10),
  judge_reasoning TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES prompt_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

CREATE INDEX idx_evaluations_version_id
  ON evaluations(version_id);
CREATE INDEX idx_evaluations_dataset_id
  ON evaluations(dataset_id);

CREATE TRIGGER trg_prompt_versions_immutable_content
BEFORE UPDATE ON prompt_versions
FOR EACH ROW
WHEN
  NEW.prompt_id != OLD.prompt_id OR
  NEW.version_number != OLD.version_number OR
  NEW.template_text != OLD.template_text OR
  NEW.variables_json != OLD.variables_json OR
  NEW.metadata_json != OLD.metadata_json OR
  NEW.created_at != OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'Prompt version content is immutable');
END;
