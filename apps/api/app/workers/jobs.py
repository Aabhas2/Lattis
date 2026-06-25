import traceback 
from app.db.session import SessionLocal
from app.db import crud
from app.db.models import ModelJobStatus 
from app.services.model_service import ModelService 
from app.schemas.model import ModelTrainRequest 
from app.services.dataset_service import load_data

def train_job(job_id: str, req_dict: dict, file_path: str): 
    db = SessionLocal()

    try: 
        # 1. Update job status to RUNNING in database 
        crud.update_model_job_status(db, job_id, ModelJobStatus.RUNNING) 

        # 2. Load dataset 
        df, _ = load_data(file_path) 

        # 3. Reconstruct the Pydantic request schema 
        req = ModelTrainRequest(**req_dict) 

        # 4. Train and compute evaluation metrics 
        result = ModelService().train_model(df, req, job_id=job_id) 

        # 5. Update job status to COMPLETE with JSON payload results 
        crud.update_model_job_status(db, job_id, ModelJobStatus.COMPLETE, result=result)

    except Exception as e: 
        db.rollback() 
        # save exact traceback context on failure 
        error_msg = f"{str(e)}\n{traceback.format_exc()}" 
        crud.update_model_job_status(db, job_id, ModelJobStatus.FAILED, error_message=error_msg)
    finally: 
        db.close()