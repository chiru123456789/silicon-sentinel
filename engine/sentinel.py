import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = ROOT / "engine" / "projects"
WAVEFORM_ROOT = ROOT / "engine" / "waveforms"

BUILD_DIR = Path("/tmp/silicon_sentinel_obj")


def run_command(command, cwd=None):
    result = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    return result.returncode, result.stdout


def extract(pattern, text, default=None):
    match = re.search(pattern, text)

    if match:
        return match.group(1)

    return default


def find_source_files(directory):
    files = []

    if not directory.exists():
        return files

    for extension in ("*.sv", "*.v"):
        files.extend(directory.rglob(extension))

    return sorted(files)


def write_json(file_path, data):
    file_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    file_path.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )


def count_ports(port_text):
    inputs = len(
        re.findall(
            r"\binput\b",
            port_text,
            re.IGNORECASE,
        )
    )

    outputs = len(
        re.findall(
            r"\boutput\b",
            port_text,
            re.IGNORECASE,
        )
    )

    inouts = len(
        re.findall(
            r"\binout\b",
            port_text,
            re.IGNORECASE,
        )
    )

    return {
        "inputs": inputs,
        "outputs": outputs,
        "inouts": inouts,
        "total": inputs + outputs + inouts,
    }


def extract_port_names(port_text):
    ports = []

    cleaned = re.sub(
        r"//.*",
        "",
        port_text,
    )

    cleaned = re.sub(
        r"/\*.*?\*/",
        "",
        cleaned,
        flags=re.DOTALL,
    )

    port_pattern = re.compile(
        r"\b(input|output|inout)\b"
        r"(?:\s+(?:wire|reg|logic|signed|unsigned))?"
        r"(?:\s*\[[^\]]+\])?"
        r"\s+([^,;)]+)",
        re.IGNORECASE,
    )

    for match in port_pattern.finditer(
        cleaned
    ):
        direction = (
            match.group(1)
            .lower()
        )

        names = match.group(2)

        names = re.sub(
            r"\s*=\s*[^,;]+",
            "",
            names,
        )

        for name in names.split(","):
            name = name.strip()

            name = re.sub(
                r"\[[^\]]+\]",
                "",
                name,
            )

            name = re.sub(
                r"\s+",
                " ",
                name,
            ).strip()

            if (
                name
                and re.fullmatch(
                    r"[A-Za-z_][A-Za-z0-9_]*",
                    name,
                )
            ):
                ports.append(
                    {
                        "name": name,
                        "direction": direction,
                    }
                )

    return ports


def parse_rtl_architecture(rtl_files):
    modules = []

    module_pattern = re.compile(
        r"\bmodule\s+"
        r"([A-Za-z_][A-Za-z0-9_]*)"
        r"\s*"
        r"(?:#\s*\([^;]*?\)\s*)?"
        r"\((.*?)\)"
        r"\s*;",
        re.IGNORECASE | re.DOTALL,
    )

    simple_module_pattern = re.compile(
        r"\bmodule\s+"
        r"([A-Za-z_][A-Za-z0-9_]*)"
        r"(?:\s+[^;]*)?;",
        re.IGNORECASE,
    )

    endmodule_pattern = re.compile(
        r"\bendmodule\b",
        re.IGNORECASE,
    )

    for file_path in rtl_files:
        try:
            text = file_path.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except OSError:
            continue

        lines = text.splitlines()

        matches = list(
            module_pattern.finditer(text)
        )

        if not matches:
            matches = list(
                simple_module_pattern.finditer(
                    text
                )
            )

        for index, match in enumerate(
            matches
        ):
            module_name = match.group(1)

            start_offset = match.start()

            start_line = (
                text.count(
                    "\n",
                    0,
                    start_offset,
                )
                + 1
            )

            end_match = endmodule_pattern.search(
                text,
                match.end(),
            )

            if end_match:
                end_offset = (
                    end_match.end()
                )

                end_line = (
                    text.count(
                        "\n",
                        0,
                        end_offset,
                    )
                    + 1
                )
            else:
                if index + 1 < len(matches):
                    next_offset = matches[
                        index + 1
                    ].start()

                    end_line = (
                        text.count(
                            "\n",
                            0,
                            next_offset,
                        )
                    )
                else:
                    end_line = len(lines)

            port_text = ""

            if match.lastindex and match.lastindex >= 2:
                port_text = (
                    match.group(2)
                    or ""
                )

            port_info = count_ports(
                port_text
            )

            port_names = extract_port_names(
                port_text
            )

            relative_file = str(
                file_path.relative_to(
                    ROOT
                )
            ).replace("\\", "/")

            module_data = {
                "name": module_name,
                "file": relative_file,
                "lineStart": start_line,
                "lineEnd": max(
                    start_line,
                    end_line,
                ),
                "ports": port_names,
                "portCount": port_info[
                    "total"
                ],
                "inputs": port_info[
                    "inputs"
                ],
                "outputs": port_info[
                    "outputs"
                ],
                "inouts": port_info[
                    "inouts"
                ],
            }

            modules.append(
                module_data
            )

    return modules


