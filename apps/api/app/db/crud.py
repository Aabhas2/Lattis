from sqlalchemy.orm import Session 
from app.db.models import Dataset, UploadStatus 
from app.db.models import Pipeline, PipelineStatus
from app.db.models import ModelJob, ModelJobStatus
from typing import Optional, Any, List, Dict

def create_dataset(db: Session, filename: str, file_path: str) -> Dataset: 
    db_dataset = Dataset(
        filename=filename, 
        file_path=file_path, 
        current_status=UploadStatus.UPLOADED, 
        profile_data=None 
    )
    
    db.add(db_dataset) 
    db.commit() 
    db.refresh(db_dataset) 

    return db_dataset 


def get_dataset(db: Session,dataset_id) -> Dataset | None: 
    return db.query(Dataset).filter(Dataset.id == dataset_id).first()
    

def update_dataset_profile(db: Session, dataset_id, profile_data: dict) -> Dataset: 
    dataset = get_dataset(db, dataset_id) 

    if not dataset: 
        raise ValueError("Dataset not found")

    dataset.profile_data = profile_data 
    dataset.current_status = UploadStatus.PROFILED

    db.commit() 
    db.refresh(dataset) 

    return dataset 

def create_pipeline(db: Session, dataset_id, name=None) -> Pipeline: 
    pipeline = Pipeline(dataset_id=dataset_id, name=name, operations=[]) 
    db.add(pipeline) 
    db.commit() 
    db.refresh(pipeline) 
    return pipeline 

def get_pipeline(db: Session, pipeline_id) -> Pipeline: 
    return db.query(Pipeline).filter(Pipeline.id == pipeline_id).first() 

def append_pipeline_operation(db: Session, pipeline_id, operation: dict): 
    pipeline = get_pipeline(db, pipeline_id) 
    if not pipeline: raise ValueError("Pipeline not found")

    ops = list(pipeline.operations or []) 
    ops.append(operation) 
    pipeline.operations = ops 

    db.commit() 
    db.refresh(pipeline) 
    return pipeline 

def list_pipelines(db: Session, dataset_id: Optional[Any] = None, skip: int = 0, limit: int = 100) -> List[Pipeline]: 
    query = db.query(Pipeline) 
    if dataset_id is not None: 
        query = query.filter(Pipeline.dataset_id == dataset_id) 
    return query.offset(skip).limit(limit).all() 

def update_pipeline_status(db: Session, pipeline_id: Any, status: PipelineStatus) -> Pipeline: 
    pipeline = get_pipeline(db, pipeline_id) 
    if not pipeline: 
        raise ValueError("Pipeline not found") 
    pipeline.status = status 
    db.commit() 
    db.refresh(pipeline) 
    return pipeline 

def update_pipeline_operations(db: Session, pipeline_id: Any, operations: List[Dict[str, Any]]) -> Pipeline: 
    pipeline = get_pipeline(db, pipeline_id) 
    if not pipeline: 
        raise ValueError("Pipeline not found") 
    pipeline.operations = operations 
    db.commit() 
    db.refresh(pipeline) 
    return pipeline

def create_model_job(db: Session, dataset_id: Any, config: dict) -> ModelJob: 
    job = ModelJob(
        dataset_id=dataset_id, 
        status=ModelJobStatus.QUEUED, 
        config=config 
    )
    db.add(job)
    db.commit() 
    db.refresh(job) 
    return job 

def get_model_job(db: Session, job_id: Any) -> ModelJob | None: 
    return db.query(ModelJob).filter(ModelJob.id == job_id).first() 

def update_model_job_status(
    db: Session, 
    job_id: Any, 
    status: ModelJobStatus, 
    result: dict | None = None, 
    error_message: str | None = None 
) -> ModelJob: 
    job = get_model_job(db, job_id) 
    if not job: 
        raise ValueError("Model training job not found.") 

    job.status = status 
    if result is not None: 
        job.result = result 

    if error_message is not None: 
        job.error_message = error_message 

    db.commit() 
    db.refresh(job) 
    return job 

def list_model_jobs(db: Session, dataset_id: Any) -> List[ModelJob]: 
    return (
        db.query(ModelJob) 
            .filter(ModelJob.dataset_id == dataset_id) 
            .order_by(ModelJob.created_at.desc()) 
            .all() 
    )

