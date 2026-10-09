"""Private AI entry point: no legacy business routers or database writers."""

import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"), override=False)
sys.path.insert(0, str(Path(__file__).parent / "src"))
from ats_core.ai_api.app import app  # noqa: F401