def find_module_for_failure(
    modules,
    failure_module,
):
    if not failure_module:
        return None

    for module in modules:
        if (
            module["name"]
            == failure_module
        ):
            return module

    return None


def find_source_location(
    rtl_files,
    failure_module,
    operation,
    actual_carry,
):
    if not failure_module:
        return None

    target_module = None

    architecture = parse_rtl_architecture(
        rtl_files
    )

    for module in architecture:
        if (
            module["name"]
            == failure_module
        ):
            target_module = module
            break

    if not target_module:
        return None

    target_file = ROOT / target_module["file"]

    if not target_file.exists():
        return None

    try:
        text = target_file.read_text(
            encoding="utf-8",
            errors="ignore",
        )
    except OSError:
        return None

    lines = text.splitlines()

    start_line = max(
        1,
        target_module["lineStart"],
    )

    end_line = min(
        len(lines),
        target_module["lineEnd"],
    )

    operation_name = (
        operation or ""
    ).upper()

    operation_patterns = {
        "ADD": [
            r"3'b000",
            r"\bADD\b",
            r"\badd\b",
        ],
        "SUB": [
            r"3'b001",
            r"\bSUB\b",
            r"\bsub\b",
        ],
        "AND": [
            r"3'b010",
            r"\bAND\b",
            r"\band\b",
        ],
        "OR": [
            r"3'b011",
            r"\bOR\b",
            r"\bor\b",
        ],
        "XOR": [
            r"3'b100",
            r"\bXOR\b",
            r"\bxor\b",
        ],
        "NOT": [
            r"3'b101",
            r"\bNOT\b",
            r"\bnot\b",
        ],
        "SHIFT": [
            r"3'b110",
            r"3'b111",
            r"\bSHIFT\b",
            r"\bshift\b",
        ],
    }

    patterns = operation_patterns.get(
        operation_name,
        [],
    )

    operation_line = None

    for line_number in range(
        start_line,
        end_line + 1,
    ):
        line = lines[
            line_number - 1
        ]

        if any(
            re.search(
                pattern,
                line,
                re.IGNORECASE,
            )
            for pattern in patterns
        ):
            operation_line = (
                line_number
            )
            break

    if operation_line is not None:
        for line_number in range(
            operation_line,
            min(
                end_line,
                operation_line + 12,
            )
            + 1,
        ):
            line = lines[
                line_number - 1
            ]

            if re.search(
                r"\bcarry\b\s*=",
                line,
                re.IGNORECASE,
            ):
                return {
                    "file": target_module[
                        "file"
                    ],
                    "line": line_number,
                    "confidence": "HIGH",
                    "reason": (
                        "Matched the failing operation "
                        "branch and carry assignment."
                    ),
                }

    for line_number in range(
        start_line,
        end_line + 1,
    ):
        line = lines[
            line_number - 1
        ]

        if re.search(
            r"\bcarry\b\s*=",
            line,
            re.IGNORECASE,
        ):
            if (
                actual_carry
                and actual_carry
                in line
            ):
                return {
                    "file": target_module[
                        "file"
                    ],
                    "line": line_number,
                    "confidence": "MEDIUM",
                    "reason": (
                        "Matched the observed carry "
                        "value inside the failing module."
                    ),
                }

    return None


