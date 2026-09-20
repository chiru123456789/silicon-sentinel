"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  GitBranch,
  Play,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Waves,
  XCircle,
  Zap,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Project = {
  id: string;
  name: string;
  rtl: string;
  testbench: string;
  createdAt: string;
};

type SourceMapping = {
  file?: string;
  line?: number | null;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reason?: string;
};

type VerificationResult = {
  id?: string;
  project_id?: string;
  status?: string;
  risk?: string;
  module?: string;
  operation?: string;

  input_a?: string;
  input_b?: string;

  expected_result?: string;
  expected_carry?: number | string;

  actual_result?: string;
  actual_carry?: number | string;

  failure_message?: string;

  line?: number;
  sourceFile?: string;
  sourceExcerpt?: string[] | null;
  sourceMapping?: SourceMapping | null;
  architecture?: unknown;

  [key: string]: unknown;
};

type ProjectResponse = {
  projects?: Project[];
};

type FailureLocation = {
  line: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reason: string;
};

type RtlPort = {
  direction: "input" | "output" | "inout";
  name: string;
  width: string;
};

type RtlModule = {
  name: string;
  ports: RtlPort[];
  instances: string[];
  declarations: string[];
};

type ArchitectureConnection = {
  source: string;
  target: string;
  type: "input" | "output" | "instance";
};

type VcdValue = {
  time: number;
  value: string;
};

