import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_RESULT_BACKEND = os.getenv("REDIS_RESULT_BACKEND", "redis://localhost:6379/1")

celery_app = Celery(
    "ats_worker",
    broker=REDIS_URL,
    backend=REDIS_RESULT_BACKEND,
    include=["ats_core.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    
    # Task execution limits (kills tasks that freeze during OCR/PDF parsing)
    task_time_limit=300,        # Hard kill after 5 minutes
    task_soft_time_limit=240,   # Soft exception after 4 minutes
    
    # Prefetch multiplier to prevent one worker from hoarding LLM tasks
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,  # Recycle worker processes to prevent memory leaks from PDF rendering
)
