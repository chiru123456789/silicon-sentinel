import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "..",
      "engine",
      "reports",
      "failure.json"
    );

    const file = await readFile(filePath, "utf-8");
    const result = JSON.parse(file);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load Sentinel result:", error);

    return NextResponse.json(
      {
        error: "Sentinel result not found",
        message: "Run the Sentinel engine first.",
      },
      { status: 500 }
    );
  }
}