type VcdSignal = {
  id: string;
  name: string;
  width: number;
  scope: string;
  values: VcdValue[];
};

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function ProjectInvestigationPage() {
  const params = useParams();
  const router = useRouter();

  const projectId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [project, setProject] = useState<Project | null>(null);
  const [result, setResult] =
    useState<VerificationResult | null>(null);

  const [rtlCode, setRtlCode] = useState("");
  const [testbenchCode, setTestbenchCode] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [activeFile, setActiveFile] =
    useState<"rtl" | "testbench">("rtl");

  const [showRtl, setShowRtl] = useState(true);
  const [showTb, setShowTb] = useState(true);

  async function loadProject() {
    if (!projectId) return;

    try {
      setLoading(true);
      setError("");

      const projectResponse = await fetch(
        "/api/projects",
        {
          cache: "no-store",
        }
      );

      if (!projectResponse.ok) {
        throw new Error(
          "Could not load projects."
        );
      }

      const projectsData =
        (await projectResponse.json()) as ProjectResponse;

      const currentProject =
        projectsData.projects?.find(
          (item) => item.id === projectId
        ) ?? null;

      if (!currentProject) {
        throw new Error("Project not found.");
      }

      setProject(currentProject);

      const resultResponse = await fetch(
        `/api/projects/${projectId}/result`,
        {
          cache: "no-store",
        }
      );

      if (resultResponse.ok) {
        const rawResult =
          await resultResponse.json();

        if (
          rawResult &&
          typeof rawResult === "object" &&
          !rawResult.error
        ) {
          setResult(
            normalizeVerificationResult(
              rawResult as Record<string, unknown>
            )
          );
        } else {
          setResult(null);
        }
      } else {
        setResult(null);
      }

      const filesResponse = await fetch(
        `/api/projects/${projectId}/files`,
        {
          cache: "no-store",
        }
      );

      if (filesResponse.ok) {
        const filesData =
          await filesResponse.json();

        /*
         * The current files API returns:
         *
         * {
         *   rtl: "...",
         *   testbench: "..."
         * }
         *
         * Keep this compatible with that response.
         */
        setRtlCode(
          typeof filesData.rtl === "string"
            ? filesData.rtl
            : ""
        );

        setTestbenchCode(
          typeof filesData.testbench ===
            "string"
            ? filesData.testbench
            : ""
        );
      }
    } catch (loadError) {
      console.error(loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load project."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runVerification() {
    if (!projectId || running) return;

    try {
      setRunning(true);
      setError("");

      const response = await fetch(
        `/api/projects/${projectId}/run`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Verification failed to execute."
        );
      }

      if (
        data.result &&
        typeof data.result === "object"
      ) {
        setResult(
          normalizeVerificationResult(
            data.result as Record<string, unknown>
          )
        );
      }

      await loadProject();
    } catch (runError) {
      console.error(runError);

      setError(
        runError instanceof Error
          ? runError.message
          : "Verification failed."
      );
    } finally {
      setRunning(false);
    }
  }

  function openArtifact(
    artifact: "failure" | "vcd"
  ) {
    if (!projectId) return;

    const relativePath =
      artifact === "failure"
        ? "reports/failure.json"
        : "waveforms/alu.vcd";

    const url =
      `/api/projects/${projectId}/files?file=` +
      encodeURIComponent(relativePath);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadArtifact(
    artifact: "failure" | "vcd"
  ) {
    if (!projectId) return;

    const relativePath =
      artifact === "failure"
        ? "reports/failure.json"
        : "waveforms/alu.vcd";

    const url =
      `/api/projects/${projectId}/files?file=` +
      encodeURIComponent(relativePath) +
      "&download=1";

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  useEffect(() => {
    void loadProject();
  }, [projectId]);

  const activeCode =
    activeFile === "rtl"
      ? rtlCode
      : testbenchCode;

  const codeLines = useMemo(
    () => activeCode.split(/\r?\n/),
    [activeCode]
  );

  const explicitFailureLine =
    result?.line && result.line > 0
      ? result.line
      : 0;

  const inferredFailureLocation =
    !explicitFailureLine && result
      ? findFailureLocation(
          rtlCode,
          result
        )
      : {
          line: 0,
          confidence: "NONE" as const,
          reason:
            "No source location supplied by the verification result.",
        };

  const failureLine =
    explicitFailureLine ||
    inferredFailureLocation.line;

  const sourceMappingConfidence =
    result?.sourceMapping?.confidence ||
    (explicitFailureLine
      ? "HIGH"
      : inferredFailureLocation.confidence);

  const sourceMappingReason =
    result?.sourceMapping?.reason ||
    (explicitFailureLine
      ? "Verification engine supplied an explicit RTL source line."
      : inferredFailureLocation.reason);

  const sourceMappingFile =
    result?.sourceMapping?.file ||
    result?.sourceFile ||
    project?.rtl ||
    "RTL";

  const status =
    String(
      result?.status ?? "NOT RUN"
    ).toUpperCase();

  const risk =
    String(
      result?.risk ?? "UNKNOWN"
    ).toUpperCase();

  const isFailure =
    status === "FAILURE" ||
    status === "FAILED" ||
    status === "FAIL";

  const isSuccess =
    status === "PASS" ||
    status === "PASSED" ||
    status === "SUCCESS";

  const failingModule =
    String(
      result?.module ?? ""
    )
      .trim()
      .toLowerCase();

  const architecture = useMemo(
    () =>
      parseRtlArchitecture(rtlCode),
    [rtlCode]
  );

  const architecturePrimary =
    architecture.modules.find(
      (module) =>
        module.name.toLowerCase() ===
        failingModule
    ) ||
    architecture.modules[0] ||
    null;

  const architectureConnections =
    buildArchitectureConnections(
      architecturePrimary
    );

  const moduleIsFailure =
    Boolean(
      isFailure &&
        failingModule &&
        architecture.modules.some(
          (module) =>
            module.name.toLowerCase() ===
            failingModule
        )
    );

  const expectedResult =
    getResultValue(
      result,
      [
        "expected_result",
        "expectedResult",
        "expected",
      ]
    );

  const actualResult =
    getResultValue(
      result,
      [
        "actual_result",
        "actualResult",
        "actual",
      ]
    );

  const expectedCarry =
    getResultValue(
      result,
      [
        "expected_carry",
        "expectedCarry",
      ]
    );

  const actualCarry =
    getResultValue(
      result,
      [
        "actual_carry",
        "actualCarry",
      ]
    );

  const inputA =
    getResultValue(
      result,
      [
        "input_a",
        "inputA",
        "a",
      ]
    );

  const inputB =
    getResultValue(
      result,
      [
        "input_b",
        "inputB",
        "b",
      ]
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RefreshCw
              className="animate-spin"
              size={16}
            />
            Loading verification workspace...
          </div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="w-full border border-red-500/20 bg-[#0b0e13] p-8">
            <div className="mb-4 flex items-center gap-3 text-red-400">
              <XCircle size={20} />

              <span className="font-mono text-sm uppercase tracking-[0.2em]">
                Project unavailable
              </span>
            </div>

            <p className="text-slate-400">
              {error ||
                "The requested project could not be loaded."}
            </p>

            <button
              onClick={() =>
                router.push("/")
              }
              className="mt-6 inline-flex items-center gap-2 border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
            >
              <ArrowLeft size={15} />
              Back to command center
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-slate-200">
      {/* ------------------------------------------------------------------ */}
      {/* TOP COMMAND BAR                                                    */}
      {/* ------------------------------------------------------------------ */}

      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080a0e]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() =>
                router.push("/")
              }
              className="flex h-8 w-8 items-center justify-center border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"
              title="Back"
            >
              <ArrowLeft size={15} />
            </button>

            <div className="h-5 w-px bg-white/10" />

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">
                <Cpu size={16} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    {project.name}
                  </span>

                  <span className="font-mono text-[10px] text-slate-600">
                    /
                  </span>

                  <span className="font-mono text-[10px] text-slate-500">
                    {project.id}
                  </span>
                </div>

                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
                  Silicon Sentinel / Verification Workstation
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-4 md:flex">
              <StatusDot
                label="ENGINE"
                value="ONLINE"
                active
              />

              <StatusDot
                label="SIMULATOR"
                value="VERILATOR"
                active
              />

              <StatusDot
                label="RTL"
                value="LOADED"
                active
              />
            </div>

            <button
              onClick={runVerification}
              disabled={running}
              className="flex items-center gap-2 border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-50"
            >
              {running ? (
                <RefreshCw
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <Play size={13} />
              )}

              {running
                ? "Executing..."
                : "Run Verification"}
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* STATUS STRIP                                                       */}
      {/* ------------------------------------------------------------------ */}

      <div className="border-b border-white/[0.06] bg-[#0a0d12]">
        <div className="flex min-h-10 items-center justify-between gap-4 overflow-x-auto px-5">
          <div className="flex items-center gap-6 whitespace-nowrap">
            <div className="flex items-center gap-2">
              {isFailure ? (
                <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]" />
              ) : isSuccess ? (
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-600" />
              )}

              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                STATUS
              </span>

              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
                  isFailure
                    ? "text-red-300"
                    : isSuccess
                      ? "text-emerald-300"
                      : "text-slate-400"
                }`}
              >
                {status}
              </span>
            </div>

            <div className="h-3 w-px bg-white/10" />

            <Metric
              label="RISK"
              value={risk}
              danger={risk === "HIGH"}
            />

            <Metric
              label="MODULE"
              value={
                String(
                  result?.module ?? "—"
                )
              }
              danger={moduleIsFailure}
            />

            <Metric
              label="OPERATION"
              value={
                String(
                  result?.operation ?? "—"
                )
              }
            />

            {isFailure &&
              failureLine > 0 && (
                <>
                  <div className="h-3 w-px bg-white/10" />

                  <Metric
                    label="RTL LINE"
                    value={`:${failureLine}`}
                    danger
                  />
                </>
              )}
          </div>

          <div className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600 lg:flex">
            <GitBranch size={12} />
            PRE-SILICON / RTL
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* WORKSTATION                                                        */}
      {/* ------------------------------------------------------------------ */}

      <section className="grid min-h-[calc(100vh-96px)] grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_390px]">
        {/* ---------------------------------------------------------------- */}
        {/* FILE EXPLORER                                                    */}
        {/* ---------------------------------------------------------------- */}

        <aside className="border-r border-white/[0.07] bg-[#090c11]">
          <div className="flex h-10 items-center border-b border-white/[0.06] px-4">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Explorer
            </span>
          </div>

          <div className="p-3 font-mono text-[10px]">
            <button
              onClick={() =>
                setShowRtl(!showRtl)
              }
              className="flex w-full items-center gap-1 py-2 text-left text-slate-400 hover:text-white"
            >
              {showRtl ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}

              <span>rtl</span>
            </button>

            {showRtl && (
              <button
                onClick={() =>
                  setActiveFile("rtl")
                }
                className={`ml-4 flex w-[calc(100%-1rem)] items-center gap-2 border-l px-3 py-2 text-left transition ${
                  activeFile === "rtl"
                    ? "border-cyan-400 bg-cyan-400/5 text-cyan-200"
                    : "border-white/5 text-slate-500 hover:text-slate-300"
                }`}
              >
                <FileCode2 size={13} />
                {project.rtl}
              </button>
            )}

            <button
              onClick={() =>
                setShowTb(!showTb)
              }
              className="mt-2 flex w-full items-center gap-1 py-2 text-left text-slate-400 hover:text-white"
            >
              {showTb ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}

              <span>testbench</span>
            </button>

            {showTb && (
              <button
                onClick={() =>
                  setActiveFile("testbench")
                }
                className={`ml-4 flex w-[calc(100%-1rem)] items-center gap-2 border-l px-3 py-2 text-left transition ${
                  activeFile === "testbench"
                    ? "border-purple-400 bg-purple-400/5 text-purple-200"
                    : "border-white/5 text-slate-500 hover:text-slate-300"
                }`}
              >
                <Terminal size={13} />
                {project.testbench}
              </button>
            )}

            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <div className="mb-2 px-2 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                Reports
              </div>

              <button
                type="button"
                onClick={() =>
                  openArtifact("failure")
                }
                className="group flex w-full items-center gap-2 px-3 py-2 text-left text-slate-500 transition hover:bg-red-400/5 hover:text-red-300"
                title="Open generated reports/failure.json"
              >
                <FileJson
                  size={12}
                  className="shrink-0"
                />

                <span className="truncate">
                  failure.json
                </span>

                <ExternalLink
                  size={10}
                  className="ml-auto opacity-0 transition group-hover:opacity-100"
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  openArtifact("vcd")
                }
                className="group flex w-full items-center gap-2 px-3 py-2 text-left text-slate-500 transition hover:bg-purple-400/5 hover:text-purple-300"
                title="Open generated waveform VCD"
              >
                <Waves
                  size={12}
                  className="shrink-0"
                />

                <span className="truncate">
                  {project.rtl.replace(
                    /\.(sv|v)$/i,
                    ""
                  )}
                  .vcd
                </span>

                <ExternalLink
                  size={10}
                  className="ml-auto opacity-0 transition group-hover:opacity-100"
                />
              </button>

              <div className="mt-2 flex gap-1 px-3">
                <button
                  type="button"
                  onClick={() =>
                    downloadArtifact(
                      "failure"
                    )
                  }
                  className="flex flex-1 items-center justify-center gap-1 border border-white/[0.06] py-1.5 text-[8px] uppercase tracking-[0.08em] text-slate-600 transition hover:border-red-400/20 hover:text-red-300"
                  title="Download failure.json"
                >
                  <Download size={9} />
                  JSON
                </button>

                <button
                  type="button"
                  onClick={() =>
                    downloadArtifact("vcd")
                  }
                  className="flex flex-1 items-center justify-center gap-1 border border-white/[0.06] py-1.5 text-[8px] uppercase tracking-[0.08em] text-slate-600 transition hover:border-purple-400/20 hover:text-purple-300"
                  title="Download VCD"
                >
                  <Download size={9} />
                  VCD
                </button>
              </div>
            </div>

            <div className="mt-6 border border-white/[0.06] bg-[#0b0e14] p-3">
              <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.15em] text-slate-600">
                <ShieldAlert size={12} />
                Problems
              </div>

              <div className="flex items-center gap-2 text-red-300">
                <XCircle size={12} />
                {isFailure
                  ? "1 Error"
                  : "0 Errors"}
              </div>

              <div className="mt-1 flex items-center gap-2 text-amber-300">
                <AlertTriangle size={12} />
                {isFailure
                  ? "1 Risk Finding"
                  : "0 Findings"}
              </div>
            </div>
          </div>
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* CENTRAL ENGINEERING AREA                                         */}
        {/* ---------------------------------------------------------------- */}

        <section className="min-w-0 bg-[#080b10]">
          {/* EDITOR HEADER */}

          <div className="flex h-10 items-center justify-between border-b border-white/[0.06] bg-[#0b0e14]">
            <div className="flex h-full items-center">
              <div className="flex h-full items-center gap-2 border-r border-white/[0.06] border-t-2 border-t-cyan-400 bg-[#080b10] px-4 font-mono text-[10px] text-slate-200">
                <FileCode2
                  size={13}
                  className="text-cyan-300"
                />

                {activeFile === "rtl"
                  ? project.rtl
                  : project.testbench}
              </div>
            </div>

            <div className="flex items-center gap-4 px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
              <span>SystemVerilog</span>
              <span>UTF-8</span>
            </div>
          </div>

          {/* SOURCE MAPPING STATUS */}

          {isFailure && (
            <div className="flex min-h-9 items-center justify-between gap-3 border-b border-red-500/10 bg-red-500/[0.025] px-4">
              <div className="flex min-w-0 items-center gap-2">
                <CircleDot
                  size={11}
                  className="shrink-0 text-red-400"
                />

                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  Sentinel source mapping
                </span>

                {failureLine > 0 ? (
                  <span className="truncate font-mono text-[9px] text-red-300">
                    {sourceMappingFile}:
                    {failureLine}
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-slate-600">
                    UNRESOLVED
                  </span>
                )}
              </div>

              <div
                className={`shrink-0 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] ${
                  sourceMappingConfidence ===
                  "HIGH"
                    ? "text-emerald-300"
                    : sourceMappingConfidence ===
                        "MEDIUM"
                      ? "text-amber-300"
                      : sourceMappingConfidence ===
                          "LOW"
                        ? "text-orange-300"
                        : "text-slate-600"
                }`}
                title={sourceMappingReason}
              >
                {sourceMappingConfidence ===
                "NONE"
                  ? "UNMAPPED"
                  : `${sourceMappingConfidence} CONFIDENCE`}
              </div>
            </div>
          )}

          {/* CODE EDITOR */}

          <div className="h-[430px] overflow-auto border-b border-white/[0.07] bg-[#07090d]">
            {activeCode ? (
              <div className="min-w-[700px] py-3 font-mono text-[12px] leading-6">
                {codeLines.map(
                  (line, index) => {
                    const lineNumber =
                      index + 1;

                    const isFailureLine =
                      activeFile === "rtl" &&
                      failureLine ===
                        lineNumber;

                    return (
                      <div
                        key={lineNumber}
                        className={`group flex min-h-6 ${
                          isFailureLine
                            ? "bg-red-500/10"
                            : "hover:bg-white/[0.025]"
                        }`}
                        title={
                          isFailureLine
                            ? `Sentinel finding: ${sourceMappingReason}`
                            : undefined
                        }
                      >
                        <div
                          className={`sticky left-0 w-14 shrink-0 select-none border-r border-white/[0.04] pr-4 text-right ${
                            isFailureLine
                              ? "text-red-400"
                              : "text-slate-700"
                          }`}
                        >
                          {lineNumber}
                        </div>

                        <div
                          className={`relative whitespace-pre pl-5 pr-8 ${
                            isFailureLine
                              ? "text-red-100"
                              : "text-slate-400"
                          }`}
                        >
                          {isFailureLine && (
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-red-400">
                              <CircleDot
                                size={10}
                              />
                            </span>
                          )}

                          {highlightCode(
                            line,
                            isFailureLine
                          )}

                          {isFailureLine && (
                            <span className="ml-4 inline-flex items-center gap-2 border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-red-300">
                              SENTINEL FINDING
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <FileCode2
                    size={28}
                    className="mx-auto mb-3 text-slate-700"
                  />

                  <p className="font-mono text-xs text-slate-500">
                    Source view unavailable
                  </p>

                  <p className="mt-1 text-[10px] text-slate-700">
                    Run verification to
                    generate evidence.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* FAILURE EVIDENCE */}

          <div className="border-b border-white/[0.07] bg-[#090c11]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.05] px-4">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  size={13}
                  className={
                    isFailure
                      ? "text-red-400"
                      : "text-emerald-400"
                  }
                />

                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Failure Evidence
                </span>
              </div>

              <span className="font-mono text-[9px] text-slate-600">
                SOURCE OF TRUTH / SIMULATOR
              </span>
            </div>

            <div className="grid grid-cols-2 gap-px bg-white/[0.05] md:grid-cols-4">
              <EvidenceCell
                label="EXPECTED RESULT"
                value={
                  expectedResult ??
                  "—"
                }
              />

              <EvidenceCell
                label="ACTUAL RESULT"
                value={
                  actualResult ??
                  "—"
                }
                danger={isFailure}
              />

              <EvidenceCell
                label="EXPECTED CARRY"
                value={
                  expectedCarry ??
                  "—"
                }
              />

              <EvidenceCell
                label="ACTUAL CARRY"
                value={
                  actualCarry ??
                  "—"
                }
                danger={isFailure}
              />
            </div>
          </div>

          {/* SOURCE MAPPING */}

          {isFailure && (
            <div className="border-b border-red-500/10 bg-[#090c11] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center border border-red-400/20 bg-red-400/5 text-red-300">
                    <CircleDot size={13} />
                  </div>

                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                      RTL SOURCE MAPPING
                    </div>

                    <div className="mt-1 font-mono text-[10px] text-red-300">
                      {failureLine > 0
                        ? `${sourceMappingFile}:${failureLine}`
                        : "SOURCE LOCATION UNRESOLVED"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
                    CONFIDENCE
                  </div>

                  <div
                    className={`mt-1 font-mono text-[9px] font-semibold ${
                      sourceMappingConfidence ===
                      "HIGH"
                        ? "text-emerald-300"
                        : sourceMappingConfidence ===
                            "MEDIUM"
                          ? "text-amber-300"
                          : sourceMappingConfidence ===
                              "LOW"
                            ? "text-orange-300"
                            : "text-slate-400"
                    }`}
                  >
                    {sourceMappingConfidence}
                  </div>
                </div>
              </div>

              <div className="mt-2 font-mono text-[8px] text-slate-600">
                {sourceMappingReason}
              </div>
            </div>
          )}

          {/* WAVEFORM */}

          <div className="bg-[#07090d]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.05] px-4">
              <div className="flex items-center gap-2">
                <Waves
                  size={13}
                  className="text-purple-300"
                />

                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Waveform Evidence
                </span>
              </div>

              <span className="font-mono text-[9px] text-slate-600">
                VCD / SIGNAL VIEW
              </span>
            </div>

            <WaveformPanel
              result={result}
              projectId={projectId}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT MISSION CONTROL PANEL                                      */}
        {/* ---------------------------------------------------------------- */}

        <aside className="border-l border-white/[0.07] bg-[#090c11]">
          <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-4">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Silicon View
            </span>

            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-700">
              RTL DERIVED
            </span>
          </div>

          {/* STATUS */}

          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                Verification Status
              </span>

              <span className="font-mono text-[9px] text-slate-600">
                LIVE
              </span>
            </div>

            <div
              className={`border p-4 ${
                isFailure
                  ? "border-red-500/20 bg-red-500/5"
                  : isSuccess
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                {isFailure ? (
                  <div className="flex h-9 w-9 items-center justify-center border border-red-400/20 bg-red-400/10 text-red-300">
                    <AlertTriangle size={17} />
                  </div>
                ) : isSuccess ? (
                  <div className="flex h-9 w-9 items-center justify-center border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                    <CheckCircle2 size={17} />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/[0.02] text-slate-400">
                    <CircleDot size={17} />
                  </div>
                )}

                <div>
                  <div
                    className={`font-mono text-sm font-bold uppercase tracking-[0.12em] ${
                      isFailure
                        ? "text-red-300"
                        : isSuccess
                          ? "text-emerald-300"
                          : "text-slate-300"
                    }`}
                  >
                    {status}
                  </div>

                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
                    Risk classification: {risk}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RTL ARCHITECTURE */}

          <div className="border-b border-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Cpu
                  size={13}
                  className="text-cyan-300"
                />

                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  RTL Architecture
                </span>
              </div>

              <span className="font-mono text-[8px] text-cyan-400/50">
                {architecture.modules.length} MODULE
                {architecture.modules.length ===
                1
                  ? ""
                  : "S"}
              </span>
            </div>

            <div className="mx-4 mb-4 overflow-hidden border border-cyan-400/10 bg-[#06080c]">
              <div className="relative min-h-[330px]">
                <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:20px_20px]" />

                {architecturePrimary ? (
                  <div className="relative p-4">
                    <div className="grid grid-cols-[1fr_150px_1fr] items-center gap-2">
                      <div className="space-y-2">
                        {architecturePrimary.ports
                          .filter(
                            (port) =>
                              port.direction ===
                              "input"
                          )
                          .map((port) => (
                            <ArchitecturePort
                              key={`${port.direction}-${port.name}`}
                              port={port}
                              side="left"
                            />
                          ))}

                        {architecturePrimary.ports.filter(
                          (port) =>
                            port.direction ===
                            "input"
                        ).length === 0 && (
                          <EmptyArchitectureLabel text="NO INPUT PORTS" />
                        )}
                      </div>

                      <div className="relative flex min-h-[130px] items-center justify-center">
                        <div
                          className={`relative z-10 flex min-h-[110px] w-full flex-col items-center justify-center border px-3 text-center ${
                            moduleIsFailure
                              ? "border-red-400/40 bg-red-400/10 shadow-[0_0_35px_rgba(248,113,113,0.12)]"
                              : "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
                          }`}
                        >
                          <div className="mb-2 flex h-7 w-7 items-center justify-center border border-cyan-400/20 bg-cyan-400/5">
                            <Cpu
                              size={14}
                              className={
                                moduleIsFailure
                                  ? "text-red-300"
                                  : "text-cyan-300"
                              }
                            />
                          </div>

                          <span
                            className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                              moduleIsFailure
                                ? "text-red-200"
                                : "text-cyan-200"
                            }`}
                          >
                            {architecturePrimary.name}
                          </span>

                          <span className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-600">
                            RTL MODULE
                          </span>

                          {moduleIsFailure && (
                            <span className="mt-2 inline-flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.1em] text-red-300">
                              <CircleDot size={8} />
                              FAILURE
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {architecturePrimary.ports
                          .filter(
                            (port) =>
                              port.direction ===
                              "output"
                          )
                          .map((port) => (
                            <ArchitecturePort
                              key={`${port.direction}-${port.name}`}
                              port={port}
                              side="right"
                              danger={isFailurePort(
                                port.name,
                                result
                              )}
                            />
                          ))}

                        {architecturePrimary.ports.filter(
                          (port) =>
                            port.direction ===
                            "output"
                        ).length === 0 && (
                          <EmptyArchitectureLabel text="NO OUTPUT PORTS" />
                        )}
                      </div>
                    </div>

                    {architecturePrimary.ports.filter(
                      (port) =>
                        port.direction ===
                        "inout"
                    ).length > 0 && (
                      <div className="mt-3 border-t border-white/[0.05] pt-3">
                        <div className="mb-2 font-mono text-[7px] uppercase tracking-[0.15em] text-slate-700">
                          BIDIRECTIONAL
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {architecturePrimary.ports
                            .filter(
                              (port) =>
                                port.direction ===
                                "inout"
                            )
                            .map((port) => (
                              <ArchitecturePort
                                key={`${port.direction}-${port.name}`}
                                port={port}
                                side="bottom"
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {architecturePrimary.instances
                      .length > 0 && (
                      <div className="mt-4 border-t border-white/[0.05] pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[7px] uppercase tracking-[0.15em] text-slate-700">
                            INSTANTIATED BLOCKS
                          </span>

                          <span className="font-mono text-[7px] text-slate-700">
                            {
                              architecturePrimary
                                .instances
                                .length
                            }
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {architecturePrimary.instances.map(
                            (instance) => (
                              <div
                                key={instance}
                                className="border border-purple-400/15 bg-purple-400/5 px-2 py-1.5 font-mono text-[8px] uppercase text-purple-200"
                              >
                                {instance}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {architecturePrimary.declarations
                      .length > 0 && (
                      <div className="mt-4 border-t border-white/[0.05] pt-3">
                        <div className="mb-2 font-mono text-[7px] uppercase tracking-[0.15em] text-slate-700">
                          INTERNAL NETS
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {architecturePrimary.declarations
                            .slice(0, 12)
                            .map(
                              (declaration) => (
                                <span
                                  key={
                                    declaration
                                  }
                                  className="border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[7px] text-slate-500"
                                >
                                  {
                                    declaration
                                  }
                                </span>
                              )
                            )}
                        </div>
                      </div>
                    )}

                    {isFailure &&
                      failureLine > 0 && (
                        <div className="mt-4 flex items-center justify-center gap-2 border border-red-400/20 bg-red-400/5 px-3 py-2">
                          <CircleDot
                            size={10}
                            className="text-red-400"
                          />

                          <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-red-300">
                            FAILURE →{" "}
                            {sourceMappingFile}:
                            {failureLine}
                          </span>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="relative flex h-[330px] items-center justify-center p-6 text-center">
                    <div>
                      <Cpu
                        size={30}
                        className="mx-auto mb-3 text-slate-700"
                      />

                      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">
                        Architecture unavailable
                      </div>

                      <div className="mt-2 max-w-[220px] text-[10px] leading-5 text-slate-700">
                        Upload or load valid RTL
                        to derive the logical
                        architecture.
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-white/[0.05] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.15em] text-slate-700">
                  PARSED FROM ACTUAL RTL SOURCE
                </div>
              </div>
            </div>
          </div>

          {/* ARCHITECTURE CONNECTION SUMMARY */}

          {architectureConnections.length >
            0 && (
            <div className="border-b border-white/[0.06] px-4 py-3">
              <div className="mb-2 font-mono text-[7px] uppercase tracking-[0.15em] text-slate-700">
                RTL CONNECTIVITY
              </div>

              <div className="space-y-1">
                {architectureConnections
                  .slice(0, 8)
                  .map(
                    (
                      connection,
                      index
                    ) => (
                      <div
                        key={`${connection.source}-${connection.target}-${index}`}
                        className="flex items-center justify-between gap-2 font-mono text-[8px]"
                      >
                        <span
                          className={
                            connection.type ===
                            "output"
                              ? "text-cyan-300"
                              : connection.type ===
                                  "input"
                                ? "text-purple-300"
                                : "text-slate-400"
                          }
                        >
                          {
                            connection.source
                          }
                        </span>

                        <span className="text-slate-700">
                          →
                        </span>

                        <span className="text-slate-500">
                          {
                            connection.target
                          }
                        </span>
                      </div>
                    )
                  )}
              </div>
            </div>
          )}

          {/* FAILURE PATH */}

          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap
                size={13}
                className={
                  isFailure
                    ? "text-red-300"
                    : "text-amber-300"
                }
              />

              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Failure Path
              </span>
            </div>

            <div className="space-y-0">
              <PathNode
                label="INPUT"
                value={`${inputA ?? "—"} + ${
                  inputB ?? "—"
                }`}
              />

              <PathLine
                danger={isFailure}
              />

              <PathNode
                label="MODULE"
                value={
                  String(
                    result?.module ??
                      "—"
                  )
                }
                danger={isFailure}
              />

              <PathLine
                danger={isFailure}
              />

              <PathNode
                label="OPERATION"
                value={
                  String(
                    result?.operation ??
                      "—"
                  )
                }
              />

              <PathLine
                danger={isFailure}
              />

              <PathNode
                label="EXPECTED"
                value={
                  expectedCarry !== null &&
                  expectedCarry !== undefined
                    ? `CARRY = ${expectedCarry}`
                    : expectedResult !==
                        null &&
                      expectedResult !==
                        undefined
                      ? expectedResult
                      : "—"
                }
              />

              <PathLine
                danger={isFailure}
              />

              <PathNode
                label="ACTUAL"
                value={
                  actualCarry !== null &&
                  actualCarry !== undefined
                    ? `CARRY = ${actualCarry}`
                    : actualResult !==
                        null &&
                      actualResult !==
                        undefined
                      ? actualResult
                      : "—"
                }
                danger={isFailure}
              />

              {isFailure &&
                failureLine > 0 && (
                  <>
                    <PathLine danger />

                    <PathNode
                      label="RTL"
                      value={`${sourceMappingFile}:${failureLine}`}
                      danger
                    />
                  </>
                )}
            </div>
          </div>

          {/* FINDING */}

          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert
                size={13}
                className="text-red-300"
              />

              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sentinel Finding
              </span>
            </div>

            <div className="border border-red-500/15 bg-red-500/5 p-3">
              <div className="font-mono text-[10px] leading-5 text-slate-300">
                {formatEvidenceValue(
                  result?.failure_message ??
                    (isFailure
                      ? "Simulation evidence indicates a functional mismatch in the verified RTL."
                      : "No failure evidence recorded for this project.")
                )}
              </div>

              {isFailure && (
                <div className="mt-3 border-t border-red-500/10 pt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-red-300">
                  {String(
                    result?.module ??
                      "RTL"
                  )}
                  {" → "}
                  {String(
                    result?.operation ??
                      "verification"
                  )}
                  {" → "}
                  mismatch
                  {failureLine > 0
                    ? ` → line ${failureLine}`
                    : ""}
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

/* ========================================================================== */
/* RESULT NORMALIZATION                                                       */
/* ========================================================================== */

function normalizeVerificationResult(
  raw: Record<string, unknown>
): VerificationResult {
  const expected =
    raw.expected_result ??
    raw.expectedResult ??
    raw.expected;

  const actual =
    raw.actual_result ??
    raw.actualResult ??
    raw.actual;

  const expectedCarry =
    raw.expected_carry ??
    raw.expectedCarry ??
    getNestedValue(
      raw.expected,
      "carry"
    );

  const actualCarry =
    raw.actual_carry ??
    raw.actualCarry ??
    getNestedValue(
      raw.actual,
      "carry"
    );

  const inputA =
    raw.input_a ??
    raw.inputA ??
    raw.a ??
    getNestedValue(
      raw.inputs,
      "a"
    );

  const inputB =
    raw.input_b ??
    raw.inputB ??
    raw.b ??
    getNestedValue(
      raw.inputs,
      "b"
    );

  return {
    ...raw,

    expected_result:
      expected !== undefined &&
      expected !== null
        ? formatEvidenceValue(
            expected
          )
        : undefined,

    actual_result:
      actual !== undefined &&
      actual !== null
        ? formatEvidenceValue(
            actual
          )
        : undefined,

    expected_carry:
      expectedCarry !== undefined &&
      expectedCarry !== null
        ? formatEvidenceValue(
            expectedCarry
          )
        : undefined,

    actual_carry:
      actualCarry !== undefined &&
      actualCarry !== null
        ? formatEvidenceValue(
            actualCarry
          )
        : undefined,

    input_a:
      inputA !== undefined &&
      inputA !== null
        ? formatEvidenceValue(
            inputA
          )
        : undefined,

    input_b:
      inputB !== undefined &&
      inputB !== null
        ? formatEvidenceValue(
            inputB
          )
        : undefined,
  };
}

function getNestedValue(
  value: unknown,
  key: string
): unknown {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return undefined;
  }

  return (
    value as Record<string, unknown>
  )[key];
}

function formatEvidenceValue(
  value: unknown
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (
    typeof value === "bigint"
  ) {
    return value.toString();
  }

  if (
    typeof value === "object"
  ) {
    const objectValue =
      value as Record<
        string,
        unknown
      >;

    const preferredKeys = [
      "value",
      "result",
      "actual",
      "expected",
      "hex",
      "decimal",
      "binary",
      "bit",
    ];

    for (const key of preferredKeys) {
      if (
        objectValue[key] !==
          undefined &&
        objectValue[key] !== null
      ) {
        const nested =
          objectValue[key];

        if (
          typeof nested ===
            "object" &&
          nested !== null
        ) {
          return formatEvidenceValue(
            nested
          );
        }

        return String(nested);
      }
    }

    try {
      return JSON.stringify(
        value
      );
    } catch {
      return "—";
    }
  }

  return String(value);
}

function getResultValue(
  result: VerificationResult | null,
  keys: string[]
): string | null {
  if (!result) return null;

  for (const key of keys) {
    const value = result[key];

    if (
      value !== undefined &&
      value !== null
    ) {
      const formatted =
        formatEvidenceValue(
          value
        );

      if (
        formatted.trim() !== "" &&
        formatted !== "—"
      ) {
        return formatted;
      }
    }
  }

  return null;
}

/* ========================================================================== */
/* UI COMPONENTS                                                              */
/* ========================================================================== */

function StatusDot({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 font-mono text-[9px]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-emerald-400"
            : "bg-slate-700"
        }`}
      />

      <span className="text-slate-600">
        {label}
      </span>

      <span className="text-slate-400">
        {value}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[9px]">
      <span className="text-slate-600">
        {label}
      </span>

      <span
        className={
          danger
            ? "text-red-300"
            : "text-slate-400"
        }
      >
        {value}
      </span>
    </div>
  );
}

