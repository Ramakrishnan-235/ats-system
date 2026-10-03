"""Bounded PDF uploads with server-owned paths shared by API and workers."""

import os
import re
import tempfile
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

UPLOAD_STAGING_DIR = Path(os.getenv(
    "ATS_UPLOAD_STAGING_DIR", str(Path(tempfile.gettempdir()) / "ats_uploads")
))
MAX_UPLOAD_BYTES = int(os.getenv("ATS_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
if MAX_UPLOAD_BYTES <= 0:
    raise ValueError("ATS_MAX_UPLOAD_BYTES must be positive")


def resume_path(candidate_id: str) -> Path:
    """Never interpret a candidate ID as a directory or glob pattern."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", candidate_id):
        raise ValueError("Invalid candidate ID")
    return UPLOAD_STAGING_DIR / f"{candidate_id}.pdf"


def _write_upload(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents following an existing file or symlink.
    with path.open("xb") as output:
        try:
            output.write(content)
        except BaseException:
            output.close()
            path.unlink(missing_ok=True)
            raise


async def stage_pdf_upload(file: UploadFile, candidate_id: str) -> tuple[bytes, str, Path]:
    """Validate content and size before touching the filesystem; always close uploads."""
    try:
        # Browsers may send POSIX or Windows path separators in filenames.
        filename = (file.filename or "resume.pdf").replace("\\", "/").rsplit("/", 1)[-1]
        if not filename.lower().endswith(".pdf") or file.content_type not in (
            None, "application/pdf", "application/x-pdf", "application/octet-stream"
        ):
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a PDF resume.")

        content = bytearray()
        while chunk := await file.read(64 * 1024):
            if len(content) + len(chunk) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Resume exceeds upload size limit.")
            content.extend(chunk)
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "The uploaded file is not a PDF.")

        path = resume_path(candidate_id)
        document = bytes(content)
        await run_in_threadpool(_write_upload, path, document)
        return document, filename, path
    finally:
        await file.close()
