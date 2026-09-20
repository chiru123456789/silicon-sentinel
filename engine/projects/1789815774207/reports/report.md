# Silicon Sentinel Report

## Project

**Project ID:** `1789815774207`

## Verification Result

**Status:** FAILURE

**Risk:** HIGH

## Failure

- Module: `alu`
- Operation: `ADD`
- Input A: `0xff`
- Input B: `0x01`

## Expected

- Result: `0x00`
- Carry: `1`

## Actual

- Result: `0x00`
- Carry: `0`

## RTL Architecture

**Modules discovered:** 1

- `alu` — `engine/projects/1789815774207/rtl/alu.sv` lines 1-77 — 6 ports

## Source Mapping

- File: `engine/projects/1789815774207/rtl/alu.sv`
- Line: `26`
- Confidence: `HIGH`

## Evidence

- Project: `engine/projects/1789815774207`
- Simulator: `Verilator`
- Simulation log: `engine/projects/1789815774207/reports/simulation.log`
- Failure JSON: `engine/projects/1789815774207/reports/failure.json`
- Waveforms: `engine/projects/1789815774207/waveforms/`

## Conclusion

Silicon Sentinel executed the uploaded RTL and testbench using Verilator.

A verification failure was detected during the executed campaign.
