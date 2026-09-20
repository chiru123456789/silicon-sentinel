"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  FlaskConical,
  FolderOpen,
  Gauge,
  GitBranch,
  Layers3,
  Radar,
  ShieldAlert,
  Terminal,
  Waves,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Project = {
  id: string | number;
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

type VerificationResult = {
  status?: string;
  risk?: string;
  module?: string;
  operation?: string;
  expected_result?: unknown;
  actual_result?: unknown;
  source_file?: string;
  source_line?: number;
  line?: number;
  sourceMapping?: {
    file?: string;
    line?: number;
    confidence?: string;
  };
};

type ProjectWithResult = Project & {
  result?: VerificationResult | null;
};

function isFailureStatus(status?: string) {
  const normalized = String(status || "").toUpperCase();

  return [
    "FAILURE",
    "FAILED",
    "FAIL",
    "ERROR",
    "BUILD_ERROR",
    "SIMULATION_ERROR",
  ].includes(normalized);
}

function isPassStatus(status?: string) {
  return String(status || "").toUpperCase() === "PASS";
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function getProjectName(project: Project) {
  return project.name || `PROJECT-${project.id}`;
}

function getProjectResult(project: ProjectWithResult) {
  return project.result || null;
}

function StatusBadge({
  status,
}: {
  status?: string;
}) {
  const normalized = String(status || "NOT RUN").toUpperCase();

  const failure = isFailureStatus(normalized);
  const pass = isPassStatus(normalized);

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[9px] font-semibold uppercase tracking-[0.16em]",
        failure
          ? "border-red-400/20 bg-red-400/[0.06] text-red-300"
          : pass
            ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
            : "border-white/10 bg-white/[0.03] text-white/35",
      ].join(" ")}
    >
      {failure ? (
        <XCircle size={11} />
      ) : pass ? (
        <CheckCircle2 size={11} />
      ) : (
        <Clock3 size={11} />
      )}
      {normalized}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone?: "cyan" | "red" | "green" | "amber";
}) {
  const toneClasses = {
    cyan: {
      icon: "text-cyan-300",
      border: "border-cyan-400/10",
    },
    red: {
      icon: "text-red-300",
      border: "border-red-400/10",
    },
    green: {
      icon: "text-emerald-300",
      border: "border-emerald-400/10",
    },
    amber: {
      icon: "text-amber-300",
      border: "border-amber-400/10",
    },
  };

  const current = toneClasses[tone];

  return (
    <div
      className={`rounded-2xl border ${current.border} bg-white/[0.025] p-4`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25">
            {label}
          </p>

          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white/90">
            {value}
          </p>

          <p className="mt-1 text-[10px] text-white/25">
            {detail}
          </p>
        </div>

        <Icon
          size={16}
          className={current.icon}
        />
      </div>
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: ProjectWithResult;
}) {
  const result = getProjectResult(project);

  const status = result?.status || "NOT RUN";
  const risk = result?.risk || "—";

  const failure = isFailureStatus(status);
  const pass = isPassStatus(status);

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-3xl border",
        "border-white/10 bg-white/[0.025] p-5",
        "transition hover:-translate-y-0.5 hover:border-cyan-400/20",
        "hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-400/[0.03] blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Cpu
                  size={15}
                  className="text-cyan-300"
                />
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white/80">
                  {getProjectName(project)}
                </h3>

                <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/20">
                  PROJECT-{project.id}
                </p>
              </div>
            </div>
          </div>

          <StatusBadge status={status} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
            <p className="text-[8px] uppercase tracking-[0.16em] text-white/20">
              Module
            </p>

            <p className="mt-1 truncate font-mono text-[11px] text-white/55">
              {result?.module || "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
            <p className="text-[8px] uppercase tracking-[0.16em] text-white/20">
              Risk
            </p>

            <p
              className={[
                "mt-1 font-mono text-[11px]",
                String(risk).toUpperCase() === "HIGH"
                  ? "text-red-300"
                  : "text-white/55",
              ].join(" ")}
            >
              {String(risk).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-white/20">
            <Waves size={11} />

            {failure
              ? "Investigation ready"
              : pass
                ? "Verified"
                : "Awaiting verification"}
          </span>

          <span className="text-[9px] uppercase tracking-[0.14em] text-white/20">
            Project
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:border-white/15 hover:text-white/70"
          >
            Open
            <ArrowRight size={12} />
          </Link>

          <Link
            href={`/projects/${project.id}/campaign`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.1]"
          >
            <FlaskConical size={12} />
            Campaign
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  icon: Icon,
  title,
  detail,
  time,
  tone = "cyan",
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
  time: string;
  tone?: "cyan" | "red" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-300"
      : tone === "green"
        ? "text-emerald-300"
        : "text-cyan-300";

  return (
    <div className="flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025]">
        <Icon
          size={12}
          className={toneClass}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-white/60">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[9px] text-white/25">
          {detail}
        </p>
      </div>

      <span className="shrink-0 font-mono text-[8px] text-white/20">
        {time}
      </span>
    </div>
  );
}

function PipelineStep({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-xl border px-3 py-2",
        active
          ? "border-cyan-400/20 bg-cyan-400/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.7)]" : "bg-white/15",
        ].join(" ")}
      />

      <span
        className={[
          "font-mono text-[8px] tracking-[0.12em]",
          active ? "text-cyan-300" : "text-white/25",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}

function PipelineArrow() {
  return (
    <ArrowRight
      size={11}
      className="shrink-0 text-white/10"
    />
  );
}

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectWithResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        setLoading(true);

        const response = await fetch("/api/projects", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load projects");
        }

        const data = await response.json();

        const rawProjects =
          Array.isArray(data)
            ? data
            : Array.isArray(data.projects)
              ? data.projects
              : [];

        const enriched = await Promise.all(
          rawProjects.map(async (project: Project) => {
            try {
              const resultResponse = await fetch(
                `/api/projects/${project.id}/result`,
                {
                  cache: "no-store",
                }
              );

              if (!resultResponse.ok) {
                return {
                  ...project,
                  result: null,
                };
              }

              const result = await resultResponse.json();

              return {
                ...project,
                result,
              };
            } catch {
              return {
                ...project,
                result: null,
              };
            }
          })
        );

        if (!cancelled) {
          setProjects(enriched);
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const verified = projects.filter((project) =>
      isPassStatus(project.result?.status)
    ).length;

    const failures = projects.filter((project) =>
      isFailureStatus(project.result?.status)
    ).length;

    const highRisk = projects.filter(
      (project) =>
        String(project.result?.risk || "").toUpperCase() === "HIGH"
    ).length;

    return {
      total: projects.length,
      verified,
      failures,
      highRisk,
    };
  }, [projects]);

  const latestProject = useMemo(() => {
    if (!projects.length) return null;

    return [...projects].sort((a, b) => {
      const aTime = new Date(
        a.updatedAt || a.createdAt || 0
      ).getTime();

      const bTime = new Date(
        b.updatedAt || b.createdAt || 0
      ).getTime();

      return bTime - aTime;
    })[0];
  }, [projects]);

  const activity = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        const aTime = new Date(
          a.updatedAt || a.createdAt || 0
        ).getTime();

        const bTime = new Date(
          b.updatedAt || b.createdAt || 0
        ).getTime();

        return bTime - aTime;
      })
      .slice(0, 5);
  }, [projects]);

  const latestResult = latestProject?.result;

  return (
    <main className="min-h-screen bg-[#05070a] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-cyan-400/[0.025] blur-[120px]" />
        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.02] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 py-5 sm:px-8">
        {/* HEADER */}
        <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05]">
              <Radar
                size={20}
                className="text-cyan-300"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-[0.12em] text-white/85">
                  SILICON SENTINEL
                </h1>

                <span className="rounded border border-cyan-400/15 bg-cyan-400/[0.04] px-1.5 py-0.5 font-mono text-[7px] tracking-[0.16em] text-cyan-300/70">
                  PRE-SILICON
                </span>
              </div>

              <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-white/20">
                RTL verification command center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]" />

              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-emerald-300/80">
                Sentinel Online
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 sm:flex">
              <Terminal
                size={11}
                className="text-white/25"
              />

              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
                Verilator Engine
              </span>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="py-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/60">
                Verification Command Center
              </p>

              <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.03em] text-white/90 sm:text-4xl">
                Find the failure before the silicon does.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/30">
                Inspect RTL, execute real verification runs, launch failure
                campaigns, and trace detected issues back to source evidence.
              </p>
            </div>

            {latestProject && (
              <Link
                href={`/projects/${latestProject.id}/campaign`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.1]"
              >
                <FlaskConical size={13} />
                Launch Campaign
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </section>

        {/* PRIMARY METRICS */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Projects"
            value={stats.total}
            detail="RTL designs under verification"
            icon={Layers3}
            tone="cyan"
          />

          <MetricCard
            label="Verified"
            value={stats.verified}
            detail="Passing verification runs"
            icon={CheckCircle2}
            tone="green"
          />

          <MetricCard
            label="Failures"
            value={stats.failures}
            detail="Issues requiring investigation"
            icon={CircleAlert}
            tone="red"
          />

          <MetricCard
            label="High Risk"
            value={stats.highRisk}
            detail="Critical silicon exposure"
            icon={ShieldAlert}
            tone="amber"
          />
        </section>

        {/* MAIN GRID */}
        <section className="mt-5 grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
          {/* PROJECT WORKSPACE */}
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.018] p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FolderOpen
                    size={14}
                    className="text-cyan-300"
                  />

                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                    Project Workspace
                  </h3>
                </div>

                <p className="mt-1 text-[9px] text-white/20">
                  RTL designs connected to verification evidence
                </p>
              </div>

              <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/20">
                {stats.total} PROJECTS
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {loading ? (
                <div className="col-span-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
                    Loading verification workspace...
                  </p>
                </div>
              ) : projects.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-8 text-center">
                  <Cpu
                    size={22}
                    className="mx-auto text-white/15"
                  />

                  <p className="mt-3 text-xs text-white/35">
                    No verification projects detected.
                  </p>

                  <p className="mt-1 text-[9px] text-white/20">
                    Create a project to begin RTL verification.
                  </p>
                </div>
              ) : (
                projects.map((project) => (
                  <ProjectCard
                    key={String(project.id)}
                    project={project}
                  />
                ))
              )}
            </div>
          </div>

          {/* ACTIVE FINDING */}
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.018] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert
                size={14}
                className="text-red-300"
              />

              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                Active Finding
              </h3>
            </div>

            <p className="mt-1 text-[9px] text-white/20">
              Most recent verification result
            </p>

            {latestProject && latestResult ? (
              <div className="mt-5">
                <div className="rounded-2xl border border-red-400/10 bg-red-400/[0.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-red-300/60">
                        {getProjectName(latestProject)}
                      </p>

                      <p className="mt-2 text-sm font-semibold text-white/75">
                        {latestResult.operation || "Verification failure"}
                      </p>
                    </div>

                    <StatusBadge status={latestResult.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                      <p className="text-[8px] uppercase tracking-[0.15em] text-white/20">
                        Module
                      </p>

                      <p className="mt-1 font-mono text-[10px] text-white/55">
                        {latestResult.module || "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                      <p className="text-[8px] uppercase tracking-[0.15em] text-white/20">
                        Source Line
                      </p>

                      <p className="mt-1 font-mono text-[10px] text-white/55">
                        {latestResult.sourceMapping?.line ??
                          latestResult.source_line ??
                          latestResult.line ??
                          "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] uppercase tracking-[0.15em] text-white/20">
                        Expected
                      </span>

                      <span className="font-mono text-[10px] text-emerald-300/70">
                        {formatValue(latestResult.expected_result)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[8px] uppercase tracking-[0.15em] text-white/20">
                        Actual
                      </span>

                      <span className="font-mono text-[10px] text-red-300/80">
                        {formatValue(latestResult.actual_result)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/projects/${latestProject.id}`}
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:border-white/20 hover:text-white/75"
                  >
                    Open Investigation
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                <Gauge
                  size={20}
                  className="mx-auto text-white/15"
                />

                <p className="mt-3 text-[10px] text-white/25">
                  No active verification finding.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ACTIVITY + RISK */}
        <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.018] p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Activity
                    size={14}
                    className="text-cyan-300"
                  />

                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                    Verification Activity
                  </h3>
                </div>

                <p className="mt-1 text-[9px] text-white/20">
                  Recent project verification events
                </p>
              </div>
            </div>

            <div className="mt-4">
              {activity.length === 0 ? (
                <p className="py-6 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-white/20">
                  No activity recorded
                </p>
              ) : (
                activity.map((project) => {
                  const result = project.result;
                  const failure = isFailureStatus(result?.status);
                  const pass = isPassStatus(result?.status);

                  return (
                    <ActivityRow
                      key={String(project.id)}
                      icon={
                        failure
                          ? XCircle
                          : pass
                            ? CheckCircle2
                            : Clock3
                      }
                      title={
                        failure
                          ? "Verification failure detected"
                          : pass
                            ? "Verification passed"
                            : "Project awaiting verification"
                      }
                      detail={`${getProjectName(project)} · ${
                        result?.module || "RTL project"
                      }`}
                      time={formatDate(
                        project.updatedAt || project.createdAt
                      )}
                      tone={
                        failure
                          ? "red"
                          : pass
                            ? "green"
                            : "cyan"
                      }
                    />
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.018] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert
                size={14}
                className="text-amber-300"
              />

              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                Risk Monitor
              </h3>
            </div>

            <p className="mt-1 text-[9px] text-white/20">
              Current verification exposure
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-red-400/10 bg-red-400/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-[0.14em] text-white/20">
                  High
                </p>

                <p className="mt-2 font-mono text-xl text-red-300">
                  {stats.highRisk}
                </p>
              </div>

              <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-[0.14em] text-white/20">
                  Findings
                </p>

                <p className="mt-2 font-mono text-xl text-amber-300">
                  {stats.failures}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-[0.14em] text-white/20">
                  Verified
                </p>

                <p className="mt-2 font-mono text-xl text-emerald-300">
                  {stats.verified}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.15em] text-white/20">
                  Verification Coverage
                </span>

                <span className="font-mono text-[9px] text-white/35">
                  {stats.total
                    ? Math.round(
                        (stats.verified / stats.total) * 100
                      )
                    : 0}
                  %
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-cyan-300/60 transition-all"
                  style={{
                    width: `${
                      stats.total
                        ? Math.round(
                            (stats.verified / stats.total) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* SENTINEL PIPELINE */}
        <section className="mt-5 rounded-3xl border border-white/[0.07] bg-white/[0.018] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch
                  size={14}
                  className="text-cyan-300"
                />

                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
                  Sentinel Pipeline
                </h3>
              </div>

              <p className="mt-1 text-[9px] text-white/20">
                Run the verification campaign to execute the available
                testbench, classify failures, collect evidence, and continue
                into investigation.
              </p>
            </div>

            {latestProject && (
              <Link
                href={`/projects/${latestProject.id}/campaign`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-cyan-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/[0.12]"
              >
                FAILURE CAMPAIGN
                <ArrowRight size={11} />
              </Link>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2 overflow-x-auto lg:flex-row lg:items-center lg:gap-2">
            <PipelineStep
              label="RTL"
              active
            />

            <PipelineArrow />

            <PipelineStep
              label="VERILATOR"
              active
            />

            <PipelineArrow />

            {latestProject ? (
              <Link
                href={`/projects/${latestProject.id}/campaign`}
                className="rounded-xl"
              >
                <PipelineStep
                  label="FAILURE CAMPAIGN"
                  active
                />
              </Link>
            ) : (
              <PipelineStep
                label="FAILURE CAMPAIGN"
                active={false}
              />
            )}

            <PipelineArrow />

            <PipelineStep
              label="EVIDENCE"
              active={stats.failures > 0}
            />

            <PipelineArrow />

            <PipelineStep
              label="RISK"
              active={stats.highRisk > 0}
            />
          </div>
        </section>

        {/* LATEST PROJECT */}
        {latestProject && (
          <section className="mt-5 rounded-3xl border border-cyan-400/10 bg-cyan-400/[0.018] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-cyan-300/50">
                  Latest Verification Target
                </p>

                <h3 className="mt-2 text-lg font-semibold text-white/75">
                  {getProjectName(latestProject)}
                </h3>

                <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.15em] text-white/20">
                  ID {latestProject.id}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/projects/${latestProject.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45 transition hover:border-white/20 hover:text-white/70"
                >
                  Open Workstation
                  <ArrowRight size={12} />
                </Link>

                <Link
                  href={`/projects/${latestProject.id}/campaign`}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.1]"
                >
                  <FlaskConical size={12} />
                  Run Campaign
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* FOOTER */}
        <footer className="flex flex-col gap-2 border-t border-white/[0.05] py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Zap
              size={11}
              className="text-cyan-300/50"
            />

            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/15">
              Silicon Sentinel · Pre-Silicon Verification
            </span>
          </div>

          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/10">
            RTL → SIMULATION → CAMPAIGN → EVIDENCE → RISK
          </span>
        </footer>
      </div>
    </main>
  );
}