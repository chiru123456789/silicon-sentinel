"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Scenario = {
  id: string;
  name: string;
  status:
    | "PASS"
    | "FAILURE"
    | "BUILD_ERROR"
    | "SIMULATION_ERROR";
  startedAt: string;
  completedAt: string;
  execution: {
    status: string;
    output: string;
    details: string;
  };
  failure: {
    detected: boolean;
    risk: string | null;
    module: string | null;
    operation: string | null;
    expected: unknown;
    actual: unknown;
  };
  sourceMapping: {
    file: string | null;
    line: number | null;
  };
  artifacts: {
    report: string;
    simulationLog: string;
    reportMarkdown: string;
    waveform: string;
  };
};

type Campaign = {
  id: string;
  projectId: string;
  name: string;
  startedAt: string;
  completedAt: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  buildFailures: number;
  simulationErrors: number;
  status:
    | "PASS"
    | "FAILURE"
    | "BUILD_ERROR"
    | "SIMULATION_ERROR";
  scenarios: Scenario[];
};

type Project = {
  id: string;
  name?: string;
  rtlFilename?: string;
  testbenchFilename?: string;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatTime(value: string) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  } catch {
    return value;
  }
}

function StatusBadge({
  status,
}: {
  status: Campaign["status"] | Scenario["status"];
}) {
  const config = {
    PASS: {
      label: "PASS",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      dot: "bg-emerald-400",
    },

    FAILURE: {
      label: "FAILURE",
      className:
        "border-red-500/30 bg-red-500/10 text-red-400",
      dot: "bg-red-400",
    },

    BUILD_ERROR: {
      label: "BUILD ERROR",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-400",
      dot: "bg-amber-400",
    },

    SIMULATION_ERROR: {
      label: "SIMULATION ERROR",
      className:
        "border-orange-500/30 bg-orange-500/10 text-orange-400",
      dot: "bg-orange-400",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot}`}
      />
      {config.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "green" | "red" | "amber";
}) {
  const toneClasses = {
    neutral: "text-slate-100",
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
  };

  return (
    <div className="border border-white/10 bg-[#0b1017] px-5 py-4">
      <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>

      <div
        className={`mt-2 font-mono text-2xl font-semibold ${toneClasses[tone]}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function CampaignPage() {
  const params = useParams();
  const projectId = String(params.id);

  const [campaign, setCampaign] =
    useState<Campaign | null>(null);

  const [project, setProject] =
    useState<Project | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [running, setRunning] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function runCampaign() {
    try {
      setRunning(true);
      setError(null);

      const response = await fetch(
        `/api/projects/${projectId}/campaign`,
        {
          method: "POST",
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Campaign execution failed."
        );
      }

      setCampaign(data.campaign);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Campaign execution failed."
      );
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }

  async function loadProject() {
    try {
      const response = await fetch(
        `/api/projects/${projectId}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setProject(
        data.project ||
          data
      );
    } catch {
      // Project metadata is optional for the campaign screen.
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);

      await loadProject();

      if (!cancelled) {
        await runCampaign();
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const scenario =
    campaign?.scenarios?.[0] || null;

  return (
    <main className="min-h-screen bg-[#070a0f] text-slate-200">
      {/* ------------------------------------------------------- */}
      {/* HEADER */}
      {/* ------------------------------------------------------- */}

      <header className="border-b border-white/10 bg-[#090d13]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/projects/${projectId}`}
              className="flex h-8 w-8 items-center justify-center border border-white/10 text-slate-500 transition hover:border-cyan-500/40 hover:text-cyan-400"
              title="Back to verification workstation"
            >
              ←
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />

                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400">
                  Silicon Sentinel
                </span>
              </div>

              <h1 className="mt-1 text-sm font-semibold tracking-wide text-slate-100">
                Failure Campaign Laboratory
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-600">
                Project
              </div>

              <div className="font-mono text-xs text-slate-400">
                {project?.name ||
                  `PROJECT-${projectId}`}
              </div>
            </div>

            <button
              onClick={runCampaign}
              disabled={running}
              className="border border-cyan-500/30 bg-cyan-500/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400 transition hover:border-cyan-400/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running
                ? "Running..."
                : "Run Campaign"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* ----------------------------------------------------- */}
        {/* BREADCRUMB */}
        {/* ----------------------------------------------------- */}

        <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
          <Link
            href="/"
            className="transition hover:text-cyan-400"
          >
            Command Center
          </Link>

          <span>/</span>

          <Link
            href={`/projects/${projectId}`}
            className="transition hover:text-cyan-400"
          >
            Verification Workstation
          </Link>

          <span>/</span>

          <span className="text-slate-400">
            Failure Campaign
          </span>
        </div>

        {/* ----------------------------------------------------- */}
        {/* TITLE */}
        {/* ----------------------------------------------------- */}

        <section className="border border-white/10 bg-[#0b1017]">
          <div className="border-b border-white/10 px-6 py-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-500/80">
                  Verification Campaign
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  {campaign?.name ||
                    "ALU VERIFICATION"}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Execute the real verification environment
                  and collect failure evidence before silicon.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {campaign ? (
                  <StatusBadge
                    status={campaign.status}
                  />
                ) : (
                  <span className="border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    Initializing
                  </span>
                )}

                <span className="font-mono text-[10px] text-slate-600">
                  {campaign?.id ||
                    "CAMPAIGN-001"}
                </span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------- */}
          {/* METRICS */}
          {/* --------------------------------------------------- */}

          <div className="grid grid-cols-2 border-b border-white/10 md:grid-cols-5">
            <StatCard
              label="Total Scenarios"
              value={
                campaign?.totalScenarios ||
                0
              }
            />

            <StatCard
              label="Passed"
              value={
                campaign?.passed ||
                0
              }
              tone="green"
            />

            <StatCard
              label="Failed"
              value={
                campaign?.failed ||
                0
              }
              tone="red"
            />

            <StatCard
              label="Build Errors"
              value={
                campaign?.buildFailures ||
                0
              }
              tone="amber"
            />

            <StatCard
              label="Simulation Errors"
              value={
                campaign?.simulationErrors ||
                0
              }
              tone="amber"
            />
          </div>
        </section>

        {/* ----------------------------------------------------- */}
        {/* ERROR */}
        {/* ----------------------------------------------------- */}

        {error && (
          <div className="mt-5 border border-red-500/30 bg-red-500/5 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-400">
              Campaign Execution Error
            </div>

            <div className="mt-2 font-mono text-xs leading-5 text-red-300/80">
              {error}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------- */}
        {/* LOADING */}
        {/* ----------------------------------------------------- */}

        {loading && !campaign && (
          <section className="mt-5 border border-white/10 bg-[#0b1017]">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />

                <span className="font-mono text-xs uppercase tracking-[0.15em] text-cyan-400">
                  Initializing verification campaign...
                </span>
              </div>

              <div className="mt-5 h-2 w-full overflow-hidden bg-white/5">
                <div className="h-full w-1/3 animate-pulse bg-cyan-500/30" />
              </div>
            </div>
          </section>
        )}

        {/* ----------------------------------------------------- */}
        {/* SCENARIO MATRIX */}
        {/* ----------------------------------------------------- */}

        {campaign && (
          <>
            <section className="mt-5 border border-white/10 bg-[#0b1017]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Scenario Matrix
                  </div>

                  <div className="mt-1 font-mono text-[10px] text-slate-600">
                    REAL EXECUTION RESULTS
                  </div>
                </div>

                <div className="font-mono text-[10px] text-slate-600">
                  {campaign.totalScenarios} scenario
                  {campaign.totalScenarios !== 1
                    ? "s"
                    : ""}
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {campaign.scenarios.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="p-5"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-[#070a0f] font-mono text-[10px] text-slate-500">
                            001
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-mono text-sm text-slate-200">
                                {item.name}
                              </span>

                              <StatusBadge
                                status={
                                  item.status
                                }
                              />
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-slate-600">
                              <span>
                                ID: {item.id}
                              </span>

                              <span>
                                START:{" "}
                                {formatTime(
                                  item.startedAt
                                )}
                              </span>

                              <span>
                                END:{" "}
                                {formatTime(
                                  item.completedAt
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {item.failure
                            .detected && (
                            <div className="border border-red-500/20 bg-red-500/5 px-3 py-2 text-right">
                              <div className="text-[8px] uppercase tracking-[0.15em] text-red-500/70">
                                Failure
                              </div>

                              <div className="mt-1 font-mono text-xs text-red-400">
                                {item.failure
                                  .operation ||
                                  "Verification failure"}
                              </div>
                            </div>
                          )}

                          <Link
                            href={`/projects/${projectId}`}
                            className="border border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-400"
                          >
                            Open Investigation →
                          </Link>
                        </div>
                      </div>

                      {/* --------------------------------------- */}
                      {/* SCENARIO EVIDENCE */}
                      {/* --------------------------------------- */}

                      {item.failure
                        .detected && (
                        <div className="mt-5 grid gap-3 border-t border-white/5 pt-5 md:grid-cols-4">
                          <div>
                            <div className="text-[8px] uppercase tracking-[0.15em] text-slate-600">
                              Module
                            </div>

                            <div className="mt-1 font-mono text-xs text-slate-300">
                              {item.failure
                                .module ||
                                "—"}
                            </div>
                          </div>

                          <div>
                            <div className="text-[8px] uppercase tracking-[0.15em] text-slate-600">
                              Operation
                            </div>

                            <div className="mt-1 font-mono text-xs text-slate-300">
                              {item.failure
                                .operation ||
                                "—"}
                            </div>
                          </div>

                          <div>
                            <div className="text-[8px] uppercase tracking-[0.15em] text-slate-600">
                              Source
                            </div>

                            <div className="mt-1 font-mono text-xs text-slate-300">
                              {item.sourceMapping
                                .file ||
                                "—"}
                            </div>
                          </div>

                          <div>
                            <div className="text-[8px] uppercase tracking-[0.15em] text-slate-600">
                              Line
                            </div>

                            <div className="mt-1 font-mono text-xs text-red-400">
                              {item.sourceMapping
                                .line ??
                                "—"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </section>

            {/* ------------------------------------------------- */}
            {/* FAILURE EVIDENCE */}
            {/* ------------------------------------------------- */}

            {scenario?.failure
              .detected && (
              <section className="mt-5 border border-red-500/20 bg-[#0b1017]">
                <div className="border-b border-red-500/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" />

                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400">
                        Failure Evidence
                      </div>

                      <div className="mt-1 font-mono text-[10px] text-slate-600">
                        SCENARIO-001 / VERIFIED FAILURE
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-white/5 md:grid-cols-4">
                  <EvidenceCell
                    label="Module"
                    value={
                      scenario.failure
                        .module
                    }
                  />

                  <EvidenceCell
                    label="Operation"
                    value={
                      scenario.failure
                        .operation
                    }
                  />

                  <EvidenceCell
                    label="Expected"
                    value={formatValue(
                      scenario.failure
                        .expected
                    )}
                    accent="green"
                  />

                  <EvidenceCell
                    label="Actual"
                    value={formatValue(
                      scenario.failure
                        .actual
                    )}
                    accent="red"
                  />
                </div>

                <div className="grid border-t border-white/5 md:grid-cols-2">
                  <div className="border-b border-white/5 p-5 md:border-b-0 md:border-r">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                      Source Mapping
                    </div>

                    <div className="mt-3 font-mono text-xs text-slate-300">
                      {scenario.sourceMapping
                        .file ||
                        "Unknown source"}
                    </div>

                    <div className="mt-1 font-mono text-[10px] text-red-400">
                      LINE{" "}
                      {scenario.sourceMapping
                        .line ??
                        "—"}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                      Risk Classification
                    </div>

                    <div className="mt-3 font-mono text-sm font-semibold uppercase text-red-400">
                      {scenario.failure
                        .risk ||
                        "UNCLASSIFIED"}
                    </div>

                    <div className="mt-1 text-xs text-slate-600">
                      Evidence linked to the
                      verification result.
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ------------------------------------------------- */}
            {/* ARTIFACTS */}
            {/* ------------------------------------------------- */}

            {scenario && (
              <section className="mt-5 border border-white/10 bg-[#0b1017]">
                <div className="border-b border-white/10 px-5 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Evidence Artifacts
                  </div>

                  <div className="mt-1 font-mono text-[10px] text-slate-600">
                    GENERATED BY SILICON SENTINEL
                  </div>
                </div>

                <div className="grid md:grid-cols-4">
                  <ArtifactCell
                    label="Failure Report"
                    value={
                      scenario.artifacts
                        .report
                    }
                  />

                  <ArtifactCell
                    label="Simulation Log"
                    value={
                      scenario.artifacts
                        .simulationLog
                    }
                  />

                  <ArtifactCell
                    label="Verification Report"
                    value={
                      scenario.artifacts
                        .reportMarkdown
                    }
                  />

                  <ArtifactCell
                    label="Waveform"
                    value={
                      scenario.artifacts
                        .waveform
                    }
                  />
                </div>
              </section>
            )}

            {/* ------------------------------------------------- */}
            {/* FOOTER ACTION */}
            {/* ------------------------------------------------- */}

            <section className="mt-5 flex flex-col justify-between gap-4 border border-white/10 bg-[#0b1017] p-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-400">
                  Continue Investigation
                </div>

                <div className="mt-1 text-xs text-slate-600">
                  Trace the failure from simulation evidence
                  back into the RTL workstation.
                </div>
              </div>

              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center justify-center border border-cyan-500/30 bg-cyan-500/5 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-400 transition hover:border-cyan-400/60 hover:bg-cyan-400/10"
              >
                Open Verification Workstation →
              </Link>
            </section>
          </>
        )}
      </div>

      {/* ------------------------------------------------------- */}
      {/* FOOTER */}
      {/* ------------------------------------------------------- */}

      <footer className="mx-auto mt-8 flex max-w-[1600px] items-center justify-between border-t border-white/5 px-6 py-5">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-700">
          SILICON SENTINEL / PRE-SILICON VERIFICATION
        </span>

        <span className="font-mono text-[9px] text-slate-700">
          FIND THE FAILURE BEFORE THE SILICON DOES
        </span>
      </footer>
    </main>
  );
}

function EvidenceCell({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: unknown;
  accent?: "neutral" | "green" | "red";
}) {
  const classes = {
    neutral: "text-slate-300",
    green: "text-emerald-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-[#0b1017] p-5">
      <div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">
        {label}
      </div>

      <div
        className={`mt-2 font-mono text-sm ${classes[accent]}`}
      >
        {formatValue(value)}
      </div>
    </div>
  );
}

function ArtifactCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-white/5 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">
        {label}
      </div>

      <div className="mt-2 break-all font-mono text-[10px] leading-5 text-slate-500">
        {value}
      </div>
    </div>
  );
}