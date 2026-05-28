import { useEffect, useMemo, useState } from "react";
import {
  checkBackendHealth,
  compareEvaluation,
  createDataset,
  createPrompt,
  createPromptVersion,
  getApiErrorMessage,
  listEvaluations,
  listPromptDatasets,
  listPrompts,
  listPromptVersions,
  promotePromptVersion,
  rollbackPromptVersion,
  runEvaluation
} from "../services/api.js";
import {
  EmptyState,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBanner,
  TextArea,
  TextInput
} from "../components/ui.jsx";

const pages = [
  { id: "prompts", label: "Prompts List" },
  { id: "versions", label: "Prompt Versions" },
  { id: "datasets", label: "Dataset Viewer" },
  { id: "results", label: "Evaluation Results" }
];

const defaultPromptForm = {
  name: "",
  templateText: "You are a helpful assistant. Answer this request: {{input}}",
  variablesJson: '{ "input": "string" }',
  metadataJson: '{ "owner": "team", "status": "draft" }'
};

const defaultDatasetForm = {
  inputVariablesJson: '{ "input": "Summarize the product launch notes." }',
  rubric: "Score clarity, correctness, and usefulness from 1-10.",
  expectedBehaviorNotes: "The response should be concise, accurate, and actionable."
};

function parseJsonField(value, label) {
  try {
    const parsed = JSON.parse(value || "{}");

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`${label} must be a JSON object`);
    }

    return parsed;
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function scoreTone(score) {
  if (score >= 8) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (score >= 6) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function DashboardPage() {
  const [activePage, setActivePage] = useState("prompts");
  const [health, setHealth] = useState({ loading: true, ok: false });
  const [prompts, setPrompts] = useState([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [versions, setVersions] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [promptForm, setPromptForm] = useState(defaultPromptForm);
  const [versionForm, setVersionForm] = useState({
    templateText: "",
    variablesJson: '{ "input": "string" }',
    metadataJson: '{ "owner": "team", "status": "candidate" }'
  });
  const [datasetForm, setDatasetForm] = useState(defaultDatasetForm);
  const [evaluationForm, setEvaluationForm] = useState({
    datasetId: "",
    versionNumber: ""
  });
  const [comparison, setComparison] = useState(null);

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => String(prompt.id) === String(selectedPromptId)),
    [prompts, selectedPromptId]
  );

  const productionVersionNumber = selectedPrompt?.productionVersion?.versionNumber;

  const latestVersion = versions[0];

  async function loadPrompts({ keepSelection = true, preferredPromptId = selectedPromptId } = {}) {
    const data = await listPrompts();
    setPrompts(data);

    if (data.length === 0) {
      setSelectedPromptId("");
      return "";
    }

    const preferredId = String(preferredPromptId || "");
    const currentStillExists = data.some((prompt) => String(prompt.id) === preferredId);
    const nextId = keepSelection && currentStillExists ? preferredId : String(data[0].id);
    setSelectedPromptId(nextId);
    return nextId;
  }

  async function loadPromptDetails(promptId) {
    if (!promptId) {
      setVersions([]);
      setDatasets([]);
      setEvaluations([]);
      return;
    }

    setDetailsLoading(true);

    try {
      const [versionData, datasetData, evaluationData] = await Promise.all([
        listPromptVersions(promptId),
        listPromptDatasets(promptId),
        listEvaluations(promptId)
      ]);

      setVersions(versionData.versions || []);
      setDatasets(datasetData.datasets || []);
      setEvaluations(evaluationData.evaluations || []);

      const nextDatasetId = datasetData.datasets?.[0]?.id ? String(datasetData.datasets[0].id) : "";
      const nextVersionNumber = versionData.versions?.[0]?.versionNumber
        ? String(versionData.versions[0].versionNumber)
        : "";

      setEvaluationForm({
        datasetId: nextDatasetId,
        versionNumber: nextVersionNumber
      });

      if (versionData.versions?.[0]) {
        setVersionForm({
          templateText: versionData.versions[0].templateText,
          variablesJson: JSON.stringify(versionData.versions[0].variables, null, 2),
          metadataJson: JSON.stringify(versionData.versions[0].metadata, null, 2)
        });
      }
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshCurrentPrompt(promptId = selectedPromptId) {
    const nextPromptId = await loadPrompts({
      keepSelection: true,
      preferredPromptId: promptId
    });
    await loadPromptDetails(promptId || nextPromptId);
  }

  useEffect(() => {
    async function boot() {
      setLoading(true);

      try {
        const [healthData] = await Promise.all([checkBackendHealth()]);
        setHealth({ loading: false, ok: healthData.status === "ok" });
      } catch (error) {
        setHealth({ loading: false, ok: false });
        setStatus({ type: "error", message: `Backend not reachable: ${getApiErrorMessage(error)}` });
      }

      try {
        const promptId = await loadPrompts({ keepSelection: false });
        await loadPromptDetails(promptId);
      } catch (error) {
        setStatus({ type: "error", message: getApiErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, []);

  useEffect(() => {
    if (!selectedPromptId || loading) {
      return;
    }

    setComparison(null);
    loadPromptDetails(selectedPromptId);
  }, [selectedPromptId]);

  async function handleCreatePrompt(event) {
    event.preventDefault();
    setActionLoading("create-prompt");
    setStatus({ type: "", message: "" });

    try {
      const variables = parseJsonField(promptForm.variablesJson, "Variables");
      const metadata = parseJsonField(promptForm.metadataJson, "Metadata");
      const created = await createPrompt({
        name: promptForm.name,
        templateText: promptForm.templateText,
        variables,
        metadata
      });

      setPromptForm(defaultPromptForm);
      setSelectedPromptId(String(created.id));
      await refreshCurrentPrompt(String(created.id));
      setStatus({ type: "success", message: `Prompt "${created.name}" created.` });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionLoading("");
    }
  }

  async function handleCreateVersion(event) {
    event.preventDefault();

    if (!selectedPromptId) {
      return;
    }

    setActionLoading("create-version");
    setStatus({ type: "", message: "" });

    try {
      const variables = parseJsonField(versionForm.variablesJson, "Variables");
      const metadata = parseJsonField(versionForm.metadataJson, "Metadata");
      const created = await createPromptVersion(selectedPromptId, {
        templateText: versionForm.templateText,
        variables,
        metadata
      });

      setVersionForm((current) => ({ ...current, templateText: created.templateText }));
      await refreshCurrentPrompt(selectedPromptId);
      setStatus({ type: "success", message: `Version ${created.versionNumber} created.` });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionLoading("");
    }
  }

  async function handleCreateDataset(event) {
    event.preventDefault();

    if (!selectedPromptId) {
      return;
    }

    setActionLoading("create-dataset");
    setStatus({ type: "", message: "" });

    try {
      const inputVariables = parseJsonField(datasetForm.inputVariablesJson, "Input variables");
      const created = await createDataset({
        promptId: Number(selectedPromptId),
        inputVariables,
        rubric: datasetForm.rubric,
        expectedBehaviorNotes: datasetForm.expectedBehaviorNotes
      });

      setDatasetForm(defaultDatasetForm);
      setEvaluationForm((current) => ({ ...current, datasetId: String(created.id) }));
      await refreshCurrentPrompt(selectedPromptId);
      setStatus({ type: "success", message: `Dataset ${created.id} created.` });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionLoading("");
    }
  }

  async function handleRunEvaluation(event) {
    event.preventDefault();

    if (!selectedPromptId || !evaluationForm.datasetId || !evaluationForm.versionNumber) {
      setStatus({ type: "error", message: "Choose a prompt, dataset, and version before running an evaluation." });
      return;
    }

    setActionLoading("run-evaluation");
    setStatus({ type: "", message: "" });

    try {
      const result = await runEvaluation({
        promptId: Number(selectedPromptId),
        datasetId: Number(evaluationForm.datasetId),
        versionNumber: Number(evaluationForm.versionNumber)
      });

      await loadPromptDetails(selectedPromptId);
      setStatus({
        type: "success",
        message: `Evaluation complete. Score: ${result.evaluation.judgeScore}/10.`
      });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionLoading("");
    }
  }

  async function handleVersionAction(version, operation) {
    if (!selectedPromptId) {
      return;
    }

    setActionLoading(`${operation}-${version.id}`);
    setStatus({ type: "", message: "" });

    try {
      if (operation === "rollback") {
        await rollbackPromptVersion(selectedPromptId, version.id);
      } else {
        await promotePromptVersion(selectedPromptId, version.id);
      }

      await refreshCurrentPrompt(selectedPromptId);
      setStatus({
        type: "success",
        message: `Version ${version.versionNumber} is now production.`
      });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionLoading("");
    }
  }

  async function handleCompare(versionNumber) {
    if (!selectedPromptId) {
      return;
    }

    setActionLoading(`compare-${versionNumber}`);
    setComparison(null);
    setStatus({ type: "", message: "" });

    try {
      const result = await compareEvaluation({
        promptId: Number(selectedPromptId),
        candidateVersionNumber: Number(versionNumber)
      });

      setComparison({ versionNumber, ...result });
      setStatus({ type: "success", message: "Comparison calculated against production." });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error) });
    } finally {
      setActionLoading("");
    }
  }

  const pageContent = {
    prompts: (
      <PromptsListPage
        actionLoading={actionLoading}
        form={promptForm}
        loading={loading}
        onCreatePrompt={handleCreatePrompt}
        onFormChange={setPromptForm}
        onSelectPrompt={setSelectedPromptId}
        prompts={prompts}
        selectedPromptId={selectedPromptId}
        setActivePage={setActivePage}
      />
    ),
    versions: (
      <PromptVersionsPage
        actionLoading={actionLoading}
        detailsLoading={detailsLoading}
        form={versionForm}
        latestVersion={latestVersion}
        onCompare={handleCompare}
        onCreateVersion={handleCreateVersion}
        onFormChange={setVersionForm}
        onVersionAction={handleVersionAction}
        productionVersionNumber={productionVersionNumber}
        selectedPrompt={selectedPrompt}
        versions={versions}
      />
    ),
    datasets: (
      <DatasetViewerPage
        actionLoading={actionLoading}
        datasets={datasets}
        detailsLoading={detailsLoading}
        form={datasetForm}
        onCreateDataset={handleCreateDataset}
        onFormChange={setDatasetForm}
        selectedPrompt={selectedPrompt}
      />
    ),
    results: (
      <EvaluationResultsPage
        actionLoading={actionLoading}
        comparison={comparison}
        datasets={datasets}
        evaluations={evaluations}
        form={evaluationForm}
        onCompare={handleCompare}
        onFormChange={setEvaluationForm}
        onRunEvaluation={handleRunEvaluation}
        selectedPrompt={selectedPrompt}
        versions={versions}
      />
    )
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-2 overflow-x-auto" aria-label="Dashboard pages">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id)}
              className={`whitespace-nowrap border px-3 py-2 text-sm font-semibold transition ${
                activePage === page.id
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
              }`}
            >
              {page.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              health.ok ? "bg-emerald-500" : health.loading ? "bg-amber-400" : "bg-rose-500"
            }`}
          />
          <span>{health.ok ? "Backend online" : health.loading ? "Checking backend" : "Backend offline"}</span>
        </div>
      </div>

      <StatusBanner status={status} />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-950">Workspace</h2>
            <span className="text-xs text-zinc-500">{prompts.length} prompts</span>
          </div>

          <label className="mt-4 block">
            <FieldLabel>Active prompt</FieldLabel>
            <SelectInput
              value={selectedPromptId}
              onChange={(event) => setSelectedPromptId(event.target.value)}
              disabled={prompts.length === 0}
            >
              {prompts.length === 0 && <option value="">No prompts</option>}
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </option>
              ))}
            </SelectInput>
          </label>

          {selectedPrompt && (
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500">Production</dt>
                <dd className="mt-1 font-semibold text-zinc-950">
                  {productionVersionNumber ? `Version ${productionVersionNumber}` : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Versions</dt>
                <dd className="mt-1 font-semibold text-zinc-950">{versions.length}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Datasets</dt>
                <dd className="mt-1 font-semibold text-zinc-950">{datasets.length}</dd>
              </div>
            </dl>
          )}
        </aside>

        <section>{pageContent[activePage]}</section>
      </div>
    </div>
  );
}

function PromptsListPage({
  actionLoading,
  form,
  loading,
  onCreatePrompt,
  onFormChange,
  onSelectPrompt,
  prompts,
  selectedPromptId,
  setActivePage
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">Prompts</h2>
          <span className="text-sm text-zinc-500">{loading ? "Loading..." : `${prompts.length} total`}</span>
        </div>

        {prompts.length === 0 ? (
          <EmptyState title="No prompts yet" description="Create the first prompt to start versioning and evaluation workflows." />
        ) : (
          <div className="overflow-hidden border border-zinc-200 bg-white">
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_140px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:grid">
              <span>Name</span>
              <span>Production</span>
              <span>Created</span>
            </div>
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => {
                  onSelectPrompt(String(prompt.id));
                  setActivePage("versions");
                }}
                className={`grid w-full grid-cols-1 gap-2 border-b border-zinc-100 px-4 py-4 text-left text-sm transition last:border-b-0 hover:bg-stone-50 sm:grid-cols-[minmax(0,1fr)_120px_140px] sm:gap-3 ${
                  String(prompt.id) === String(selectedPromptId) ? "bg-emerald-50/70" : "bg-white"
                }`}
              >
                <span className="min-w-0 font-semibold text-zinc-950">
                  <span className="block truncate">{prompt.name}</span>
                </span>
                <span className="text-zinc-700">
                  <span className="font-semibold text-zinc-500 sm:hidden">Production: </span>
                  {prompt.productionVersion ? `v${prompt.productionVersion.versionNumber}` : "None"}
                </span>
                <span className="text-zinc-500">
                  <span className="font-semibold sm:hidden">Created: </span>
                  {formatDate(prompt.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={onCreatePrompt} className="border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">Create Prompt</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <FieldLabel>Name</FieldLabel>
            <TextInput
              required
              value={form.name}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              placeholder="support_reply"
            />
          </label>
          <label className="block">
            <FieldLabel>Template</FieldLabel>
            <TextArea
              required
              value={form.templateText}
              onChange={(event) => onFormChange({ ...form, templateText: event.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Variables JSON</FieldLabel>
            <TextArea
              required
              value={form.variablesJson}
              onChange={(event) => onFormChange({ ...form, variablesJson: event.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Metadata JSON</FieldLabel>
            <TextArea
              required
              value={form.metadataJson}
              onChange={(event) => onFormChange({ ...form, metadataJson: event.target.value })}
            />
          </label>
          <PrimaryButton disabled={actionLoading === "create-prompt"}>
            {actionLoading === "create-prompt" ? "Creating..." : "Create prompt"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function PromptVersionsPage({
  actionLoading,
  detailsLoading,
  form,
  latestVersion,
  onCompare,
  onCreateVersion,
  onFormChange,
  onVersionAction,
  productionVersionNumber,
  selectedPrompt,
  versions
}) {
  if (!selectedPrompt) {
    return <EmptyState title="Select a prompt" description="Choose or create a prompt before managing versions." />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{selectedPrompt.name}</h2>
            <p className="text-sm text-zinc-500">
              {detailsLoading ? "Refreshing versions..." : `${versions.length} versions`}
            </p>
          </div>
        </div>

        {versions.length === 0 ? (
          <EmptyState title="No versions" description="Create a version to start tracking changes." />
        ) : (
          <div className="space-y-3">
            {versions.map((version) => {
              const isOlderThanProduction =
                productionVersionNumber && version.versionNumber < productionVersionNumber;
              const action = isOlderThanProduction ? "rollback" : "promote";
              const actionLabel = isOlderThanProduction ? "Rollback" : "Promote";

              return (
                <article key={version.id} className="border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-zinc-950">Version {version.versionNumber}</h3>
                        {version.isProduction && (
                          <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Production
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">{formatDate(version.createdAt)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!version.isProduction && (
                        <SecondaryButton
                          onClick={() => onVersionAction(version, action)}
                          disabled={actionLoading === `${action}-${version.id}`}
                        >
                          {actionLoading === `${action}-${version.id}` ? "Working..." : actionLabel}
                        </SecondaryButton>
                      )}
                      <SecondaryButton
                        onClick={() => onCompare(version.versionNumber)}
                        disabled={actionLoading === `compare-${version.versionNumber}`}
                      >
                        Compare
                      </SecondaryButton>
                    </div>
                  </div>

                  <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
                    {version.templateText}
                  </pre>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <form onSubmit={onCreateVersion} className="border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">Create Version</h2>
        <p className="mt-1 text-sm text-zinc-500">
          New versions are immutable and start as candidates.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <FieldLabel>Template</FieldLabel>
            <TextArea
              required
              value={form.templateText || latestVersion?.templateText || ""}
              onChange={(event) => onFormChange({ ...form, templateText: event.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Variables JSON</FieldLabel>
            <TextArea
              required
              value={form.variablesJson}
              onChange={(event) => onFormChange({ ...form, variablesJson: event.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Metadata JSON</FieldLabel>
            <TextArea
              required
              value={form.metadataJson}
              onChange={(event) => onFormChange({ ...form, metadataJson: event.target.value })}
            />
          </label>
          <PrimaryButton disabled={actionLoading === "create-version"}>
            {actionLoading === "create-version" ? "Creating..." : "Create version"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function DatasetViewerPage({
  actionLoading,
  datasets,
  detailsLoading,
  form,
  onCreateDataset,
  onFormChange,
  selectedPrompt
}) {
  if (!selectedPrompt) {
    return <EmptyState title="Select a prompt" description="Choose or create a prompt before viewing datasets." />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">Datasets</h2>
          <span className="text-sm text-zinc-500">
            {detailsLoading ? "Refreshing..." : `${datasets.length} records`}
          </span>
        </div>

        {datasets.length === 0 ? (
          <EmptyState title="No datasets" description="Add a dataset row to run evaluations for this prompt." />
        ) : (
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <article key={dataset.id} className="border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-zinc-950">Dataset {dataset.id}</h3>
                  <span className="text-xs text-zinc-500">{formatDate(dataset.createdAt)}</span>
                </div>
                <pre className="mt-3 overflow-auto bg-zinc-50 p-3 text-xs leading-5 text-zinc-800">
                  {JSON.stringify(dataset.inputVariables, null, 2)}
                </pre>
                <p className="mt-3 text-sm leading-6 text-zinc-700">{dataset.rubric}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{dataset.expectedBehaviorNotes}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={onCreateDataset} className="border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">Add Dataset</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <FieldLabel>Input Variables JSON</FieldLabel>
            <TextArea
              required
              value={form.inputVariablesJson}
              onChange={(event) => onFormChange({ ...form, inputVariablesJson: event.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Rubric</FieldLabel>
            <TextArea
              required
              value={form.rubric}
              onChange={(event) => onFormChange({ ...form, rubric: event.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Expected Behavior</FieldLabel>
            <TextArea
              required
              value={form.expectedBehaviorNotes}
              onChange={(event) => onFormChange({ ...form, expectedBehaviorNotes: event.target.value })}
            />
          </label>
          <PrimaryButton disabled={actionLoading === "create-dataset"}>
            {actionLoading === "create-dataset" ? "Adding..." : "Add dataset"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function EvaluationResultsPage({
  actionLoading,
  comparison,
  datasets,
  evaluations,
  form,
  onCompare,
  onFormChange,
  onRunEvaluation,
  selectedPrompt,
  versions
}) {
  if (!selectedPrompt) {
    return <EmptyState title="Select a prompt" description="Choose or create a prompt before running evaluations." />;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onRunEvaluation} className="border border-zinc-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block">
            <FieldLabel>Dataset</FieldLabel>
            <SelectInput
              required
              value={form.datasetId}
              onChange={(event) => onFormChange({ ...form, datasetId: event.target.value })}
            >
              <option value="">Choose dataset</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  Dataset {dataset.id}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="block">
            <FieldLabel>Version</FieldLabel>
            <SelectInput
              required
              value={form.versionNumber}
              onChange={(event) => onFormChange({ ...form, versionNumber: event.target.value })}
            >
              <option value="">Choose version</option>
              {versions.map((version) => (
                <option key={version.id} value={version.versionNumber}>
                  Version {version.versionNumber}
                  {version.isProduction ? " production" : ""}
                </option>
              ))}
            </SelectInput>
          </label>
          <PrimaryButton disabled={actionLoading === "run-evaluation" || datasets.length === 0 || versions.length === 0}>
            {actionLoading === "run-evaluation" ? "Running..." : "Run evaluation"}
          </PrimaryButton>
        </div>
      </form>

      {comparison && (
        <section className="border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Comparison</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ScoreMetric label={`Candidate v${comparison.versionNumber}`} score={comparison.candidateScore} />
            <ScoreMetric label="Production" score={comparison.productionScore} />
            <div className="border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Regression</p>
              <p className={`mt-2 text-lg font-semibold ${comparison.regression ? "text-rose-700" : "text-emerald-700"}`}>
                {comparison.regression ? "Detected" : "Clear"}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">Scores</h2>
          <span className="text-sm text-zinc-500">{evaluations.length} results</span>
        </div>

        {evaluations.length === 0 ? (
          <EmptyState title="No evaluation results" description="Run an evaluation or seed the backend database to see scores here." />
        ) : (
          <div className="space-y-3">
            {evaluations.map((evaluation) => (
              <article key={evaluation.id} className="border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`ring-1 px-2.5 py-1 text-sm font-semibold ${scoreTone(evaluation.judgeScore)}`}>
                        {evaluation.judgeScore}/10
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-950">
                        Version {evaluation.version.versionNumber} on Dataset {evaluation.dataset.id}
                      </h3>
                      {evaluation.version.isProduction && (
                        <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Production
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{evaluation.judgeReasoning}</p>
                    <p className="mt-2 text-xs text-zinc-500">{formatDate(evaluation.createdAt)}</p>
                  </div>
                  <SecondaryButton
                    onClick={() => onCompare(evaluation.version.versionNumber)}
                    disabled={actionLoading === `compare-${evaluation.version.versionNumber}`}
                  >
                    Compare
                  </SecondaryButton>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-700">Generated output</summary>
                  <p className="mt-3 whitespace-pre-wrap border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                    {evaluation.generatedOutput}
                  </p>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreMetric({ label, score }) {
  return (
    <div className="border border-zinc-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950">{score}/10</p>
    </div>
  );
}

export default DashboardPage;
