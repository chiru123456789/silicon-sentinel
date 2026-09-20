import { NextResponse } from "next/server";
import {
  access,
  readdir,
  readFile
} from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type VerificationResult = {
  [key: string]: unknown;
  module?: string;
  operation?: string;
  expected_result?: string | number;
  actual_result?: string | number;
  expected_carry?: string | number;
  actual_carry?: string | number;
  line?: number;
  source_line?: number;
  source_file?: string;
};

type SourceMapping = {
  file: string;
  line: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reason: string;
};

function isVerilogFile(
  filename: string
) {
  return (
    filename.toLowerCase().endsWith(".sv") ||
    filename.toLowerCase().endsWith(".v")
  );
}

function normalizeValue(
  value: unknown
) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase();
}

function isDifferent(
  expected: unknown,
  actual: unknown
) {
  const expectedValue =
    normalizeValue(expected);

  const actualValue =
    normalizeValue(actual);

  return (
    expectedValue !== "" &&
    actualValue !== "" &&
    expectedValue !== actualValue
  );
}

function findModuleRange(
  lines: string[],
  moduleName?: string
) {
  if (!moduleName) {
    return {
      start: 0,
      end: lines.length - 1
    };
  }

  const modulePattern =
    new RegExp(
      `\\bmodule\\s+${moduleName}\\b`
    );

  let start = -1;

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    if (
      modulePattern.test(
        lines[index]
      )
    ) {
      start = index;
      break;
    }
  }

  if (start === -1) {
    return {
      start: 0,
      end: lines.length - 1
    };
  }

  for (
    let index = start + 1;
    index < lines.length;
    index++
  ) {
    if (
      /\bendmodule\b/.test(
        lines[index]
      )
    ) {
      return {
        start,
        end: index
      };
    }
  }

  return {
    start,
    end: lines.length - 1
  };
}

function findOperationCode(
  operation?: string
) {
  if (!operation) {
    return null;
  }

  const normalized =
    operation.trim().toUpperCase();

  const operationCodes: Record<
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
    SHR: "3'b111"
  };

  return (
    operationCodes[normalized] ||
    null
  );
}

function findResponsibleLine(
  lines: string[],
  result: VerificationResult
): SourceMapping {
  const moduleName =
    typeof result.module === "string"
      ? result.module
      : undefined;

  const operation =
    typeof result.operation === "string"
      ? result.operation
      : undefined;

  const moduleRange =
    findModuleRange(
      lines,
      moduleName
    );

  const scopedLines =
    lines.slice(
      moduleRange.start,
      moduleRange.end + 1
    );

  const existingLine =
    Number(result.line);

  if (
    Number.isInteger(existingLine) &&
    existingLine > 0 &&
    existingLine <= lines.length
  ) {
    return {
      file: "",
      line: existingLine,
      confidence: "HIGH",
      reason:
        "Verification engine supplied an explicit RTL source line."
    };
  }

  const existingSourceLine =
    Number(result.source_line);

  if (
    Number.isInteger(
      existingSourceLine
    ) &&
    existingSourceLine > 0 &&
    existingSourceLine <= lines.length
  ) {
    return {
      file: "",
      line: existingSourceLine,
      confidence: "HIGH",
      reason:
        "Verification result supplied an explicit source line."
    };
  }

  const expectedCarry =
    result.expected_carry;

  const actualCarry =
    result.actual_carry;

  if (
    isDifferent(
      expectedCarry,
      actualCarry
    )
  ) {
    const actualCarryValue =
      normalizeValue(
        actualCarry
      );

    for (
      let index = 0;
      index < scopedLines.length;
      index++
    ) {
      const sourceLine =
        scopedLines[index];

      const assignmentMatch =
        sourceLine.match(
          /\bcarry\s*=\s*([^;]+)/
        );

      if (!assignmentMatch) {
        continue;
      }

      const assignedValue =
        normalizeValue(
          assignmentMatch[1]
        );

      if (
        assignedValue.includes(
          actualCarryValue
        ) ||
        (
          actualCarryValue === "0" &&
          assignedValue.includes(
            "1'b0"
          )
        ) ||
        (
          actualCarryValue === "1" &&
          assignedValue.includes(
            "1'b1"
          )
        )
      ) {
        return {
          file: "",
          line:
            moduleRange.start +
            index +
            1,
          confidence: "HIGH",
          reason:
            "The reported carry mismatch maps to a carry assignment producing the observed incorrect value."
        };
      }
    }
  }

  const operationCode =
    findOperationCode(
      operation
    );

  if (operationCode) {
    for (
      let index = 0;
      index < scopedLines.length;
      index++
    ) {
      const sourceLine =
        scopedLines[index];

      if (
        sourceLine.includes(
          operationCode
        )
      ) {
        for (
          let offset = 0;
          offset <= 8 &&
          index + offset <
            scopedLines.length;
          offset++
        ) {
          const candidate =
            scopedLines[
              index + offset
            ];

          if (
            /\b(result|carry)\s*=/.test(
              candidate
            )
          ) {
            return {
              file: "",
              line:
                moduleRange.start +
                index +
                offset +
                1,
              confidence: "MEDIUM",
              reason:
                "The source line is inside the RTL operation branch associated with the reported operation."
            };
          }
        }
      }
    }
  }

  if (operation) {
    const operationPattern =
      new RegExp(
        operation,
        "i"
      );

    for (
      let index = 0;
      index < scopedLines.length;
      index++
    ) {
      if (
        operationPattern.test(
          scopedLines[index]
        )
      ) {
        return {
          file: "",
          line:
            moduleRange.start +
            index +
            1,
          confidence: "LOW",
          reason:
            "The reported operation name appears directly in the RTL source."
        };
      }
    }
  }

  return {
    file: "",
    line: null,
    confidence: "NONE",
    reason:
      "No sufficiently reliable RTL source mapping was found."
  };
}

