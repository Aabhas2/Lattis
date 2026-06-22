from pydantic import BaseModel 
from typing import List, Dict, Any, Optional 
import uuid 

class ModelTrainRequest(BaseModel): 
    dataset_id: uuid.UUID 
    target_column: str 
    task_type:  str 
    algorithm: str
    train_split: float = 0.8 
    parameters: Optional[Dict[str, Any]] = None 


class FeatureImportance(BaseModel): 
    feature: str 
    importance: float

class ModelTrainResponse(BaseModel): 
    task_type: str 
    algorithm: str 
    metrics: Dict[str, Any] 
    feature_importances: List[FeatureImportance] 
    target_column: str 
    features_used: List[str] 

class ModelTrainQueueResponse(BaseModel): 
    job_id: uuid.UUID 
    status: str 

class ModelJobStatusResponse(BaseModel): 
    job_id: uuid.UUID 
    status: str 
    result: Optional[ModelTrainResponse] = None 
    error_message: Optional[str] = None 