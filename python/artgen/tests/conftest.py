"""Fixtures: a scratch copy of the iso-dungeon fixture project and the artgen CLI to run.

The CLI is ``$ARTGEN_CLI`` when set (e.g. a built ``artgen.js``), else this repo's TypeScript entry
(``packages/artgen-cli/src/bin.ts``, run by Node 22's type stripping after ``npm ci``).
"""
import os
import shutil
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / "examples" / "iso-dungeon"


@pytest.fixture(scope="session")
def cli() -> Path:
    c = Path(os.environ.get("ARTGEN_CLI") or REPO / "packages" / "artgen-cli" / "src" / "bin.ts")
    if not c.is_file():
        pytest.skip(f"no artgen CLI at {c}")
    return c


@pytest.fixture()
def project(tmp_path: Path) -> Path:
    root = tmp_path / "iso-dungeon"
    shutil.copytree(FIXTURE / "art", root / "art")
    return root
