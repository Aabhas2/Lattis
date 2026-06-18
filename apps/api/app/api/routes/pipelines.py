import uuid 
import re
from typing import List, Optional 

import pandas as pd 
from fastapi import APIRouter, Depends, HTTPException 
from sqlalchemy.orm import Session 

from app.db.models import PipelineStatus, UploadStatus 
from app.db.session import get_db 
from app.db import crud 
from app.schemas import pipeline as pipeline_schemas 
from app.services.dataset_service import load_data, profile_dataset  
from app.services.pipeline_service import PipelineService 

router = APIRouter() 

def _to_pipeline_response(pipeline) -> pipeline_schemas.PipelineResponse: 
    operations = [
        pipeline_schemas.PipelineOperation.model_validate(op) 
        for op in (pipeline.operations or []) 
    ]
    return pipeline_schemas.PipelineResponse(
        pipeline_id = pipeline.id,  
        name = pipeline.name, 
        dataset_id = pipeline.dataset_id, 
        operations = operations, 
        status = pipeline.status, 
        created_at = pipeline.created_at, 
        updated_at = pipeline.updated_at, 
    )

@router.post("/", response_model=pipeline_schemas.PipelineCreateResponse) 
def create_pipeline(
    req: pipeline_schemas.PipelineCreateRequest, 
    db: Session = Depends(get_db), 
):
    dataset = crud.get_dataset(db, req.dataset_id) 
    if not dataset: 
        raise HTTPException(status_code=404, detail="Dataset not found") 

    pipeline = crud.create_pipeline(db, req.dataset_id, name=req.name) 
    return {"pipeline_id": pipeline.id}

@router.get("/{pipeline_id}", response_model=pipeline_schemas.PipelineResponse) 
def get_pipeline(pipeline_id: uuid.UUID, db: Session = Depends(get_db)): 
    pipeline = crud.get_pipeline(db, pipeline_id) 
    if not pipeline: 
        raise HTTPException(status_code=404, detail="Pipeline not found") 
    return _to_pipeline_response(pipeline) 

@router.get("", response_model=List[pipeline_schemas.PipelineResponse]) 
def list_pipelines(
    dataset_id: Optional[uuid.UUID] = None, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
): 
    pipelines = crud.list_pipelines(db, dataset_id=dataset_id, skip=skip, limit=limit) 
    return [_to_pipeline_response(p) for p in pipelines]

@router.post("/{pipeline_id}/operations", response_model=pipeline_schemas.PipelineResponse)
def add_pipeline_operation(
    pipeline_id: uuid.UUID, 
    operation: pipeline_schemas.PipelineOperation, 
    db: Session = Depends(get_db), 
): 
    allowed = {"drop_columns", "fill_missing", "remove_duplicates", "convert_type", "rename_columns", "one_hot_encode", "label_encode", "standard_scale", "minmax_scale", "handle_outliers"} 
    if operation.type not in allowed: 
        raise HTTPException(status_code=400, detail=f"Unsupported operation type: {operation.type}")
    
    try:
        pipeline = crud.append_pipeline_operation(
            db, pipeline_id, operation.model_dump() 
        )
    except ValueError as e: 
        raise HTTPException(status_code=404, detail=str(e)) 

    return _to_pipeline_response(pipeline) 

@router.delete("/{pipeline_id}/operations/{index}", response_model=pipeline_schemas.PipelineResponse)
def delete_pipeline_operation(
    pipeline_id: uuid.UUID, 
    index: int, 
    db: Session = Depends(get_db), 
):
    pipeline = crud.get_pipeline(db, pipeline_id) 
    if not pipeline: 
        raise HTTPException(status_code=404, detail="Pipeline not found") 

    ops = list(pipeline.operations or []) 
    if index < 0 or index >= len(ops): 
        raise HTTPException(status_code=400, detail="Invalid operation index") 
    ops.pop(index)  

    try: 
        pipeline = crud.update_pipeline_operations(db, pipeline_id, ops) 
    except ValueError as e: 
        raise HTTPException(status_code=404, detail=str(e)) 

    return _to_pipeline_response(pipeline)
 
