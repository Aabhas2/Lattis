import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID

class UploadStatus(str, enum.Enum): 
    UPLOADED = "uploaded" 
    PROFILED = "profiled" 
    ERROR = "error" 

class Base(DeclarativeBase): 
    pass 

class Dataset(Base): 
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False) 
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    profile_data = Column(JSONB, nullable=True)
    current_status = Column(Enum(UploadStatus, name="upload_status"), nullable=False, default=UploadStatus.UPLOADED)

class PipelineStatus(str, enum.Enum): 
    DRAFT = "draft" 
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed" 

class Pipeline(Base): 
    __tablename__ = "pipeline" 
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4) 
    name = Column(String, nullable=True) 
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True)
    operations = Column(JSONB, nullable=False, default=[]) 
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))  
    status = Column(Enum(PipelineStatus, name = "pipeline_status"), nullable=False, default=PipelineStatus.DRAFT)