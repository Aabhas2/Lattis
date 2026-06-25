import os 
import joblib 
import pandas as pd 
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException 
from sqlalchemy.orm import Session 
import uuid 
from rq import Queue 

from app.db.session import get_db 
from app.db import crud 
from app.schemas.model import ModelTrainRequest, ModelTrainQueueResponse, ModelJobStatusResponse
from app.workers.jobs import train_job
from app.utils.redis_client import get_redis_client 
from app.db.models import ModelJobStatus 
from app.core.config import settings 

router = APIRouter() 

class PredictionRequest(BaseModel):
    inputs: dict 

@router.post("/train", response_model=ModelTrainQueueResponse) 
def train_model(req: ModelTrainRequest, db: Session = Depends(get_db)): 
    dataset = crud.get_dataset(db, req.dataset_id)  
    if not dataset: 
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Create ModelJob record with status "queued" 
    job = crud.create_model_job(db, req.dataset_id, req.model_dump(mode="json")) 

    try: 
        # push job to redis queue 
        redis_conn = get_redis_client() 
        queue = Queue(settings.RQ_QUEUE, connection=redis_conn) 

        # Enqueue background job runner 
        queue.enqueue(
            train_job,
            args=(str(job.id), req.model_dump(mode="json"), dataset.file_path), 
            job_id = str(job.id)
        )
        
        return {"job_id": job.id, "status": "queued"} 

    except Exception as e: 
        # set databse job status to failed if enqueuing fails 
        crud.update_model_job_status(db, job.id, ModelJobStatus.FAILED, error_message=str(e)) 
        raise HTTPException(status_code=500, detail=f"Failed to queue training task: {str(e)}") 

@router.get("/runs/{job_id}/status", response_model=ModelJobStatusResponse) 
def get_model_job_status(job_id: uuid.UUID, db: Session = Depends(get_db)): 
    job = crud.get_model_job(db, job_id) 

    if not job: 
        raise HTTPException(status_code=404, detail="Training run not found.") 
    
    return {
        "job_id": job.id, 
        "status": job.status, 
        "result": job.result, 
        "error_message": job.error_message
    }

@router.get("/datasets/{dataset_id}") 
def list_dataset_models(dataset_id: uuid.UUID, db: Session = Depends(get_db)): 
    # Retrieve all model training jobs for the given dataset_id 
    jobs = crud.list_model_jobs(db, dataset_id) 

    completed_runs = [] 
    for job in jobs: 
        # only list successfully completed model training runs 
        if job.status == ModelJobStatus.COMPLETE and job.result: 
            completed_runs.append({
                "job_id": str(job.id), 
                "algorithm": job.config.get("algorithm"),
                "task_type": job.config.get("task_type"), 
                "split": job.config.get("train_split", 0.8), 
                "parameters": job.config.get("parameters", {}), 
                "target_column": job.config.get("target_column") or job.result.get("target_column"), 
                "metrics": job.result.get("metrics"), 
                "feature_importances": job.result.get("feature_importances", []), 
                "features_used": job.result.get("features_used", []), 
                "created_at": job.created_at.isoformat() if hasattr(job.created_at, "isoformat") else str(job.created_at) 
            })
    return completed_runs 

@router.post("/runs/{job_id}/predict") 
def predict_model(job_id: uuid.UUID, req: PredictionRequest, db: Session = Depends(get_db)): 
    # Verify that the job exists and is complete in DB 
    job  = crud.get_model_job(db, job_id) 
    if not job or job.status != ModelJobStatus.COMPLETE: 
        raise HTTPException(status_code=400, detail="Model is not trained or run not found.") 

    # Check if the model file exists on disk 
    model_path = os.path.join("storage", "models", f"{job_id}.joblib") 
    if not os.path.exists(model_path): 
        raise HTTPException(status_code=404, detail="Model file not found on disk.") 

    # Load model artifacts 
    model_data = joblib.load(model_path) 
    model = model_data["model"] 
    features_used = model_data["features_used"] 
    task_type = model_data["task_type"] 
    le = model_data["label_encoder"] 

    # Align inputs with the features list in correct order 
    input_row = {} 
    for col in features_used: 
        val = req.inputs.get(col) 
        if val is None: 
            # Fallback to 0 if input is missing  
            val = 0.0 

        input_row[col] = float(val) 

    # Convert to DataFrame with columns in exact matching order 
    X_pred = pd.DataFrame([input_row], columns=features_used) 

    # Perform prediction 
    try:
        pred = model.predict(X_pred)[0] 

        # If classification, get class probabilites (confidence score) 
        confidence = None 
        if task_type == "classification" and hasattr(model, "predict_proba"): 
            proba = model.predict_proba(X_pred)[0] 
            pred_idx = int(pred) 
            confidence = float(proba[pred_idx]) 

        # Decode prediction label if encoder exists 
        prediction_label = str(pred) 
        if le is not None: 
            prediction_label = str(le.inverse_transform([int(pred)])[0]) 

        return {
            "prediction": prediction_label, 
            "confidence": confidence, 
            "task_type": task_type 
        }
    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Predicton error: {str(e)}") 