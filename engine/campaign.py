import json
import random
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PROJECTS_DIR = ROOT / "projects"


def load_project(project_id: str):
    project_dir = PROJECTS_DIR / project_id

    if not project_dir.exists():
        raise FileNotFoundError(
            f"Project {project_id} does not exist."
        )

    rtl_dir = project_dir / "rtl"
    testbench_dir = project_dir / "testbench"

    rtl_files = sorted(
        [
            file
            for file in rtl_dir.iterdir()
            if file.suffix.lower() in {".sv", ".v"}
        ]
    )

    testbench_files = sorted(
        [
            file
            for file in testbench_dir.iterdir()
            if file.suffix.lower() in {".sv", ".v"}
        ]
    )

    if not rtl_files:
        raise RuntimeError("No RTL files found.")

    if not testbench_files:
        raise RuntimeError("No testbench files found.")

    return project_dir, rtl_files, testbench_files


def build_simulator(project_dir: Path, rtl_files, testbench_files):
    build_dir = Path("/tmp") / "silicon_sentinel_campaign_obj"
    build_dir.mkdir(parents=True, exist_ok=True)

    top_module = testbench_files[0].stem
    executable = build_dir / f"V{top_module}"

    command = [
        "verilator",
        "--binary",
        "--timing",
        "--trace",
        "--Mdir",
        str(build_dir),
    ]

    for file in rtl_files:
        command.append(str(file))

    for file in testbench_files:
        command.append(str(file))

    subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )

    return executable


def generate_scenarios(count: int = 25):
    random.seed(42)

    scenarios = []

    scenario_types = [
        "BOUNDARY",
        "RANDOM",
        "RESET",
        "OVERFLOW",
        "UNDERFLOW",
        "ZERO",
        "MAX_VALUE",
        "MIN_VALUE",
    ]

    for index in range(count):
        scenario_type = scenario_types[index % len(scenario_types)]

        seed = random.randint(
            100000,
            999999999
        )

        scenario = {
            "scenario_id": f"SCN-{index + 1:04d}",
            "type": scenario_type,
            "seed": seed,
            "stimulus": {
                "mode": scenario_type.lower(),
                "seed": seed,
            },
        }

        scenarios.append(scenario)

    return scenarios


def run_campaign(
    project_id: str,
    scenario_count: int = 25
):
    project_dir, rtl_files, testbench_files = load_project(
        project_id
    )

    campaign_dir = (
        project_dir /
        "campaigns"
    )

    campaign_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    campaign_id = (
        f"campaign-{int(time.time() * 1000)}"
    )

    campaign_output_dir = (
        campaign_dir /
        campaign_id
    )

    campaign_output_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    executable = build_simulator(
        project_dir,
        rtl_files,
        testbench_files
    )

    scenarios = generate_scenarios(
        scenario_count
    )

    results = []

    failure_count = 0

    for scenario in scenarios:
        scenario_seed = scenario["seed"]

        environment = {
            "project_id": project_id,
            "campaign_id": campaign_id,
            "scenario_id": scenario["scenario_id"],
            "seed": scenario_seed,
            "simulator": "Verilator",
        }

        try:
            completed = subprocess.run(
                [str(executable)],
                capture_output=True,
                text=True,
                timeout=30,
                env={
                    **dict(),
                    "SENTINEL_SEED": str(
                        scenario_seed
                    ),
                    "SENTINEL_SCENARIO": (
                        scenario["type"]
                    ),
                },
            )

            output = (
                completed.stdout +
                "\n" +
                completed.stderr
            )

            failed = (
                "FAILURE" in output.upper()
                or "ERROR" in output.upper()
                or completed.returncode != 0
            )

            if failed:
                failure_count += 1

            result = {
                "scenario": scenario,
                "status": (
                    "FAILURE"
                    if failed
                    else "PASS"
                ),
                "return_code": (
                    completed.returncode
                ),
                "environment": environment,
                "output": output[-5000:],
            }

        except subprocess.TimeoutExpired:
            failure_count += 1

            result = {
                "scenario": scenario,
                "status": "TIMEOUT",
                "return_code": None,
                "environment": environment,
                "output": (
                    "Simulation exceeded "
                    "30 second timeout."
                ),
            }

        results.append(result)

    total = len(results)

    if failure_count == 0:
        risk = "LOW"
    elif failure_count <= total * 0.2:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    campaign_result = {
        "campaign_id": campaign_id,
        "project_id": project_id,
        "status": (
            "FAILURE"
            if failure_count
            else "PASS"
        ),
        "risk": risk,
        "summary": {
            "total_scenarios": total,
            "passed": total - failure_count,
            "failed": failure_count,
            "failure_rate": (
                round(
                    failure_count / total,
                    4
                )
                if total
                else 0
            ),
        },
        "scenarios": results,
        "created_at": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime()
        ),
    }

    result_path = (
        campaign_output_dir /
        "campaign.json"
    )

    result_path.write_text(
        json.dumps(
            campaign_result,
            indent=2
        ),
        encoding="utf-8"
    )

    latest_path = (
        project_dir /
        "campaign.json"
    )

    latest_path.write_text(
        json.dumps(
            campaign_result,
            indent=2
        ),
        encoding="utf-8"
    )

    print(
        json.dumps(
            campaign_result,
            indent=2
        )
    )

    return campaign_result


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: python3 "
            "engine/campaign.py <PROJECT_ID>"
        )
        sys.exit(1)

    project_id = sys.argv[1]

    try:
        run_campaign(project_id)
    except Exception as error:
        print(
            f"Campaign failed: {error}",
            file=sys.stderr
        )
        sys.exit(1)


if __name__ == "__main__":
    main()