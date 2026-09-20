import { NextResponse } from "next/server";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "fs/promises";
import path from "path";

type ProjectMetadata = {
  id: string;
  name: string;
  rtl: string;
  testbench: string;
  createdAt: string;
};

const PROJECTS_DIR = path.join(
  process.cwd(),
  "..",
  "engine",
  "projects"
);

const isValidProjectId = (id: string) =>
  /^[0-9]+$/.test(id);

const isVerilogFile = (file: string) => {
  const extension = path
    .extname(file)
    .toLowerCase();

  return (
    extension === ".sv" ||
    extension === ".v"
  );
};

export async function GET() {
  try {
    await mkdir(PROJECTS_DIR, {
      recursive: true,
    });

    const entries = await readdir(
      PROJECTS_DIR,
      {
        withFileTypes: true,
      }
    );

    const projects: ProjectMetadata[] = [];

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        !isValidProjectId(entry.name)
      ) {
        continue;
      }

      const projectId = entry.name;

      const projectDir = path.join(
        PROJECTS_DIR,
        projectId
      );

      const metadataPath = path.join(
        projectDir,
        "project.json"
      );

      try {
        const metadataText =
          await readFile(
            metadataPath,
            "utf-8"
          );

        const metadata =
          JSON.parse(
            metadataText
          ) as ProjectMetadata;

        projects.push(metadata);
      } catch {
        /*
         * Older projects may not have
         * project.json yet.
         *
         * Build a fallback from the
         * actual Verilog/SystemVerilog
         * source files.
         */

        const rtlDir = path.join(
          projectDir,
          "rtl"
        );

        const testbenchDir = path.join(
          projectDir,
          "testbench"
        );

        let rtlFiles: string[] = [];
        let testbenchFiles: string[] = [];

        try {
          const files =
            await readdir(rtlDir);

          rtlFiles = files.filter(
            isVerilogFile
          );
        } catch {
          // Ignore missing directory.
        }

        try {
          const files =
            await readdir(
              testbenchDir
            );

          testbenchFiles =
            files.filter(
              isVerilogFile
            );
        } catch {
          // Ignore missing directory.
        }

        projects.push({
          id: projectId,
          name:
            `Project ${projectId}`,
          rtl:
            rtlFiles[0] ||
            "Unknown RTL",
          testbench:
            testbenchFiles[0] ||
            "Unknown testbench",
          createdAt:
            new Date(
              Number(projectId)
            ).toISOString(),
        });
      }
    }

    projects.sort(
      (a, b) =>
        Number(b.id) -
        Number(a.id)
    );

    return NextResponse.json({
      projects,
    });
  } catch (error) {
    console.error(
      "Failed to list projects:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load projects.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const projectName =
      formData.get(
        "projectName"
      );

    const rtl =
      formData.get("rtl");

    const testbench =
      formData.get(
        "testbench"
      );

    if (
      typeof projectName !==
        "string" ||
      !projectName.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Project name is required.",
        },
        { status: 400 }
      );
    }

    if (!(rtl instanceof File)) {
      return NextResponse.json(
        {
          error:
            "RTL file is required.",
        },
        { status: 400 }
      );
    }

    if (
      !(testbench instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Testbench file is required.",
        },
        { status: 400 }
      );
    }

    if (
      !isVerilogFile(rtl.name)
    ) {
      return NextResponse.json(
        {
          error:
            "RTL must be a .sv or .v file.",
        },
        { status: 400 }
      );
    }

    if (
      !isVerilogFile(
        testbench.name
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Testbench must be a .sv or .v file.",
        },
        { status: 400 }
      );
    }

    const projectId =
      `${Date.now()}`;

    const projectDir =
      path.join(
        PROJECTS_DIR,
        projectId
      );

    const rtlDir =
      path.join(
        projectDir,
        "rtl"
      );

    const testbenchDir =
      path.join(
        projectDir,
        "testbench"
      );

    await mkdir(
      rtlDir,
      {
        recursive: true,
      }
    );

    await mkdir(
      testbenchDir,
      {
        recursive: true,
      }
    );

    /*
     * basename() prevents an uploaded
     * filename from creating directories
     * outside the project folder.
     */
    const safeRtlName =
      path.basename(
        rtl.name
      );

    const safeTestbenchName =
      path.basename(
        testbench.name
      );

    const rtlPath =
      path.join(
        rtlDir,
        safeRtlName
      );

    const testbenchPath =
      path.join(
        testbenchDir,
        safeTestbenchName
      );

    await writeFile(
      rtlPath,
      Buffer.from(
        await rtl.arrayBuffer()
      )
    );

    await writeFile(
      testbenchPath,
      Buffer.from(
        await testbench.arrayBuffer()
      )
    );

    const metadata: ProjectMetadata =
      {
        id: projectId,
        name:
          projectName.trim(),
        rtl: safeRtlName,
        testbench:
          safeTestbenchName,
        createdAt:
          new Date().toISOString(),
      };

    await writeFile(
      path.join(
        projectDir,
        "project.json"
      ),
      JSON.stringify(
        metadata,
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({
      success: true,
      project: metadata,
    });
  } catch (error) {
    console.error(
      "Project upload failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Project upload failed.",
      },
      { status: 500 }
    );
  }
}