def build_architecture(
    rtl_files,
    failure_module,
    operation,
    actual_carry,
):
    modules = parse_rtl_architecture(
        rtl_files
    )

    failure_module_data = (
        find_module_for_failure(
            modules,
            failure_module,
        )
    )

    source_location = (
        find_source_location(
            rtl_files,
            failure_module,
            operation,
            actual_carry,
        )
        if failure_module_data
        else None
    )

    for module in modules:
        module["role"] = (
            "FAILING_MODULE"
            if module["name"]
            == failure_module
            else "RTL_MODULE"
        )

        module["failure"] = (
            module["name"]
            == failure_module
        )

    return {
        "modules": modules,
        "moduleCount": len(modules),
        "failingModule": (
            failure_module_data
        ),
        "failureLocation": (
            source_location
        ),
    }


def main():
    if len(sys.argv) != 2:
        print("Usage:")
        print(
            "  python3 engine/sentinel.py <PROJECT_ID>"
        )
        sys.exit(1)

    project_id = sys.argv[1]

    if not re.fullmatch(
        r"[0-9]+",
        project_id,
    ):
        raise ValueError(
            "Project ID must contain only numbers."
        )

    project_dir = (
        PROJECTS_DIR / project_id
    )

    rtl_dir = (
        project_dir / "rtl"
    )

    testbench_dir = (
        project_dir / "testbench"
    )

    if not project_dir.exists():
        raise FileNotFoundError(
            f"Project not found: {project_dir}"
        )

    rtl_files = find_source_files(
        rtl_dir
    )

    testbench_files = find_source_files(
        testbench_dir
    )

    if not rtl_files:
        raise FileNotFoundError(
            f"No RTL files found in: {rtl_dir}"
        )

    if not testbench_files:
        raise FileNotFoundError(
            f"No testbench files found in: {testbench_dir}"
        )

    report_dir = (
        project_dir / "reports"
    )

    waveform_dir = (
        project_dir / "waveforms"
    )

    report_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    waveform_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    BUILD_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "======================================"
    )

    print(
        "       SILICON SENTINEL ENGINE"
    )

    print(
        "======================================"
    )

    print()

    print(
        f"Project ID : {project_id}"
    )

    print(
        f"Project    : {project_dir}"
    )

    print()

    print(
        "[1/5] Loading uploaded RTL..."
    )

    print("RTL files:")

    for file in rtl_files:
        print(
            f"  - {file}"
        )

    print()

    print("Testbench files:")

    for file in testbench_files:
        print(
            f"  - {file}"
        )

    print()

    print(
        "[2/5] Parsing RTL architecture..."
    )

    architecture = (
        build_architecture(
            rtl_files,
            None,
            None,
            None,
        )
    )

    print(
        f"Modules discovered : {architecture['moduleCount']}"
    )

    for module in architecture[
        "modules"
    ]:
        print(
            f"  - {module['name']} "
            f"({module['file']}:{module['lineStart']})"
        )

    print()

    top_module = (
        testbench_files[0].stem
    )

    executable = (
        BUILD_DIR / f"V{top_module}"
    )

    print(
        f"Top module : {top_module}"
    )

    print()

    print(
        "[3/5] Building uploaded project with Verilator..."
    )

    build_command = [
        "verilator",
        "--binary",
        "--trace",
        "--coverage",
        "--top-module",
        top_module,
        "--Mdir",
        str(BUILD_DIR),
    ]

    build_command.extend(
        str(file)
        for file in rtl_files
    )

    build_command.extend(
        str(file)
        for file in testbench_files
    )

    build_code, build_output = (
        run_command(
            build_command
        )
    )

    if build_code != 0:
        print(build_output)

        architecture = (
            build_architecture(
                rtl_files,
                None,
                None,
                None,
            )
        )

        failure = {
            "id": f"SS-{project_id}",
            "project_id": project_id,
            "status": "BUILD_FAILURE",
            "risk": "HIGH",
            "module": "unknown",
            "operation": "compile",
            "inputs": {},
            "expected": {},
            "actual": {},
            "line": 0,
            "sourceFile": "",
            "architecture": architecture,
            "source": {
                "project": project_id,
                "rtl": [
                    str(
                        file.relative_to(
                            ROOT
                        )
                    )
                    for file in rtl_files
                ],
                "testbench": [
                    str(
                        file.relative_to(
                            ROOT
                        )
                    )
                    for file in testbench_files
                ],
                "engine": "Verilator",
            },
        }

        write_json(
            report_dir
            / "failure.json",
            failure,
        )

        (
            report_dir
            / "simulation.log"
        ).write_text(
            build_output,
            encoding="utf-8",
        )

        (
            report_dir
            / "report.md"
        ).write_text(
            f"""# Silicon Sentinel Report

## Project

**Project ID:** `{project_id}`

## Verification Result

**Status:** BUILD_FAILURE

**Risk:** HIGH

## Failure

The uploaded RTL/testbench could not be compiled by Verilator.

## RTL Architecture

Silicon Sentinel discovered **{architecture["moduleCount"]} RTL module(s)** before compilation.

## Evidence

- Project: `engine/projects/{project_id}`
- Simulator: `Verilator`
- Build log: `engine/projects/{project_id}/reports/simulation.log`

## Conclusion

Silicon Sentinel detected a build failure before simulation.
""",
            encoding="utf-8",
        )

        raise RuntimeError(
            "Verilator build failed."
        )

    print(
        "Build successful."
    )

    print(
        f"Executable : {executable}"
    )

    print()

    if not executable.exists():
        raise FileNotFoundError(
            f"Verilator executable not found: {executable}"
        )

    print(
        "[4/5] Running uploaded project simulation..."
    )

    simulation_code, simulation_output = (
        run_command(
            [str(executable)],
            cwd=testbench_dir,
        )
    )

    print(simulation_output)

    log_file = (
        report_dir / "simulation.log"
    )

    log_file.write_text(
        simulation_output,
        encoding="utf-8",
    )

    print()

    print(
        "[5/5] Analysing verification result..."
    )

    failed = (
        "SILICON SENTINEL FAILURE DETECTED"
        in simulation_output
    )

    module = extract(
        r"Module\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    operation = extract(
        r"Operation\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    input_a = extract(
        r"Input A\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    input_b = extract(
        r"Input B\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    expected_result = extract(
        r"EXPECTED\s+Result\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    expected_carry = extract(
        r"EXPECTED\s+Result\s+:\s*\S+\s+Carry\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    actual_result = extract(
        r"ACTUAL\s+Result\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    actual_carry = extract(
        r"ACTUAL\s+Result\s+:\s*\S+\s+Carry\s+:\s*(\S+)",
        simulation_output,
        "unknown",
    )

    risk = extract(
        r"Risk\s+:\s*(\S+)",
        simulation_output,
        "LOW",
    )

    status = extract(
        r"Status\s+:\s*(\S+)",
        simulation_output,
        "PASS",
    )

    if (
        simulation_code != 0
        and not failed
    ):
        status = "SIMULATION_ERROR"
        risk = "HIGH"

    architecture = (
        build_architecture(
            rtl_files,
            module,
            operation,
            actual_carry,
        )
    )

    failure_location = (
        architecture.get(
            "failureLocation"
        )
        or {}
    )

    failure = {
        "id": f"SS-{project_id}",
        "project_id": project_id,
        "status": status,
        "risk": risk,
        "module": module,
        "operation": operation,
        "inputs": {
            "a": input_a,
            "b": input_b,
        },
        "expected": {
            "result": expected_result,
            "carry": expected_carry,
        },
        "actual": {
            "result": actual_result,
            "carry": actual_carry,
        },
        "line": failure_location.get(
            "line",
            0,
        ),
        "sourceFile": failure_location.get(
            "file",
            "",
        ),
        "sourceMapping": {
            "confidence": failure_location.get(
                "confidence",
                "NONE",
            ),
            "reason": failure_location.get(
                "reason",
                "No source mapping available.",
            ),
        },
        "architecture": architecture,
        "source": {
            "project": project_id,
            "rtl": [
                str(
                    file.relative_to(
                        ROOT
                    )
                )
                for file in rtl_files
            ],
            "testbench": [
                str(
                    file.relative_to(
                        ROOT
                    )
                )
                for file in testbench_files
            ],
            "engine": "Verilator",
        },
    }

    if (
        not failed
        and simulation_code == 0
    ):
        failure["status"] = "PASS"
        failure["risk"] = "LOW"

    failure_file = (
        report_dir / "failure.json"
    )

    write_json(
        failure_file,
        failure,
    )

    waveform_candidates = list(
        testbench_dir.glob("*.vcd")
    )

    if waveform_candidates:
        for waveform in waveform_candidates:
            destination = (
                waveform_dir
                / waveform.name
            )

            shutil.copy2(
                waveform,
                destination,
            )

            print(
                f"Waveform : {destination}"
            )

    report_file = (
        report_dir / "report.md"
    )

    mapped_line = failure.get(
        "line",
        0,
    )

    mapped_file = failure.get(
        "sourceFile",
        "",
    )

    mapping_confidence = (
        failure.get(
            "sourceMapping",
            {},
        ).get(
            "confidence",
            "NONE",
        )
    )

    report = f"""# Silicon Sentinel Report

## Project

**Project ID:** `{project_id}`

## Verification Result

**Status:** {failure["status"]}

**Risk:** {failure["risk"]}

## Failure

- Module: `{module}`
- Operation: `{operation}`
- Input A: `{input_a}`
- Input B: `{input_b}`

## Expected

- Result: `{expected_result}`
- Carry: `{expected_carry}`

## Actual

- Result: `{actual_result}`
- Carry: `{actual_carry}`

## RTL Architecture

**Modules discovered:** {architecture["moduleCount"]}

"""

    for module_data in architecture[
        "modules"
    ]:
        report += (
            f"- `{module_data['name']}` "
            f"— `{module_data['file']}` "
            f"lines {module_data['lineStart']}"
            f"-{module_data['lineEnd']} "
            f"— {module_data['portCount']} ports\n"
        )

    report += f"""
## Source Mapping

- File: `{mapped_file or "unresolved"}`
- Line: `{mapped_line or "unresolved"}`
- Confidence: `{mapping_confidence}`

## Evidence

- Project: `engine/projects/{project_id}`
- Simulator: `Verilator`
- Simulation log: `engine/projects/{project_id}/reports/simulation.log`
- Failure JSON: `engine/projects/{project_id}/reports/failure.json`
- Waveforms: `engine/projects/{project_id}/waveforms/`

## Conclusion

Silicon Sentinel executed the uploaded RTL and testbench using Verilator.

{"A verification failure was detected during the executed campaign." if failed else "No verification failure was detected during the executed campaign."}
"""

    report_file.write_text(
        report,
        encoding="utf-8",
    )

    print()

    print(
        "======================================"
    )

    print(
        "       SENTINEL ANALYSIS COMPLETE"
    )

    print(
        "======================================"
    )

    print()

    print(
        f"Project : {project_id}"
    )

    print(
        f"Status  : {failure['status']}"
    )

    print(
        f"Risk    : {failure['risk']}"
    )

    print(
        f"Modules : {architecture['moduleCount']}"
    )

    print(
        f"Mapping : {mapped_file}:{mapped_line} "
        f"({mapping_confidence})"
    )

    print(
        f"Report  : {failure_file}"
    )

    print()


if __name__ == "__main__":
    main()