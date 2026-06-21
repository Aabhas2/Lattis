from fastapi import APIRouter, Depends, HTTPException 
from sqlalchemy.orm import Session 
import uuid 
from rq import Queue 

from app.db.session import get_db 
from app.db import crud 
from app.schemas.model import ModelTrainRequest
from app.workers.jobs import train_job
from app.utils.redis_client import get_redis_client 
from app.db.models import ModelJobStatus 
router = APIRouter() 

@router.post("/train") 
def train_model(req: ModelTrainRequest, db: Session = Depends(get_db)): 
    dataset = crud.get_dataset(db, req.dataset_id) 
    if not dataset: 
        raise HTTPException(status_code=404, detail="Dataset not found") 

    # Create ModelJob record with status "queued" 
    job = crud.create_model_job(db, req.dataset_id, req.model_dump()) 

    try: 
        # Push job to Redis Queue 
        redis_conn = get_redis_client() 
        queue = Queue("ml_playground_queue", connection=redis_conn) 

        # Enqueue backgorund job runner 
        queue.enqueue(
            train_job,
            args=(str(job.id), req.model_dump(), dataset.file_path), 
            job_id=str(job.id) 
        )

        return {"job_id": str(job.id), "status": "queued"}

    except Exception as e: 
        # Set database job status to failed if enqueuing fails 
        crud.update_model_job_status(db, job.id, ModelJobStatus.FAILED, error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to queue training task: {str(e)}")

@router.get("/runs/{job_id}/status") 
def get_model_job_status(job_id: uuid.UUID, db: Session = Depends(get_db)): 
    job = crud.get_model_job(db, job_id) 
    if not job: 
        raise HTTPException(status_code=404, detail="Training run not found.") 

    return {
        "job_id": str(job.id), 
        "status": job.status, 
        "result": job.result, 
        "error_message": job.error_message 
    }