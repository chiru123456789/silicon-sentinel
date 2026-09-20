"use client";

import { FormEvent, useState } from "react";

export default function NewProjectPage() {
  const [projectName, setProjectName] = useState("");
  const [rtl, setRtl] = useState<File | null>(null);
  const [testbench, setTestbench] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectName.trim()) {
      setStatus("Enter a project name.");
      return;
    }

    if (!rtl) {
      setStatus("Select an RTL file.");
      return;
    }

    if (!testbench) {
      setStatus("Select a testbench file.");
      return;
    }

    setStatus("Uploading project...");

    const formData = new FormData();

    formData.append("projectName", projectName);
    formData.append("rtl", rtl);
    formData.append("testbench", testbench);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Upload failed.");
        return;
      }

      setStatus(
        `Project created successfully. ID: ${data.project.id}`
      );
    } catch {
      setStatus("Could not connect to Silicon Sentinel.");
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
            Silicon Sentinel
          </p>

          <h1 className="text-4xl font-semibold tracking-tight">
            Create Verification Project
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Upload your RTL and testbench. Silicon Sentinel will use the
            submitted design as the source for verification.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Project name
            </label>

            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="My RISC-V Core"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              RTL source
            </label>

            <input
              type="file"
              accept=".sv,.v"
              onChange={(event) =>
                setRtl(event.target.files?.[0] ?? null)
              }
              className="block w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-400"
            />

            {rtl && (
              <p className="mt-2 text-xs text-zinc-500">
                Selected: {rtl.name}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Testbench
            </label>

            <input
              type="file"
              accept=".sv,.v"
              onChange={(event) =>
                setTestbench(event.target.files?.[0] ?? null)
              }
              className="block w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-400"
            />

            {testbench && (
              <p className="mt-2 text-xs text-zinc-500">
                Selected: {testbench.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300"
          >
            Create Verification Project
          </button>

          {status && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
              {status}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}