from fastapi import UploadFile, File, HTTPException, Depends, APIRouter 
from pathlib import Path 
from sqlalchemy.orm import Session 
from app.db.models import  UploadStatus
from app.db.session import get_db
from app.services.storage_service import save_file 
from app.services.dataset_service import profile_dataset
from app.db.crud import update_dataset_profile, get_dataset, create_dataset
from app.schemas.dataset import DatasetUploadResponse, DatasetProfile

router = APIRouter() 
# app = FastAPI()   

# POST /datasets/upload 
@router.post("/upload", response_model=DatasetUploadResponse) 
def upload_dataset(db: Session = Depends(get_db), dataset: UploadFile = File(...)): 
    ALLOWED_TYPES = {"text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    ALLOWED_EXTENSIONS = {".csv", ".xlsx"}

    ext = Path(dataset.filename).suffix.lower() 
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")
    
    # save_file -> file_path (str) 
    file_path = save_file(dataset)

    # Creating dataset 
    db_dataset = create_dataset(db, dataset.filename, file_path)

    try:
        # Profiling the dataset 
        profiled_dataset = profile_dataset(file_path) 

        # Update dataset profile in DB 
        db_dataset = update_dataset_profile(db, db_dataset.id, profiled_dataset)

    except Exception as e: 
        db.rollback()
        try:
            db_dataset.current_status = UploadStatus.ERROR
            db.commit()
        except Exception:
            db.rollback()  
            
        raise HTTPException(status_code=500, detail=f"Profiling data failed: {str(e)}")
        
    return {
        "dataset_id": db_dataset.id, 
        "filename": db_dataset.filename, 
        "status": db_dataset.current_status
    }

# GET /datasets/{dataset_id}/profile 
@router.get("/{dataset_id}/profile", response_model=DatasetProfile) 
def get_dataset_profile(dataset_id: str, db: Session = Depends(get_db)): 
    dataset = get_dataset(db, dataset_id) 

    if not dataset:  
        raise HTTPException(status_code=404, detail="Dataset not found") 
    
    if not dataset.profile_data: 
        raise HTTPException(status_code=400, detail="Profile not ready") 
    
    return {**dataset.profile_data, "dataset_id": str(dataset.id)} 