@router.post("/{pipeline_id}/preview", response_model=pipeline_schemas.PipelinePreviewResponse) 
def preview_pipeline(
    pipeline_id: uuid.UUID, 
    req: pipeline_schemas.PipelinePreviewRequest = pipeline_schemas.PipelinePreviewRequest(), 
    db: Session = Depends(get_db), 
): 
    pipeline = crud.get_pipeline(db, pipeline_id) 
    if not pipeline: 
        raise HTTPException(status_code=404, detail="Pipeline not found") 

    dataset = crud.get_dataset(db, pipeline.dataset_id) 
    if not dataset: 
        raise HTTPException(status_code=404, detail="Dataset not found") 

    try: 
        df, _ = load_data(dataset.file_path) 
        operations = [
            pipeline_schemas.PipelineOperation.model_validate(op)
            for op in (pipeline.operations or []) 
        ]
        result_df = PipelineService().apply_pipeline(df, operations) 

        preview_df = result_df.head(req.max_preview_rows) 
        preview_df = preview_df.astype(object).where(pd.notnull(preview_df), None) 
        preview = preview_df.to_dict(orient="records") 

        return {
            "rows": len(result_df), 
            "columns": len(result_df.columns),  
            "preview": preview, 
        }
    except ValueError as e: 
        raise HTTPException(status_code=400, detail=str(e)) 
    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")

@router.post("/{pipeline_id}/run", response_model=pipeline_schemas.PipelineRunResponse)
def run_pipeline(pipeline_id: uuid.UUID, db: Session = Depends(get_db)): 
    pipeline = crud.get_pipeline(db, pipeline_id) 
    if not pipeline: 
        raise HTTPException(status_code=404, detail="Pipeline not found") 

    dataset = crud.get_dataset(db, pipeline.dataset_id) 
    if not dataset: 
        raise HTTPException(status_code=404, detail="Dataset not found") 

    # Set status to RUNNING 
    crud.update_pipeline_status(db, pipeline_id, PipelineStatus.RUNNING) 
    
    try: 
        # Load DataFrame 
        df, _ = load_data(dataset.file_path) 

        # Extract pipeline operations 
        operations = [
            pipeline_schemas.PipelineOperation.model_validate(op) 
            for op in (pipeline.operations or []) 
        ]

        # Apply the pipeline transformations 
        result_df = PipelineService().apply_pipeline(df, operations) 

        # Save transformed DataFrame to storage 
        from app.core.config import settings 
        from pathlib import Path 
        storage_path = Path(settings.STORAGE_PATH) / "datasets" 
        storage_path.mkdir(parents=True, exist_ok=True) 
        unique_name = f"{uuid.uuid4()}.csv" 
        new_file_path = storage_path / unique_name 
        result_df.to_csv(new_file_path, index=False) 

        # Create a new Dataset entry in the database 
        # Clean base name 
        base_name = Path(dataset.filename).stem 
        base_name = re.sub(r"_cleaned_v\d+", "", base_name) 
        base_name = re.sub(r"^transformed_", "", base_name) 

        # Query all existing datasets starting with the base name 
        existing_databases = db.query(crud.Dataset).filter(crud.Dataset.filename.like(f"{base_name}%")).all() 

        # Find highest version number 
        max_version = 0 
        pattern = re.compile(rf"^{re.escape(base_name)}_cleaned_v(\d+)\.csv$", re.IGNORECASE) 

        for d in existing_databases: 
            match = pattern.search(d.filename) 
            if match: 
                val = int(match.group(1)) 
                if val > max_version: 
                    max_version = val 

        next_version = max_version + 1 
        new_filename = f"{base_name}_cleaned_v{next_version}.csv"

        # Create versioned Dataset entry in database 
        new_dataset = crud.create_dataset(db, new_filename, str(new_file_path)) 
        
        # Profile the new dataset 
        profiled_data = profile_dataset(str(new_file_path)) 
        crud.update_dataset_profile(db, new_dataset.id, profiled_data)

        # Update pipeline status to COMPLETED 
        crud.update_pipeline_status(db, pipeline_id, PipelineStatus.COMPLETED) 

        return {
            "pipeline_id": pipeline_id, 
            "new_dataset_id": new_dataset.id, 
            "rows": len(result_df), 
            "columns": len(result_df.columns), 
            "message": "Pipeline run successfully and transformed dataset persisted.",
            "filename": new_filename 
        }

    except Exception as e: 
        db.rollback() 
        # Set status to FAILED in case of errors 
        crud.update_pipeline_status(db, pipeline_id, PipelineStatus.FAILED) 
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")
    

@router.put("/{pipeline_id}/operations", response_model=pipeline_schemas.PipelineResponse) 
def update_pipeline_operations(
    pipeline_id: uuid.UUID, 
    operations: List[pipeline_schemas.PipelineOperation], 
    db: Session = Depends(get_db), 
): 
    pipeline = crud.get_pipeline(db, pipeline_id)
    if not pipeline: 
        raise HTTPException(status_code=404, detail="Pipeline not found") 

    ops_dump = [op.model_dump() for op in operations] 

    try: 
        pipeline = crud.update_pipeline_operations(db, pipeline_id, ops_dump) 
    except ValueError as e: 
        raise HTTPException(status_code=404, detail=str(e)) 

    return _to_pipeline_response(pipeline)