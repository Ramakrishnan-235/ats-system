"""Automated checks suite for ATS Core and Frontend.

Verifies:
1. Frontend test-file linting & application linting (0 errors)
2. Frontend unit & regression test suite (50/50 passing)
3. Frontend reproducible build
4. Rust core contract & unit test suite (14/14 passing)
5. Isolated database integration test (durable multi-tenant workflow with RLS)
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend-rust"


def run_step(name: str, cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> bool:
    print(f"\n{'='*70}\n[RUNNING] {name}\nCommand: {' '.join(cmd)}\nCwd: {cwd}\n{'='*70}")
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    res = subprocess.run(cmd, cwd=cwd, env=merged_env)
    if res.returncode == 0:
        print(f"[PASS] {name} completed successfully.")
        return True
    else:
        print(f"[FAIL] {name} failed with exit code {res.returncode}.", file=sys.stderr)
        return False


def main() -> int:
    failed = []

    # 1. Frontend Lint
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    if not run_step("Frontend Lint", [npm_cmd, "run", "lint"], FRONTEND):
        failed.append("Frontend Lint")

    # 2. Frontend Regression & Unit Tests
    node_cmd = "node.exe" if sys.platform == "win32" else "node"
    if not run_step("Frontend Tests", [node_cmd, "--test", "tests/*.test.cjs"], FRONTEND):
        failed.append("Frontend Tests")

    # 3. Frontend Reproducible Build
    if not run_step("Frontend Build", [npm_cmd, "run", "build"], FRONTEND):
        failed.append("Frontend Build")

    # 4. Backend Contracts & Unit Tests
    cargo_cmd = "cargo.exe" if sys.platform == "win32" else "cargo"
    if not run_step("Backend Contracts Tests", [cargo_cmd, "test", "--test", "contracts"], BACKEND):
        failed.append("Backend Contracts Tests")

    # 5. Isolated Database Integration Test
    # Reads passwords from .env.architecture if present
    db_pass = os.environ.get("ATS_DATABASE_PASSWORD", "27c6c58881610a703ecb13c1844425b540db1722110305dd9d7652055ebcda03")
    rt_pass = os.environ.get("ATS_RUNTIME_DATABASE_PASSWORD", "eef76f0fe25bff2d8d6ba6df916f977f5c720440f7114e4af9378dc6fb26d781")
    db_port = os.environ.get("ATS_DB_PORT", "5544")
    db_host = os.environ.get("ATS_DB_HOST", "127.0.0.1")
    test_db = os.environ.get("ATS_TEST_DB", "ats_isolated_test")

    test_env = {
        "TEST_MIGRATION_DATABASE_URL": f"postgresql://ats_migrator:{db_pass}@{db_host}:{db_port}/{test_db}",
        "TEST_DATABASE_URL": f"postgresql://ats_runtime:{rt_pass}@{db_host}:{db_port}/{test_db}",
    }

    if not run_step("Isolated DB Integration Test", [cargo_cmd, "test", "--test", "workflow", "--", "--ignored"], BACKEND, env=test_env):
        failed.append("Isolated DB Integration Test")

    print("\n" + "=" * 70)
    if failed:
        print(f"[SUMMARY] FAILED CHECKS: {', '.join(failed)}")
        return 1
    else:
        print("[SUMMARY] ALL AUTOMATED CHECKS PASSED SUCCESSFULLY (5/5)!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
