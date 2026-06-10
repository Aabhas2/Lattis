from pydantic import BaseModel 
from typing import List, Optional, Dict, Any  
from datetime import datetime 
import uuid 

from app.db.models import PipelineStatus 

class PipelineOperation(BaseModel): 
    type: str 
    params: Dict[str, Any] = {} 

class PipelineCreateRequest(BaseModel): 
    dataset_id: uuid.UUID  
    name: Optional[str] = None 

class PipelineCreateResponse(BaseModel): 
    pipeline_id: uuid.UUID 

class PipelineResponse(BaseModel): 
    pipeline_id: uuid.UUID 
    name: Optional[str]  
    dataset_id: uuid.UUID 
    operations: List[PipelineOperation]  
    status: PipelineStatus 
    created_at: datetime 
    updated_at: datetime 

class PipelinePreviewRequest(BaseModel): 
    max_preview_rows: int = 100 

class PipelinePreviewResponse(BaseModel): 
    rows: int 
    columns: int 
    preview: List[Dict[str, Any]] 

class PipelineRunResponse(BaseModel): 
    pipeline_id: uuid.UUID 
    new_dataset_id: uuid.UUID 
    rows: int 
    columns: int 
    message: str 
  