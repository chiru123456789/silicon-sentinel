import { NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type VerificationResult = {
  status?: string;
  risk?: string;
  module?: string;
  operation?: string;
  expected_result?: unknown;
  actual_result?: unknown;
  expected_carry?: unknown;
  actual_carry?: unknown;
  source_file?: string;
  source_line?: number;
  line?: number;
  [key: string]: unknown;
};

type ScenarioResult = {
  id: string;
  name: string;
  status: "PASS" | "FAILURE" | "BUILD_ERROR" | "SIMULATION_ERROR";
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

export async function POST(
  _request: Request,
  context: RouteContext
) {
  const campaignStartedAt = new Date().toISOString();

  try {
    const params = await context.params;
    const projectId = params.id;

    // ------------------------------------------------------------
    // 1. Validate project ID
    // ------------------------------------------------------------

    if (!projectId || !/^[0-9]+$/.test(projectId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid project ID.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // 2. Resolve project paths
    // ------------------------------------------------------------

    const projectDirectory = path.resolve(
      process.cwd(),
      "..",
      "engine",
      "projects",
      projectId
    );

    const rtlDirectory = path.join(
      projectDirectory,
      "rtl"
    );

    const testbenchDirectory = path.join(
      projectDirectory,
      "testbench"
    );

    const reportsDirectory = path.join(
      projectDirectory,
      "reports"
    );

    const waveformDirectory = path.join(
      projectDirectory,
      "waveforms"
    );

    // ------------------------------------------------------------
    // 3. Verify project exists
    // ------------------------------------------------------------

    try {
      await access(projectDirectory);
      await access(rtlDirectory);
      await access(testbenchDirectory);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Project files were not found.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------------------------
    // 4. Discover actual project testbench
    // ------------------------------------------------------------

    const testbenchEntries = await import(
      "fs/promises"
    ).then((fs) =>
      fs.readdir(testbenchDirectory, {
        withFileTypes: true,
      })
    );

    const testbenchFile = testbenchEntries.find(
      (entry) =>
        entry.isFile() &&
        /\.(sv|v|svh|vh)$/i.test(entry.name)
    );

    const testbenchName =
      testbenchFile?.name ||
      "Default Testbench";

    // ------------------------------------------------------------
    // 5. Campaign #001
    // ------------------------------------------------------------

    const campaignId = "CAMPAIGN-001";
    const scenarioId = "SCENARIO-001";

    const scenarioStartedAt =
      new Date().toISOString();

    console.log(
      "======================================"
    );

    console.log(
      "SILICON SENTINEL FAILURE CAMPAIGN"
    );

    console.log(
      "======================================"
    );

    console.log(
      "Campaign:",
      campaignId
    );

    console.log(
      "Project ID:",
      projectId
    );

    console.log(
      "Scenario:",
      scenarioId
    );

    console.log(
      "Testbench:",
      testbenchName
    );

    // ------------------------------------------------------------
    // 6. Execute the existing verification engine
    //
    // We intentionally call the existing run API instead of
    // duplicating Sentinel/Verilator execution logic here.
    // ------------------------------------------------------------

    const origin =
      new URL(
        _request.url
      ).origin;

    const runUrl =
      `${origin}/api/projects/${projectId}/run`;

    let runResponse: Response;

    try {
      runResponse = await fetch(
        runUrl,
        {
          method: "POST",
          cache: "no-store",
        }
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown execution error.";

      const scenarioCompletedAt =
        new Date().toISOString();

      const scenario: ScenarioResult = {
        id: scenarioId,
        name: testbenchName,
        status: "SIMULATION_ERROR",
        startedAt: scenarioStartedAt,
        completedAt: scenarioCompletedAt,

        execution: {
          status: "SIMULATION_ERROR",
          output: "",
          details: message,
        },

        failure: {
          detected: false,
          risk: null,
          module: null,
          operation: null,
          expected: null,
          actual: null,
        },

        sourceMapping: {
          file: null,
          line: null,
        },

        artifacts: {
          report: `projects/${projectId}/reports/failure.json`,
          simulationLog: `projects/${projectId}/reports/simulation.log`,
          reportMarkdown: `projects/${projectId}/reports/report.md`,
          waveform: `projects/${projectId}/waveforms/alu.vcd`,
        },
      };

      return NextResponse.json(
        {
          success: true,
          campaign: {
            id: campaignId,
            projectId,
            startedAt: campaignStartedAt,
            completedAt: scenarioCompletedAt,

            totalScenarios: 1,
            passed: 0,
            failed: 0,
            buildFailures: 0,
            simulationErrors: 1,

            scenarios: [scenario],
          },
        },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------
    // 7. Parse run response
    // ------------------------------------------------------------

    let runData: {
      success?: boolean;
      result?: VerificationResult;
      output?: string;
      details?: string;
      artifacts?: {
        report?: string;
        simulationLog?: string;
        reportMarkdown?: string;
        waveform?: string;
      };
      error?: string;
    };

    try {
      runData =
        await runResponse.json();
    } catch {
      runData = {
        success: false,
        error:
          "Verification engine returned invalid JSON.",
      };
    }

    const scenarioCompletedAt =
      new Date().toISOString();

    // ------------------------------------------------------------
    // 8. Determine real scenario status
    // ------------------------------------------------------------

    let scenarioStatus:
      | "PASS"
      | "FAILURE"
      | "BUILD_ERROR"
      | "SIMULATION_ERROR";

    if (!runData.success) {
      const details =
        (
          runData.details ||
          runData.error ||
          ""
        ).toLowerCase();

      if (
        details.includes("build") ||
        details.includes("compile") ||
        details.includes("syntax")
      ) {
        scenarioStatus =
          "BUILD_ERROR";
      } else {
        scenarioStatus =
          "SIMULATION_ERROR";
      }
    } else {
      const verificationStatus =
        String(
          runData.result?.status || ""
        ).toLowerCase();

      if (
        verificationStatus === "pass" ||
        verificationStatus === "passed" ||
        verificationStatus === "success"
      ) {
        scenarioStatus = "PASS";
      } else {
        scenarioStatus = "FAILURE";
      }
    }

    // ------------------------------------------------------------
    // 9. Extract real failure evidence
    // ------------------------------------------------------------

    const result =
      runData.result || {};

    const sourceFile =
      typeof result.source_file === "string"
        ? result.source_file
        : null;

    const sourceLine =
      typeof result.line === "number"
        ? result.line
        : typeof result.source_line === "number"
          ? result.source_line
          : null;

    const scenario: ScenarioResult = {
      id: scenarioId,

      name: testbenchName,

      status: scenarioStatus,

      startedAt: scenarioStartedAt,

      completedAt: scenarioCompletedAt,

      execution: {
        status:
          String(
            result.status ||
              scenarioStatus
          ),

        output:
          runData.output || "",

        details:
          runData.details ||
          runData.error ||
          "",
      },

      failure: {
        detected:
          scenarioStatus === "FAILURE",

        risk:
          typeof result.risk === "string"
            ? result.risk
            : null,

        module:
          typeof result.module === "string"
            ? result.module
            : null,

        operation:
          typeof result.operation === "string"
            ? result.operation
            : null,

        expected:
          result.expected_result ??
          result.expected_carry ??
          null,

        actual:
          result.actual_result ??
          result.actual_carry ??
          null,
      },

      sourceMapping: {
        file: sourceFile,
        line: sourceLine,
      },

      artifacts: {
        report:
          runData.artifacts?.report ||
          `projects/${projectId}/reports/failure.json`,

        simulationLog:
          runData.artifacts?.simulationLog ||
          `projects/${projectId}/reports/simulation.log`,

        reportMarkdown:
          runData.artifacts?.reportMarkdown ||
          `projects/${projectId}/reports/report.md`,

        waveform:
          runData.artifacts?.waveform ||
          `projects/${projectId}/waveforms/alu.vcd`,
      },
    };

    // ------------------------------------------------------------
    // 10. Campaign statistics
    // ------------------------------------------------------------

    const passed =
      scenario.status === "PASS"
        ? 1
        : 0;

    const failed =
      scenario.status === "FAILURE"
        ? 1
        : 0;

    const buildFailures =
      scenario.status === "BUILD_ERROR"
        ? 1
        : 0;

    const simulationErrors =
      scenario.status ===
      "SIMULATION_ERROR"
        ? 1
        : 0;

    // ------------------------------------------------------------
    // 11. Final campaign object
    // ------------------------------------------------------------

    const campaignCompletedAt =
      new Date().toISOString();

    const campaign = {
      id: campaignId,

      projectId,

      name: "ALU VERIFICATION",

      startedAt:
        campaignStartedAt,

      completedAt:
        campaignCompletedAt,

      totalScenarios: 1,

      passed,

      failed,

      buildFailures,

      simulationErrors,

      status:
        failed > 0
          ? "FAILURE"
          : buildFailures > 0
            ? "BUILD_ERROR"
            : simulationErrors > 0
              ? "SIMULATION_ERROR"
              : "PASS",

      scenarios: [
        scenario,
      ],
    };

    console.log(
      "Campaign completed."
    );

    console.log(
      "Status:",
      campaign.status
    );

    console.log(
      "Passed:",
      passed
    );

    console.log(
      "Failed:",
      failed
    );

    console.log(
      "Build failures:",
      buildFailures
    );

    console.log(
      "Simulation errors:",
      simulationErrors
    );

    // ------------------------------------------------------------
    // 12. Return campaign
    // ------------------------------------------------------------

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error: unknown) {
    console.error(
      "Campaign API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to execute verification campaign.",
      },
      { status: 500 }
    );
  }
}