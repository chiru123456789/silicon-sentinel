import { NextResponse } from "next/server";
import {
  access,
  readFile,
  readdir,
  stat,
} from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProjectMetadata = {
  id: string;
  name: string;
  rtl: string;
  testbench: string;
  createdAt: string;
};

function isValidProjectId(projectId: string) {
  return /^[0-9]+$/.test(projectId);
}

function isVerilogFile(filename: string) {
  const lower = filename.toLowerCase();

  return (
    lower.endsWith(".sv") ||
    lower.endsWith(".v")
  );
}

/**
 * Resolve a project artifact safely.
 *
 * Only artifacts inside these directories are allowed:
 *
 *   reports/
 *   waveforms/
 *
 * This prevents paths such as:
 *
 *   ../../something
 *
 * from escaping the project directory.
 */
function resolveArtifactPath(
  projectDirectory: string,
  requestedFile: string
) {
  const normalized = requestedFile
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!normalized) {
    return null;
  }

  const parts = normalized.split("/");

  if (parts.length < 2) {
    return null;
  }

  const topLevel = parts[0];

  if (
    topLevel !== "reports" &&
    topLevel !== "waveforms"
  ) {
    return null;
  }

  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".."
    )
  ) {
    return null;
  }

  const artifactPath = path.resolve(
    projectDirectory,
    ...parts
  );

  const allowedDirectory = path.resolve(
    projectDirectory,
    topLevel
  );

  if (
    artifactPath !== allowedDirectory &&
    !artifactPath.startsWith(
      `${allowedDirectory}${path.sep}`
    )
  ) {
    return null;
  }

  return artifactPath;
}

function getArtifactContentType(
  filename: string
) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".vcd")) {
    return "text/plain; charset=utf-8";
  }

  if (lower.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (
    lower.endsWith(".md") ||
    lower.endsWith(".log") ||
    lower.endsWith(".txt")
  ) {
    return "text/plain; charset=utf-8";
  }

  return "application/octet-stream";
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const projectId = params.id;

    if (
      !projectId ||
      !isValidProjectId(projectId)
    ) {
      return NextResponse.json(
        {
          error: "Invalid project ID.",
        },
        { status: 400 }
      );
    }

    const projectDirectory = path.join(
      process.cwd(),
      "..",
      "engine",
      "projects",
      projectId
    );

    /*
     * ---------------------------------------------------------
     * ARTIFACT MODE
     * ---------------------------------------------------------
     *
     * Example:
     *
     * /api/projects/1789815774207/files?file=waveforms/alu.vcd
     *
     * This must return the actual VCD text, NOT the normal
     * project-source JSON response.
     */
    const url = new URL(request.url);
    const requestedFile =
      url.searchParams.get("file");

    if (requestedFile) {
      try {
        await access(projectDirectory);
      } catch {
        return NextResponse.json(
          {
            error:
              "Project was not found.",
          },
          { status: 404 }
        );
      }

      const artifactPath =
        resolveArtifactPath(
          projectDirectory,
          requestedFile
        );

      if (!artifactPath) {
        return NextResponse.json(
          {
            error:
              "Invalid artifact path.",
          },
          { status: 400 }
        );
      }

      let artifactStats;

      try {
        artifactStats =
          await stat(artifactPath);
      } catch {
        return NextResponse.json(
          {
            error:
              "Requested artifact was not found.",
            file: requestedFile,
          },
          { status: 404 }
        );
      }

      if (!artifactStats.isFile()) {
        return NextResponse.json(
          {
            error:
              "Requested artifact is not a file.",
          },
          { status: 400 }
        );
      }

      let artifactContent: string;

      try {
        artifactContent =
          await readFile(
            artifactPath,
            "utf-8"
          );
      } catch (error) {
        console.error(
          "Failed to read project artifact:",
          error
        );

        return NextResponse.json(
          {
            error:
              "Could not read requested artifact.",
          },
          { status: 500 }
        );
      }

      /*
       * Return the actual artifact directly.
       *
       * In particular, alu.vcd is returned as raw VCD text.
       * This is what the waveform parser in page.tsx expects.
       */
      return new NextResponse(
        artifactContent,
        {
          status: 200,
          headers: {
            "Content-Type":
              getArtifactContentType(
                requestedFile
              ),

            "Cache-Control":
              "no-store",

            "Content-Disposition":
              `inline; filename="${path.basename(
                artifactPath
              )}"`,
          },
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * SOURCE MODE
     * ---------------------------------------------------------
     *
     * Existing behavior:
     *
     * /api/projects/:id/files
     *
     * returns RTL + testbench information.
     */

    const projectMetadataPath =
      path.join(
        projectDirectory,
        "project.json"
      );

    const rtlDirectory =
      path.join(
        projectDirectory,
        "rtl"
      );

    const testbenchDirectory =
      path.join(
        projectDirectory,
        "testbench"
      );

    try {
      await access(projectDirectory);
      await access(rtlDirectory);
      await access(testbenchDirectory);
    } catch {
      return NextResponse.json(
        {
          error:
            "Project source files were not found.",
        },
        { status: 404 }
      );
    }

    let projectMetadata:
      | ProjectMetadata
      | null = null;

    try {
      const metadataText =
        await readFile(
          projectMetadataPath,
          "utf-8"
        );

      projectMetadata =
        JSON.parse(metadataText);
    } catch {
      projectMetadata = null;
    }

    let rtlFilename =
      projectMetadata?.rtl || "";

    let testbenchFilename =
      projectMetadata?.testbench || "";

    /*
     * Fallback discovery is intentionally restricted
     * to Verilog/SystemVerilog files so generated
     * artifacts such as .vcd are never mistaken for
     * source or testbench files.
     */
    if (!rtlFilename) {
      const rtlFiles =
        await readdir(rtlDirectory);

      rtlFilename =
        rtlFiles.find(isVerilogFile) ||
        "";
    }

    if (!testbenchFilename) {
      const testbenchFiles =
        await readdir(
          testbenchDirectory
        );

      testbenchFilename =
        testbenchFiles.find(
          isVerilogFile
        ) || "";
    }

    if (
      !rtlFilename ||
      !isVerilogFile(rtlFilename)
    ) {
      return NextResponse.json(
        {
          error:
            "RTL source file could not be identified.",
        },
        { status: 404 }
      );
    }

    if (
      !testbenchFilename ||
      !isVerilogFile(
        testbenchFilename
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Testbench source file could not be identified.",
        },
        { status: 404 }
      );
    }

    /*
     * Use basename so metadata can never escape
     * the project's source directory.
     */
    rtlFilename =
      path.basename(rtlFilename);

    testbenchFilename =
      path.basename(
        testbenchFilename
      );

    const rtlPath =
      path.join(
        rtlDirectory,
        rtlFilename
      );

    const testbenchPath =
      path.join(
        testbenchDirectory,
        testbenchFilename
      );

    let rtl = "";
    let testbench = "";

    try {
      rtl = await readFile(
        rtlPath,
        "utf-8"
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not read RTL source.",
        },
        { status: 404 }
      );
    }

    try {
      testbench = await readFile(
        testbenchPath,
        "utf-8"
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not read testbench source.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        projectId,

        rtl,

        testbench,

        files: {
          rtl: {
            name: rtlFilename,
            language:
              "systemverilog",
            lines:
              rtl.split("\n").length,
          },

          testbench: {
            name:
              testbenchFilename,
            language:
              "systemverilog",
            lines:
              testbench.split("\n")
                .length,
          },
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to load project files:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load project files.",
      },
      { status: 500 }
    );
  }
}