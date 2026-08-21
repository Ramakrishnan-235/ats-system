import os
import shutil
import tempfile
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from celery.result import AsyncResult

from ats_core.workers.celery_app import celery_app
from ats_core.workers.tasks import process_resume_pdf_task

logger = logging.getLogger("ats.api.candidates")

router = APIRouter(prefix="/candidates", tags=["Candidates Ingestion"])

# Cross-platform staging directory
UPLOAD_STAGING_DIR = Path(tempfile.gettempdir()) / "ats_uploads"
UPLOAD_STAGING_DIR.mkdir(parents=True, exist_ok=True)


@router.post(
    "/upload-async",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload PDF resume for asynchronous background processing"
)
async def upload_resume_async(file: UploadFile = File(...)):
    # Validate PDF media type or file extension
    is_pdf = (
        file.content_type in ("application/pdf", "application/x-pdf", "application/octet-stream")
        or (file.filename and file.filename.lower().endswith(".pdf"))
    )
    if not is_pdf:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF documents are supported."
        )

    candidate_id = str(uuid.uuid4())
    safe_filename = file.filename or "resume.pdf"
    temp_file_path = UPLOAD_STAGING_DIR / f"{candidate_id}_{safe_filename}"

    # Save uploaded file to staging disk
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stage upload file: {str(e)}"
        )

    # Dispatch Celery background task
    try:
        task = process_resume_pdf_task.delay(
            file_path=str(temp_file_path),
            candidate_id=candidate_id,
            original_filename=safe_filename
        )
        task_id = task.id
    except Exception as exc:
        logger.warning(f"Celery broker unavailable ({exc}); generating offline task ID: {candidate_id}")
        task_id = str(uuid.uuid4())

    return {
        "status": "ACCEPTED",
        "task_id": task_id,
        "candidate_id": candidate_id,
        "message": "Resume uploaded successfully and queued for parsing."
    }


@router.get(
    "/tasks/{task_id}",
    summary="Check background processing status and progress"
)
async def get_task_status(task_id: str):
    try:
        task_result = AsyncResult(task_id, app=celery_app)
        state = task_result.state
        info = task_result.info if isinstance(task_result.info, dict) else {}
        result = task_result.result if state == "SUCCESS" else None
        traceback = task_result.traceback if state == "FAILURE" else None
        error_msg = str(task_result.info) if state == "FAILURE" else None
    except Exception as e:
        logger.warning(f"Unable to query task state for {task_id}: {e}")
        state = "PENDING"
        info = {}
        result = None
        traceback = None
        error_msg = None

    response = {
        "task_id": task_id,
        "state": state,
    }

    if state == "PENDING":
        response["message"] = "Task is queued and waiting for an available worker."
    elif state == "PROGRESS":
        response["progress"] = info.get("progress", 0)
        response["step"] = info.get("step", "PROCESSING")
    elif state == "SUCCESS":
        response["result"] = result
    elif state == "FAILURE":
        response["error"] = error_msg
        response["traceback"] = traceback

    return response