function EvidenceCell({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-[#090c11] p-4">
      <div className="mb-2 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">
        {label}
      </div>

      <div
        className={`break-words font-mono text-sm ${
          danger
            ? "text-red-300"
            : "text-slate-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PathNode({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border px-3 py-2 ${
        danger
          ? "border-red-400/20 bg-red-400/5"
          : "border-white/[0.05] bg-[#07090d]"
      }`}
    >
      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
        {label}
      </span>

      <span
        className={`break-words text-right font-mono text-[9px] ${
          danger
            ? "text-red-300"
            : "text-slate-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PathLine({
  danger = false,
}: {
  danger?: boolean;
}) {
  return (
    <div
      className={`ml-5 h-3 border-l ${
        danger
          ? "border-red-400/40"
          : "border-cyan-400/20"
      }`}
    />
  );
}

function ArchitecturePort({
  port,
  side,
  danger = false,
}: {
  port: RtlPort;
  side: "left" | "right" | "bottom";
  danger?: boolean;
}) {
  const isLeft = side === "left";
  const isRight = side === "right";

  return (
    <div
      className={`relative flex items-center ${
        isRight
          ? "justify-start"
          : "justify-end"
      }`}
    >
      {isRight && (
        <div
          className={`h-px w-3 ${
            danger
              ? "bg-red-400/60"
              : "bg-cyan-400/25"
          }`}
        />
      )}

      <div
        className={`min-w-0 border px-2 py-2 ${
          danger
            ? "border-red-400/35 bg-red-400/10"
            : "border-white/[0.07] bg-white/[0.025]"
        }`}
      >
        <div
          className={`font-mono text-[7px] uppercase ${
            danger
              ? "text-red-300"
              : "text-slate-400"
          }`}
        >
          {port.name}
        </div>

        <div className="mt-0.5 font-mono text-[6px] text-slate-700">
          {port.width}
        </div>
      </div>

      {isLeft && (
        <div
          className={`h-px w-3 ${
            danger
              ? "bg-red-400/60"
              : "bg-cyan-400/25"
          }`}
        />
      )}

      {side === "bottom" && (
        <div className="ml-2 h-px w-3 bg-purple-400/30" />
      )}
    </div>
  );
}

function EmptyArchitectureLabel({
  text,
}: {
  text: string;
}) {
  return (
    <div className="border border-dashed border-white/[0.05] px-2 py-2 text-right font-mono text-[7px] uppercase tracking-[0.1em] text-slate-700">
      {text}
    </div>
  );
}

/* ========================================================================== */
/* REAL VCD WAVEFORM                                                          */
/* ========================================================================== */

function WaveformPanel({
  result,
  projectId,
}: {
  result: VerificationResult | null;
  projectId: string;
}) {
  const [signals, setSignals] =
    useState<VcdSignal[]>([]);

  const [vcdLoading, setVcdLoading] =
    useState(true);

  const [vcdError, setVcdError] =
    useState("");

  const [vcdTimescale, setVcdTimescale] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVcd() {
      if (!projectId) {
        setVcdLoading(false);
        return;
      }

      try {
        setVcdLoading(true);
        setVcdError("");

        /*
         * The page expects the files endpoint to serve the generated VCD
         * when ?file=waveforms/alu.vcd is supplied.
         */
        const response = await fetch(
          `/api/projects/${projectId}/files?file=${encodeURIComponent(
            "waveforms/alu.vcd"
          )}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `VCD request failed (${response.status}).`
          );
        }

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        let text = "";

        if (
          contentType.includes(
            "application/json"
          )
        ) {
          const data =
            await response.json();

          if (
            typeof data ===
            "string"
          ) {
            text = data;
          } else if (
            data &&
            typeof data ===
              "object"
          ) {
            const candidate =
              data.content ??
              data.vcd ??
              data.data ??
              data.text;

            if (
              typeof candidate ===
              "string"
            ) {
              text = candidate;
            } else {
              throw new Error(
                "VCD endpoint returned JSON without VCD content."
              );
            }
          }
        } else {
          text =
            await response.text();
        }

        if (!text.trim()) {
          throw new Error(
            "The VCD file is empty."
          );
        }

        const parsed =
          parseVcd(text);

        if (!parsed.signals.length) {
          throw new Error(
            "No waveform signals were found in the VCD."
          );
        }

        if (!cancelled) {
          setSignals(
            parsed.signals
          );

          setVcdTimescale(
            parsed.timescale
          );
        }
      } catch (vcdLoadError) {
        console.error(
          "VCD loading failed:",
          vcdLoadError
        );

        if (!cancelled) {
          setSignals([]);
          setVcdTimescale("");
          setVcdError(
            vcdLoadError instanceof
              Error
              ? vcdLoadError.message
              : "Could not load VCD evidence."
          );
        }
      } finally {
        if (!cancelled) {
          setVcdLoading(false);
        }
      }
    }

    void loadVcd();

    return () => {
      cancelled = true;
    };
  }, [projectId, result?.id, result?.status]);

  const failure =
    String(
      result?.status ?? ""
    ).toUpperCase() ===
      "FAILURE" ||
    String(
      result?.status ?? ""
    ).toUpperCase() ===
      "FAILED" ||
    String(
      result?.status ?? ""
    ).toUpperCase() ===
      "FAIL";

  const maxTime = useMemo(
    () =>
      signals.reduce(
        (maximum, signal) => {
          const last =
            signal.values[
              signal.values.length - 1
            ]?.time ?? 0;

          return Math.max(
            maximum,
            last
          );
        },
        0
      ),
    [signals]
  );

  if (vcdLoading) {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.12em] text-slate-700">
          <span>
            Simulation evidence
          </span>

          <span>
            Reading generated VCD
          </span>
        </div>

        <div className="flex h-36 items-center justify-center border border-white/[0.06] bg-[#05070a]">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
            <RefreshCw
              size={12}
              className="animate-spin"
            />
            Parsing VCD waveform...
          </div>
        </div>
      </div>
    );
  }

  if (vcdError) {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.12em] text-slate-700">
          <span>
            Simulation evidence
          </span>

          <span>
            VCD unavailable
          </span>
        </div>

        <div className="border border-amber-400/10 bg-amber-400/[0.025] p-4">
          <div className="flex items-start gap-3">
            <Waves
              size={15}
              className="mt-0.5 shrink-0 text-amber-300"
            />

            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300">
                Real waveform unavailable
              </div>

              <div className="mt-2 font-mono text-[8px] leading-5 text-slate-600">
                {vcdError}
              </div>

              <div className="mt-3 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
                Open the generated VCD from Explorer
                to inspect the raw artifact.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-700">
        <div className="flex items-center gap-3">
          <span>
            Simulation evidence
          </span>

          <span className="text-purple-300/60">
            {signals.length} SIGNAL
            {signals.length === 1
              ? ""
              : "S"}
          </span>

          {vcdTimescale && (
            <span>
              TIMESCALE {vcdTimescale}
            </span>
          )}
        </div>

        <span>
          {failure
            ? "Mismatch highlighted"
            : "Captured simulator trace"}
        </span>
      </div>

      <div className="overflow-x-auto border border-white/[0.06] bg-[#05070a]">
        <div
          className="grid min-w-[720px] grid-cols-[110px_1fr] font-mono text-[9px]"
        >
          <div className="border-r border-white/[0.05]">
            {signals.map(
              (signal) => (
                <SignalLabel
                  key={signal.id}
                  name={signal.name}
                  width={signal.width}
                  scope={signal.scope}
                />
              )
            )}
          </div>

          <div className="relative">
            {signals.map(
              (signal) => (
                <VcdSignalRow
                  key={signal.id}
                  signal={signal}
                  maxTime={maxTime}
                  failure={failure}
                />
              )
            )}

            {signals.length > 0 && (
              <div
                className="pointer-events-none absolute left-[68%] top-0 z-20 h-full border-l border-red-400/30 border-dashed"
              >
                <div className="absolute left-2 top-2 whitespace-nowrap bg-[#05070a] px-1 text-[7px] uppercase tracking-[0.12em] text-red-300">
                  {failure
                    ? "verification point"
                    : "captured"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
        <span>
          VCD / REAL SIGNAL EVIDENCE
        </span>

        <span>
          {maxTime > 0
            ? `0 → ${maxTime}`
            : "TIME 0"}
        </span>
      </div>
    </div>
  );
}

function SignalLabel({
  name,
  width,
  scope,
}: {
  name: string;
  width: number;
  scope: string;
}) {
  return (
    <div
      className="flex h-10 items-center border-b border-white/[0.04] px-3"
      title={
        scope
          ? `${scope}.${name}`
          : name
      }
    >
      <div className="min-w-0">
        <div className="truncate text-slate-400">
          {name}
        </div>

        <div className="text-[6px] uppercase tracking-[0.1em] text-slate-700">
          {width > 1
            ? `${width}-BIT`
            : "1-BIT"}
        </div>
      </div>
    </div>
  );
}

function VcdSignalRow({
  signal,
  maxTime,
  failure,
}: {
  signal: VcdSignal;
  maxTime: number;
  failure: boolean;
}) {
  return (
    <div className="relative h-10 border-b border-white/[0.04]">
      <VcdTrace
        signal={signal}
        maxTime={maxTime}
        failure={failure}
      />
    </div>
  );
}

function VcdTrace({
  signal,
  maxTime,
  failure,
}: {
  signal: VcdSignal;
  maxTime: number;
  failure: boolean;
}) {
  const width = 900;
  const height = 40;

  const top =
    signal.width > 1
      ? 8
      : 9;

  const bottom =
    signal.width > 1
      ? 32
      : 30;

  const middle =
    (top + bottom) / 2;

  const values =
    signal.values.length > 0
      ? signal.values
      : [
          {
            time: 0,
            value: "x",
          },
        ];

  const points: Array<{
    x: number;
    y: number;
  }> = [];

  const labels: Array<{
    x: number;
    value: string;
  }> = [];

  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    const current =
      values[index];

    const next =
      values[index + 1];

    const currentTime =
      current.time;

    const nextTime =
      next?.time ??
      Math.max(
        currentTime + 1,
        maxTime
      );

    const x =
      maxTime > 0
        ? (currentTime /
            maxTime) *
          width
        : index === 0
          ? 0
          : (index /
              Math.max(
                values.length - 1,
                1
              )) *
            width;

    const nextX =
      maxTime > 0
        ? (nextTime /
            maxTime) *
          width
        : index ===
            values.length - 1
          ? width
          : ((index + 1) /
              Math.max(
                values.length - 1,
                1
              )) *
            width;

    const normalized =
      normalizeVcdValue(
        current.value
      );

    const y =
      signal.width > 1
        ? middle
        : normalized === "1"
          ? top
          : normalized === "0"
            ? bottom
            : middle;

    if (
      points.length === 0
    ) {
      points.push({
        x,
        y,
      });
    } else {
      const previous =
        points[
          points.length - 1
        ];

      points.push({
        x,
        y: previous.y,
      });

      points.push({
        x,
        y,
      });
    }

    labels.push({
      x:
        Math.max(
          0,
          Math.min(
            width - 50,
            x + 4
          )
        ),
      value:
        formatVcdDisplayValue(
          current.value
        ),
    });

    if (
      index ===
      values.length - 1
    ) {
      points.push({
        x: Math.max(
          x,
          Math.min(
            width,
            nextX
          )
        ),
        y,
      });
    }
  }

  const path =
    points
      .map(
        (
          point,
          index
        ) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(
            2
          )} ${point.y.toFixed(2)}`
      )
      .join(" ");

  const isBinary =
    signal.width === 1 &&
    values.every((item) =>
      /^[01xzXZ]$/.test(
        item.value
      )
    );

  return (
    <div className="relative h-full w-full">
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          className={
            failure
              ? "text-purple-300/70"
              : "text-cyan-300/60"
          }
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />

        {isBinary &&
          values.map(
            (
              value,
              index
            ) => {
              const x =
                maxTime > 0
                  ? (value.time /
                      maxTime) *
                    width
                  : 0;

              const normalized =
                normalizeVcdValue(
                  value.value
                );

              if (
                index === 0
              ) {
                return null;
              }

              return (
                <line
                  key={`${value.time}-${index}`}
                  x1={x}
                  x2={x}
                  y1={
                    normalized ===
                    "1"
                      ? top
                      : bottom
                  }
                  y2={
                    normalized ===
                    "1"
                      ? bottom
                      : top
                  }
                  stroke="currentColor"
                  className={
                    failure
                      ? "text-purple-300/70"
                      : "text-cyan-300/60"
                  }
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
          )}
      </svg>

      {signal.width > 1 &&
        labels
          .filter(
            (_, index) =>
              index <
              12
          )
          .map(
            (
              label,
              index
            ) => (
              <span
                key={`${label.x}-${index}`}
                className={`absolute top-[11px] max-w-[58px] truncate border px-1 text-[7px] ${
                  failure
                    ? "border-purple-400/20 bg-purple-400/5 text-purple-200"
                    : "border-cyan-400/15 bg-cyan-400/5 text-cyan-200"
                }`}
                style={{
                  left: `${(label.x / width) * 100}%`,
                }}
              >
                {label.value}
              </span>
            )
          )}

      {signal.width === 1 && (
        <span className="pointer-events-none absolute left-2 top-[13px] text-[7px] text-slate-700">
          {formatVcdDisplayValue(
            values[
              values.length - 1
            ]?.value ??
              "x"
          )}
        </span>
      )}
    </div>
  );
}

function normalizeVcdValue(
  value: string
): string {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized === "1" ||
    normalized ===
      "1'b1"
  ) {
    return "1";
  }

  if (
    normalized === "0" ||
    normalized ===
      "1'b0"
  ) {
    return "0";
  }

  return normalized;
}

function formatVcdDisplayValue(
  value: string
): string {
  const normalized =
    value.trim();

  if (
    normalized.startsWith("b") ||
    normalized.startsWith("B")
  ) {
    return normalized.slice(
      1
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* VCD PARSER                                                                */
/* -------------------------------------------------------------------------- */

function parseVcd(
  text: string
): {
  signals: VcdSignal[];
  timescale: string;
} {
  const normalized =
    text.replace(
      /\r\n/g,
      "\n"
    );

  const lines =
    normalized.split("\n");

  const signalMap =
    new Map<
      string,
      VcdSignal
    >();

  const scopeStack: string[] = [];

  let timescale = "";

  let inDefinitions =
    true;

  let currentTime = 0;

  let endDefinitionsIndex =
    -1;

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex++
  ) {
    const rawLine =
      lines[lineIndex];

    const line =
      rawLine.trim();

    if (!line) continue;

    if (
      line.startsWith(
        "$timescale"
      )
    ) {
      const timescaleLines: string[] =
        [];

      let cursor =
        lineIndex;

      while (
        cursor <
        lines.length
      ) {
        const current =
          lines[
            cursor
          ].trim();

        timescaleLines.push(
          current
        );

        if (
          current.includes(
            "$end"
          )
        ) {
          break;
        }

        cursor++;
      }

      const joined =
        timescaleLines.join(
          " "
        );

      timescale =
        joined
          .replace(
            /^\$timescale\s*/i,
            ""
          )
          .replace(
            /\$end.*$/i,
            ""
          )
          .trim();

      lineIndex = cursor;

      continue;
    }

    if (
      line.startsWith(
        "$scope"
      )
    ) {
      const match =
        line.match(
          /^\$scope\s+\w+\s+(.+?)\s+\$end/i
        );

      if (match?.[1]) {
        scopeStack.push(
          match[1].trim()
        );
      }

      continue;
    }

    if (
      line.startsWith(
        "$upscope"
      )
    ) {
      scopeStack.pop();
      continue;
    }

    if (
      line.startsWith(
        "$var"
      )
    ) {
      const match =
        line.match(
          /^\$var\s+\S+\s+(\d+)\s+(\S+)\s+(.+?)\s+\$end/i
        );

      if (match) {
        const width =
          Number(match[1]) ||
          1;

        const id =
          match[2];

        const rawName =
          match[3]
            .trim()
            .split(
              /\s+/
            )[0];

        const scope =
          scopeStack.join(
            "."
          );

        if (
          id &&
          rawName &&
          !signalMap.has(id)
        ) {
          signalMap.set(
            id,
            {
              id,
              name: rawName,
              width,
              scope,
              values: [],
            }
          );
        }
      }

      continue;
    }

    if (
      line.includes(
        "$enddefinitions"
      )
    ) {
      inDefinitions = false;
      endDefinitionsIndex =
        lineIndex;
      break;
    }
  }

  if (inDefinitions) {
    return {
      signals: [],
      timescale,
    };
  }

  /*
   * Parse value changes after $enddefinitions.
   *
   * Scalar:
   *   0!
   *   1!
   *   x!
   *
   * Vector:
   *   b1010 !
   */
  for (
    let index =
      endDefinitionsIndex + 1;
    index < lines.length;
    index++
  ) {
    const raw =
      lines[index].trim();

    if (!raw) continue;

    if (
      raw.startsWith("#")
    ) {
      const time =
        Number(
          raw.slice(1).trim()
        );

      if (
        Number.isFinite(
          time
        )
      ) {
        currentTime = time;
      }

      continue;
    }

    if (
      raw.startsWith("$")
    ) {
      continue;
    }

    if (
      raw.startsWith("b") ||
      raw.startsWith("B")
    ) {
      const match =
        raw.match(
          /^[bB]([01xXzZ]+)\s+(\S+)/
        );

      if (
        match
      ) {
        const value =
          match[1];

        const id =
          match[2];

        const signal =
          signalMap.get(
            id
          );

        if (signal) {
          pushVcdValue(
            signal,
            currentTime,
            value
          );
        }
      }

      continue;
    }

    const scalarMatch =
      raw.match(
        /^([01xXzZ])(\S+)$/
      );

    if (
      scalarMatch
    ) {
      const value =
        scalarMatch[1];

      const id =
        scalarMatch[2];

      const signal =
        signalMap.get(
          id
        );

      if (signal) {
        pushVcdValue(
          signal,
          currentTime,
          value
        );
      }
    }
  }

  const signals =
    Array.from(
      signalMap.values()
    )
      .filter(
        (signal) =>
          signal.values
            .length > 0
      )
      .sort(
        (a, b) => {
          const scopeCompare =
            a.scope.localeCompare(
              b.scope
            );

          if (
            scopeCompare !== 0
          ) {
            return scopeCompare;
          }

          return a.name.localeCompare(
            b.name
          );
        }
      );

  return {
    signals,
    timescale,
  };
}

function pushVcdValue(
  signal: VcdSignal,
  time: number,
  value: string
) {
  const previous =
    signal.values[
      signal.values.length - 1
    ];

  /*
   * VCD can contain repeated assignments
   * at the same timestamp. Keep the latest
   * value instead of creating useless
   * zero-width transitions.
   */
  if (
    previous &&
    previous.time === time
  ) {
    previous.value =
      value;

    return;
  }

  signal.values.push({
    time,
    value,
  });
}

/* ========================================================================== */
/* RTL PARSING                                                                */
/* ========================================================================== */

function parseRtlArchitecture(
  code: string
): {
  modules: RtlModule[];
} {
  if (!code.trim()) {
    return {
      modules: [],
    };
  }

  const modules: RtlModule[] =
    [];

  const moduleRegex =
    /\bmodule\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:#\s*\([^;]*\))?\s*\(([\s\S]*?)\)\s*;/g;

  for (const match of code.matchAll(
    moduleRegex
  )) {
    const moduleName =
      match[1];

    if (!moduleName) continue;

    const header =
      match[2] || "";

    const startIndex =
      match.index ?? 0;

    const endMatch =
      /\bendmodule\b/g;

    endMatch.lastIndex =
      startIndex +
      match[0].length;

    const end =
      endMatch.exec(
        code
      );

    const bodyEnd =
      end?.index ??
      code.length;

    const body =
      code.slice(
        startIndex +
          match[0].length,
        bodyEnd
      );

    modules.push({
      name: moduleName,
      ports:
        parsePorts(header),
      instances:
        parseInstances(body),
      declarations:
        parseDeclarations(body),
    });
  }

  if (
    modules.length ===
    0
  ) {
    const fallbackRegex =
      /\bmodule\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;

    for (const match of code.matchAll(
      fallbackRegex
    )) {
      const name =
        match[1];

      if (!name) continue;

      modules.push({
        name,
        ports: [],
        instances: [],
        declarations: [],
      });
    }
  }

  return {
    modules,
  };
}

function parsePorts(
  header: string
): RtlPort[] {
  const ports: RtlPort[] =
    [];

  const cleaned =
    header
      .replace(
        /\/\*[\s\S]*?\*\//g,
        " "
      )
      .replace(
        /\/\/.*$/gm,
        " "
      );

  const ansiRegex =
    /\b(input|output|inout)\b\s+(?:(?:wire|logic|reg|signed|unsigned)\s+)*(?:\[[^\]]+\]\s*)?([A-Za-z_][A-Za-z0-9_]*)/g;

  for (const match of cleaned.matchAll(
    ansiRegex
  )) {
    const direction =
      match[1] as
        | "input"
        | "output"
        | "inout";

    const fullMatch =
      match[0];

    const widthMatch =
      fullMatch.match(
        /\[([^\]]+)\]/
      );

    const name =
      match[2];

    if (!name) continue;

    ports.push({
      direction,
      name,
      width: widthMatch
        ? `[${widthMatch[1]}]`
        : "1-bit",
    });
  }

  return ports.filter(
    (port, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.name ===
          port.name
      ) === index
  );
}

function parseInstances(
  body: string
): string[] {
  const instances: string[] =
    [];

  const instanceRegex =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+(?:#\s*\([\s\S]*?\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;

  const blocked =
    new Set([
      "if",
      "for",
      "while",
      "case",
      "module",
      "function",
      "task",
      "always",
      "always_comb",
      "always_ff",
      "assign",
      "input",
      "output",
      "inout",
      "logic",
      "wire",
      "reg",
    ]);

  for (const match of body.matchAll(
    instanceRegex
  )) {
    const typeName =
      match[1];

    if (
      !typeName ||
      blocked.has(typeName)
    ) {
      continue;
    }

    if (
      !instances.includes(
        typeName
      )
    ) {
      instances.push(
        typeName
      );
    }
  }

  return instances;
}

function parseDeclarations(
  body: string
): string[] {
  const declarations: string[] =
    [];

  const declarationRegex =
    /\b(?:logic|wire|reg)\s+(?:\[[^\]]+\]\s*)?([^;]+);/g;

  for (const match of body.matchAll(
    declarationRegex
  )) {
    const declaration =
      match[1];

    if (!declaration)
      continue;

    const names =
      declaration
        .split(",")
        .map((value) =>
          value
            .trim()
            .replace(
              /=.*$/,
              ""
            )
            .trim()
        )
        .filter(Boolean);

    for (const name of names) {
      if (
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(
          name
        ) &&
        !declarations.includes(
          name
        )
      ) {
        declarations.push(
          name
        );
      }
    }
  }

  return declarations;
}

function buildArchitectureConnections(
  module: RtlModule | null
): ArchitectureConnection[] {
  if (!module) return [];

  const connections: ArchitectureConnection[] =
    [];

  for (const port of module.ports) {
    if (
      port.direction ===
      "input"
    ) {
      connections.push({
        source:
          port.name,
        target:
          module.name,
        type: "input",
      });
    }

    if (
      port.direction ===
      "output"
    ) {
      connections.push({
        source:
          module.name,
        target:
          port.name,
        type: "output",
      });
    }
  }

  for (const instance of module.instances) {
    connections.push({
      source:
        module.name,
      target:
        instance,
      type: "instance",
    });
  }

  return connections;
}

/* ========================================================================== */
/* SOURCE MAPPING                                                             */
/* ========================================================================== */

function findFailureLocation(
  code: string,
  result: VerificationResult
): FailureLocation {
  if (!code) {
    return {
      line: 0,
      confidence: "NONE",
      reason:
        "RTL source is empty.",
    };
  }

  const lines =
    code.split(/\r?\n/);

  const moduleRange =
    findModuleRange(
      lines,
      result.module
    );

  const scopedLines =
    lines.slice(
      moduleRange.start,
      moduleRange.end + 1
    );

  const expectedCarry =
    normalizeBit(
      result.expected_carry
    );

  const actualCarry =
    normalizeBit(
      result.actual_carry
    );

  if (
    expectedCarry !== null &&
    actualCarry !== null &&
    expectedCarry !==
      actualCarry
  ) {
    const expectedLiteral =
      expectedCarry === 1
        ? "1'b1"
        : "1'b0";

    const actualLiteral =
      actualCarry === 1
        ? "1'b1"
        : "1'b0";

    const carryCandidates =
      scopedLines
        .map(
          (
            line,
            index
          ) => ({
            line,
            index,
          })
        )
        .filter(
          ({
            line,
          }) =>
            /\bcarry\b/i.test(
              line
            ) &&
            /\b(?:1'b[01]|0|1)\b/.test(
              line
            )
        );

    const actualAssignment =
      carryCandidates.find(
        ({
          line,
        }) =>
          new RegExp(
            `\\bcarry\\s*=\\s*${escapeRegExp(
              actualLiteral
            )}\\b`,
            "i"
          ).test(line)
      );

    if (
      actualAssignment
    ) {
      return {
        line:
          moduleRange.start +
          actualAssignment.index +
          1,
        confidence:
          "HIGH",
        reason:
          `Mapped from carry mismatch: expected ${expectedLiteral}, actual ${actualLiteral}.`,
      };
    }

    const genericCarryAssignment =
      carryCandidates.find(
        ({
          line,
        }) =>
          /\bcarry\s*=/.test(
            line
          )
      );

    if (
      genericCarryAssignment
    ) {
      return {
        line:
          moduleRange.start +
          genericCarryAssignment.index +
          1,
        confidence:
          "MEDIUM",
        reason:
          "Mapped to the carry assignment associated with the reported failure.",
      };
    }
  }

  const operationCode =
    getOperationCode(
      result.operation
    );

  if (operationCode) {
    const operationIndex =
      scopedLines.findIndex(
        (line) =>
          new RegExp(
            `\\b${escapeRegExp(
              operationCode
            )}\\b`
          ).test(line)
      );

    if (
      operationIndex >=
      0
    ) {
      const operationEnd =
        Math.min(
          operationIndex +
            12,
          scopedLines.length
        );

      for (
        let index =
          operationIndex;
        index <
        operationEnd;
        index++
      ) {
        if (
          /\bcarry\s*=/.test(
            scopedLines[
              index
            ]
          )
        ) {
          return {
            line:
              moduleRange.start +
              index +
              1,
            confidence:
              "MEDIUM",
            reason:
              `Mapped to the carry assignment inside the ${result.operation} operation branch.`,
          };
        }
      }

      return {
        line:
          moduleRange.start +
          operationIndex +
          1,
        confidence:
          "LOW",
        reason:
          `Mapped to the ${result.operation} operation branch; no more specific assignment was found.`,
      };
    }
  }

  const carryAssignmentIndex =
    scopedLines.findIndex(
      (line) =>
        /\bcarry\s*=/.test(
          line
        )
    );

  if (
    carryAssignmentIndex >=
    0
  ) {
    return {
      line:
        moduleRange.start +
        carryAssignmentIndex +
        1,
      confidence:
        "LOW",
      reason:
        "Mapped to the first carry assignment in the reported module.",
    };
  }

  const resultAssignmentIndex =
    scopedLines.findIndex(
      (line) =>
        /\bresult\s*=/.test(
          line
        )
    );

  if (
    resultAssignmentIndex >=
    0
  ) {
    return {
      line:
        moduleRange.start +
        resultAssignmentIndex +
        1,
      confidence:
        "LOW",
      reason:
        "Mapped to the result assignment because no more specific failure line was found.",
    };
  }

  return {
    line: 0,
    confidence:
      "NONE",
    reason:
      "The available verification evidence could not be mapped confidently to an RTL line.",
  };
}

function normalizeBit(
  value?: unknown
): number | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    formatEvidenceValue(
      value
    )
      .trim()
      .toLowerCase();

  if (
    normalized === "1" ||
    normalized ===
      "1'b1"
  ) {
    return 1;
  }

  if (
    normalized === "0" ||
    normalized ===
      "1'b0"
  ) {
    return 0;
  }

  return null;
}

function getOperationCode(
  operation?: unknown
): string | null {
  if (!operation)
    return null;

  const normalized =
    String(operation)
      .trim()
      .toUpperCase();

  const operationMap: Record<
    string,
    string
  > = {
    ADD: "3'b000",
    SUB: "3'b001",
    AND: "3'b010",
    OR: "3'b011",
    XOR: "3'b100",
    NOT: "3'b101",
    SHL: "3'b110",
    SHR: "3'b111",
  };

  return (
    operationMap[
      normalized
    ] || null
  );
}

function findModuleRange(
  lines: string[],
  moduleName?: string
): {
  start: number;
  end: number;
} {
  if (!moduleName) {
    return {
      start: 0,
      end:
        lines.length - 1,
    };
  }

  const pattern =
    new RegExp(
      `\\bmodule\\s+${escapeRegExp(
        String(
          moduleName
        )
      )}\\b`
    );

  const start =
    lines.findIndex(
      (line) =>
        pattern.test(
          line
        )
    );

  if (start < 0) {
    return {
      start: 0,
      end:
        lines.length - 1,
    };
  }

  for (
    let index =
      start + 1;
    index <
    lines.length;
    index++
  ) {
    if (
      /\bendmodule\b/.test(
        lines[index]
      )
    ) {
      return {
        start,
        end: index,
      };
    }
  }

  return {
    start,
    end:
      lines.length - 1,
  };
}

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/* ========================================================================== */
/* CODE HIGHLIGHTING                                                          */
/* ========================================================================== */

function highlightCode(
  line: string,
  failure: boolean
) {
  const escaped =
    line
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      );

  const html =
    escaped
      .replace(
        /\b(module|endmodule|always_comb|always_ff|begin|end|case|endcase|if|else|assign)\b/g,
        '<span class="text-purple-300">$1</span>'
      )
      .replace(
        /\b(1'b0|1'b1|8'h[0-9a-fA-F]+|[0-9]+)\b/g,
        '<span class="text-amber-300">$1</span>'
      )
      .replace(
        /(\/\/.*)$/,
        '<span class="text-slate-600">$1</span>'
      );

  return (
    <span
      className={
        failure
          ? "text-red-100"
          : undefined
      }
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
}

/* ========================================================================== */
/* FAILURE PORT DETECTION                                                      */
/* ========================================================================== */

function isFailurePort(
  portName: string,
  result: VerificationResult | null
): boolean {
  if (!result)
    return false;

  const normalized =
    portName.toLowerCase();

  if (
    normalized ===
      "carry" ||
    normalized.includes(
      "carry"
    )
  ) {
    const expected =
      getResultValue(
        result,
        [
          "expected_carry",
          "expectedCarry",
        ]
      );

    const actual =
      getResultValue(
        result,
        [
          "actual_carry",
          "actualCarry",
        ]
      );

    return (
      expected !== null &&
      actual !== null &&
      normalizeBit(
        expected
      ) !==
        normalizeBit(
          actual
        )
    );
  }

  return false;
}