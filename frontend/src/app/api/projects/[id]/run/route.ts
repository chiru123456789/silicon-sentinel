import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, access } from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ExecError = {
  stdout?: string;
  stderr?: string;
  message?: string;
};

export async function POST(
  _request: Request,
  context: RouteContext
) {
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
    // 2. Resolve project directories
    // ------------------------------------------------------------

    const engineDirectory = path.resolve(
      process.cwd(),
      "..",
      "engine"
    );

    const projectDirectory = path.join(
      engineDirectory,
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
    // 4. Convert Windows engine path → WSL path
    // ------------------------------------------------------------

    const windowsProjectRoot = path.resolve(
      process.cwd(),
      ".."
    );

    const driveLetter = windowsProjectRoot
      .substring(0, 1)
      .toLowerCase();

    const remainingPath = windowsProjectRoot
      .substring(2)
      .replace(/\\/g, "/");

    const wslProjectRoot =
      "/mnt/" +
      driveLetter +
      remainingPath;

    // ------------------------------------------------------------
    // 5. Execute Silicon Sentinel
    // ------------------------------------------------------------

    const pythonScript = "engine/sentinel.py";

    const shellCommand =
      "cd " +
      JSON.stringify(wslProjectRoot) +
      " && python3 " +
      pythonScript +
      " " +
      JSON.stringify(projectId);

    console.log(
      "======================================"
    );

    console.log(
      "SILICON SENTINEL API RUN"
    );

    console.log(
      "======================================"
    );

    console.log(
      "Project ID:",
      projectId
    );

    console.log(
      "Project directory:",
      projectDirectory
    );

    console.log(
      "WSL root:",
      wslProjectRoot
    );

    console.log(
      "Command:",
      shellCommand
    );

    let output = "";
    let errorOutput = "";

    try {
      const execution =
        await execFileAsync(
          "wsl",
          [
            "bash",
            "-lc",
            shellCommand,
          ],
          {
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
          }
        );

      output =
        execution.stdout || "";

      errorOutput =
        execution.stderr || "";
    } catch (error: unknown) {
      const executionError =
        error as ExecError;

      output =
        executionError.stdout || "";

      errorOutput =
        executionError.stderr || "";

      console.error(
        "Sentinel execution failed:"
      );

      console.error(
        errorOutput ||
          output ||
          executionError.message ||
          "Unknown execution error."
      );

      return NextResponse.json(
        {
          success: false,
          projectId,
          error:
            "Silicon Sentinel execution failed.",
          output,
          details:
            errorOutput ||
            executionError.message ||
            "Unknown execution error.",
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // 6. Read THIS PROJECT'S verification report
    // ------------------------------------------------------------

    const reportPath = path.join(
      reportsDirectory,
      "failure.json"
    );

    try {
      const reportText =
        await readFile(
          reportPath,
          "utf-8"
        );

      const result =
        JSON.parse(reportText);

      console.log(
        "Sentinel execution completed."
      );

      console.log(
        "Verification result:",
        result.status
      );

      console.log(
        "Risk:",
        result.risk
      );

      // ----------------------------------------------------------
      // 7. Return execution + artifact metadata
      // ----------------------------------------------------------

      return NextResponse.json({
        success: true,

        projectId,

        result,

        output,

        details: errorOutput,

        artifacts: {
          report: `projects/${projectId}/reports/failure.json`,
          simulationLog: `projects/${projectId}/reports/simulation.log`,
          reportMarkdown: `projects/${projectId}/reports/report.md`,
          waveform: `projects/${projectId}/waveforms/alu.vcd`,
        },

        paths: {
          project: projectDirectory,
          reports: reportsDirectory,
          waveforms: waveformDirectory,
        },
      });
    } catch (error: unknown) {
      console.error(
        "Could not read project failure.json:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          projectId,

          error:
            "Sentinel completed, but the project failure.json could not be read.",

          output,

          details:
            errorOutput,

          reportPath,
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error(
      "Run API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to run Silicon Sentinel.",
      },
      { status: 500 }
    );
  }
}