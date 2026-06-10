import uuid 
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
    allowed = {"drop_columns", "fill_missing", "remove_duplicates", "convert_type"} 
    if operation.type not in allowed: 
        raise HTTPException(status_code=400, detail=f"Unsupported operation type: {operation.type}")
    
    try:
        pipeline = crud.append_pipeline_operation(
            db, pipeline_id, operation.model_dump() 
        )
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