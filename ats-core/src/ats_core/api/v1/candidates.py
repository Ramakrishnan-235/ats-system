import os
import shutil
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from celery.result import AsyncResult

from ats_core.workers.celery_app import celery_app
from ats_core.workers.tasks import process_resume_pdf_task

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
    task = process_resume_pdf_task.delay(
        file_path=str(temp_file_path),
        candidate_id=candidate_id,
        original_filename=safe_filename
    )

    return {
        "status": "ACCEPTED",
        "task_id": task.id,
        "candidate_id": candidate_id,
        "message": "Resume uploaded successfully and queued for parsing."
    }


@router.get(
    "/tasks/{task_id}",
    summary="Check background processing status and progress"
)
async def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "state": task_result.state,
    }

    if task_result.state == "PENDING":
        response["message"] = "Task is queued and waiting for an available worker."
    elif task_result.state == "PROGRESS":
        info = task_result.info if isinstance(task_result.info, dict) else {}
        response["progress"] = info.get("progress", 0)
        response["step"] = info.get("step", "PROCESSING")
    elif task_result.state == "SUCCESS":
        response["result"] = task_result.result
    elif task_result.state == "FAILURE":
        response["error"] = str(task_result.info)
        response["traceback"] = task_result.traceback

    return response