async function findRtlFilename(
  projectDirectory: string,
  metadata: {
    rtl?: string;
  } | null
) {
  if (
    metadata?.rtl &&
    isVerilogFile(metadata.rtl)
  ) {
    return path.basename(
      metadata.rtl
    );
  }

  const rtlDirectory =
    path.join(
      projectDirectory,
      "rtl"
    );

  try {
    const files =
      await readdir(
        rtlDirectory
      );

    return (
      files.find(isVerilogFile) ||
      ""
    );
  } catch {
    return "";
  }
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const params =
      await context.params;

    const projectId =
      params.id;

    if (
      !projectId ||
      !/^[0-9]+$/.test(
        projectId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid project ID."
        },
        {
          status: 400
        }
      );
    }

    const projectDirectory =
      path.join(
        process.cwd(),
        "..",
        "engine",
        "projects",
        projectId
      );

    const reportPath =
      path.join(
        projectDirectory,
        "reports",
        "failure.json"
      );

    try {
      await access(
        reportPath
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "No verification result exists for this project yet."
        },
        {
          status: 404
        }
      );
    }

    const reportText =
      await readFile(
        reportPath,
        "utf-8"
      );

    const result =
      JSON.parse(
        reportText
      ) as VerificationResult;

    let metadata:
      | {
          rtl?: string;
        }
      | null = null;

    try {
      const metadataText =
        await readFile(
          path.join(
            projectDirectory,
            "project.json"
          ),
          "utf-8"
        );

      metadata =
        JSON.parse(
          metadataText
        );
    } catch {
      metadata = null;
    }

    const rtlFilename =
      await findRtlFilename(
        projectDirectory,
        metadata
      );

    let sourceMapping:
      | SourceMapping
      | null = null;

    let sourceExcerpt:
      | string[]
      | null = null;

    if (rtlFilename) {
      const rtlPath =
        path.join(
          projectDirectory,
          "rtl",
          rtlFilename
        );

      try {
        const rtlText =
          await readFile(
            rtlPath,
            "utf-8"
          );

        const lines =
          rtlText.split("\n");

        sourceMapping =
          findResponsibleLine(
            lines,
            result
          );

        sourceMapping.file =
          rtlFilename;

        if (
          sourceMapping.line
        ) {
          const targetIndex =
            sourceMapping.line - 1;

          const start =
            Math.max(
              0,
              targetIndex - 2
            );

          const end =
            Math.min(
              lines.length,
              targetIndex + 3
            );

          sourceExcerpt =
            lines.slice(
              start,
              end
            );
        }
      } catch {
        sourceMapping = {
          file: rtlFilename,
          line: null,
          confidence: "NONE",
          reason:
            "RTL source could not be read."
        };
      }
    }

    const enrichedResult = {
      ...result,
      sourceFile:
        sourceMapping?.file ||
        result.source_file ||
        null,
      line:
        sourceMapping?.line ??
        result.line ??
        result.source_line ??
        null,
      sourceMapping,
      sourceExcerpt
    };

    return NextResponse.json(
      enrichedResult,
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  } catch (error) {
    console.error(
      "Failed to load project verification result:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load verification result."
      },
      {
        status: 500
      }
    );
  }
}