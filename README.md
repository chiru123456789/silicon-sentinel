# Silicon Sentinel

> **Find the failure before the silicon does.**

Silicon Sentinel is a pre-silicon RTL verification and failure-investigation platform for digital hardware.

It takes RTL designs and their testbenches, runs real simulations, detects failures, maps failures back to RTL source lines, and presents the evidence through a verification workstation.

## What Silicon Sentinel Does

* RTL project management
* SystemVerilog / Verilog project inspection
* Real Verilator simulation
* Failure detection
* Source-line failure mapping
* Failure evidence extraction
* RTL-derived architecture visualization
* Waveform evidence
* Verification campaigns
* Scenario-level results
* Risk classification
* Investigation workspace
* Verification reports and artifacts
* Custom project creation

## Core Workflow

```text
RTL + Testbench
       ↓
Verification Engine
       ↓
Verilator Simulation
       ↓
Failure Detection
       ↓
Source Mapping
       ↓
Waveform Evidence
       ↓
Investigation
       ↓
Silicon Risk Report
```

## Example Project

The repository includes an ALU verification example.

The example demonstrates a real carry-propagation failure in an 8-bit ALU.

The verification engine identifies the failing operation, expected and actual values, and maps the failure to the corresponding RTL source location.

## Architecture

```text
Next.js Frontend
       ↓
Project / Verification APIs
       ↓
Python Verification Engine
       ↓
Verilator
       ↓
SystemVerilog RTL + Testbench
       ↓
Reports / Waveforms / Evidence
```

## Repository Structure

```text
silicon-sentinel/
│
├── engine/
│   ├── sentinel.py
│   ├── campaign.py
│   └── projects/
│       └── 1789815774207/
│           ├── rtl/
│           ├── testbench/
│           ├── reports/
│           └── waveforms/
│
├── examples/
│   └── alu/
│       ├── alu.sv
│       └── alu_tb.sv
│
├── frontend/
│   ├── src/
│   │   └── app/
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## Running Locally

### Requirements

* Node.js
* npm
* Python 3
* Verilator
* Git

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The application runs on:

```text
http://localhost:3000
```

### Verification Engine

The verification engine is located in:

```text
engine/sentinel.py
```

It operates on project-specific RTL and testbench files and produces verification artifacts including reports and waveforms.

## Example ALU

The included ALU project contains:

* RTL source
* SystemVerilog testbench
* Failure report
* Simulation output
* Waveform evidence

This allows the repository to be used as a reproducible demonstration of the verification workflow.

## Product Flow

```text
Command Center
      ↓
Verification Workstation
      ↓
Failure Campaign Laboratory
      ↓
Evidence Investigation
      ↓
Silicon Risk Report
```

## Why It Exists

Hardware failures discovered after fabrication can be extremely expensive to correct.

Silicon Sentinel focuses on the pre-silicon stage, where verification evidence can be used to identify RTL failures before they reach physical silicon.

## Technology

* Next.js
* React
* TypeScript
* Python
* SystemVerilog
* Verilator
* Git / GitHub

## Live Demo

The deployed competition demo will be linked here.

```text
LIVE DEMO: [https://silicon-sentinel-tan.vercel.app/]
```

## Project Status

Silicon Sentinel is an actively developed prototype demonstrating an end-to-end RTL verification and failure-investigation workflow.

## Team

Built by Chiranth G C
