PRAGMA foreign_keys = ON;

-- Prompt 1: Support response generator
INSERT OR IGNORE INTO prompts (name) VALUES ('support_reply');

INSERT OR IGNORE INTO prompt_versions (
  prompt_id,
  version_number,
  template_text,
  variables_json,
  metadata_json,
  is_production
)
SELECT
  p.id,
  1,
  'You are a support assistant. Reply clearly and politely. Customer issue: {{issue}}. Tone: {{tone}}.',
  '{"issue":"string","tone":"string"}',
  '{"owner":"support-team","status":"baseline"}',
  0
FROM prompts p
WHERE p.name = 'support_reply';

INSERT OR IGNORE INTO prompt_versions (
  prompt_id,
  version_number,
  template_text,
  variables_json,
  metadata_json,
  is_production
)
SELECT
  p.id,
  2,
  'You are a senior support assistant. Resolve the issue with empathy and actionable next steps. Customer issue: {{issue}}. Tone: {{tone}}.',
  '{"issue":"string","tone":"string"}',
  '{"owner":"support-team","status":"production"}',
  1
FROM prompts p
WHERE p.name = 'support_reply';

INSERT OR IGNORE INTO prompt_versions (
  prompt_id,
  version_number,
  template_text,
  variables_json,
  metadata_json,
  is_production
)
SELECT
  p.id,
  3,
  'You are a support specialist. Respond with empathy, diagnosis, and one follow-up question. Customer issue: {{issue}}. Tone: {{tone}}.',
  '{"issue":"string","tone":"string"}',
  '{"owner":"support-team","status":"candidate"}',
  0
FROM prompts p
WHERE p.name = 'support_reply';

-- Prompt 2: Meeting summary generator
INSERT OR IGNORE INTO prompts (name) VALUES ('meeting_summary');

INSERT OR IGNORE INTO prompt_versions (
  prompt_id,
  version_number,
  template_text,
  variables_json,
  metadata_json,
  is_production
)
SELECT
  p.id,
  1,
  'Summarize this meeting transcript into bullets with decisions and action items: {{transcript}}',
  '{"transcript":"string"}',
  '{"owner":"ops-team","status":"production"}',
  1
FROM prompts p
WHERE p.name = 'meeting_summary';

INSERT OR IGNORE INTO prompt_versions (
  prompt_id,
  version_number,
  template_text,
  variables_json,
  metadata_json,
  is_production
)
SELECT
  p.id,
  2,
  'Create a concise meeting summary from this transcript: {{transcript}}. Include decisions, blockers, and action owners.',
  '{"transcript":"string"}',
  '{"owner":"ops-team","status":"candidate"}',
  0
FROM prompts p
WHERE p.name = 'meeting_summary';

-- Datasets
INSERT INTO datasets (prompt_id, input_json, rubric_text, expected_behavior)
SELECT
  p.id,
  '{"issue":"I was charged twice for one order.","tone":"calm"}',
  'Should acknowledge issue, apologize, explain next step, and provide timeline.',
  'Empathetic resolution message with clear next steps.'
FROM prompts p
WHERE p.name = 'support_reply'
  AND NOT EXISTS (
    SELECT 1 FROM datasets d
    WHERE d.prompt_id = p.id
      AND d.input_json = '{"issue":"I was charged twice for one order.","tone":"calm"}'
  );

INSERT INTO datasets (prompt_id, input_json, rubric_text, expected_behavior)
SELECT
  p.id,
  '{"transcript":"Team agreed to launch beta on Friday. Priya owns QA checklist. Alex will draft release notes."}',
  'Should include concise summary, key decisions, and action items with owners.',
  'Structured bullets with clear ownership and outcomes.'
FROM prompts p
WHERE p.name = 'meeting_summary'
  AND NOT EXISTS (
    SELECT 1 FROM datasets d
    WHERE d.prompt_id = p.id
      AND d.input_json = '{"transcript":"Team agreed to launch beta on Friday. Priya owns QA checklist. Alex will draft release notes."}'
  );

-- Example evaluations for regression baselines
INSERT INTO evaluations (version_id, dataset_id, generated_output, judge_score, judge_reasoning)
SELECT
  pv.id,
  d.id,
  'I am sorry this happened. I can see the duplicate charge and have started a refund request. You will receive confirmation within 24 hours.',
  8.8,
  'Good empathy and clear next step. Could include one follow-up verification question.'
FROM prompt_versions pv
JOIN prompts p ON p.id = pv.prompt_id
JOIN datasets d ON d.prompt_id = p.id
WHERE p.name = 'support_reply'
  AND pv.version_number = 2
  AND d.input_json = '{"issue":"I was charged twice for one order.","tone":"calm"}'
  AND NOT EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.version_id = pv.id
      AND e.dataset_id = d.id
  );

INSERT INTO evaluations (version_id, dataset_id, generated_output, judge_score, judge_reasoning)
SELECT
  pv.id,
  d.id,
  'Sorry for the inconvenience. Duplicate charges happen due to payment retries. Please wait for a refund.',
  7.2,
  'Lower score due to vague timeline and limited actionability compared to production version.'
FROM prompt_versions pv
JOIN prompts p ON p.id = pv.prompt_id
JOIN datasets d ON d.prompt_id = p.id
WHERE p.name = 'support_reply'
  AND pv.version_number = 3
  AND d.input_json = '{"issue":"I was charged twice for one order.","tone":"calm"}'
  AND NOT EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.version_id = pv.id
      AND e.dataset_id = d.id
  );
