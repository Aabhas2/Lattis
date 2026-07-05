import joblib
import os 
import joblib 
import pandas as pd 
import numpy as np
from pydantic import BaseModel
from typing import Optional
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

@router.get("/datasets/{dataset_id}/visualize") 
def get_dataset_visualization_data(dataset_id: uuid.UUID, model_id: Optional[uuid.UUID] = None, db: Session = Depends(get_db)): 
    # Fetch the dataset record from database 
    dataset = crud.get_dataset(db, dataset_id) 
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found") 

    # Read dataset file from disk 
    file_path = dataset.file_path 
    if not os.path.exists(file_path): 
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    try: 
        if file_path.endswith(".xlsx"): 
            df = pd.read_excel(file_path) 
        else: 
            df = pd.read_csv(file_path) 

    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}") 

    # Identify and normalize numerical features between [-10, 10] 
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist() 

    df_normalized = df.copy() 
    scale_params = {}
    for col in numeric_cols: 
        col_min = df[col].min() 
        col_max = df[col].max() 
        col_mean = df[col].mean()
        
        # Save exact values to scale_params (handle NaN just in case)
        scale_params[col] = {
            "min": float(col_min) if not pd.isna(col_min) else 0.0,
            "max": float(col_max) if not pd.isna(col_max) else 0.0,
            "mean": float(col_mean) if not pd.isna(col_mean) else 0.0
        }
        
        if col_max != col_min:
            # Scale range [col_min, col_max] to [-10.0 to 10.0] 
            df_normalized[col] = -10.0 + 20.0 * (df[col] - col_min) / (col_max - col_min)
        else: 
            df_normalized[col] = 0.0 

        # Fill missing numeric values with 0.0 
        df_normalized[col] = df_normalized[col].fillna(0.0) 

    # Check if there any completed model training runs for this dataset 
    jobs = crud.list_model_jobs(db, dataset_id) 
    completed_jobs = [j for j in jobs if j.status == ModelJobStatus.COMPLETE] 

    active_job = None 
    target_col = None 
    
    if completed_jobs: 
        if model_id:
            active_job = next((j for j in completed_jobs if j.id == model_id), completed_jobs[0])
        else:
            active_job = completed_jobs[0] 
        target_col = active_job.config.get("target_column") 

    # Fallback to auto-detect target column in the dataset if no model is trained yet
    if not target_col:
        potential_targets = ["survived", "target", "class", "label", "y", "output"]
        for col_name in df.columns:
            if col_name.lower() in potential_targets:
                target_col = col_name
                break
        if not target_col and len(df.columns) > 0:
            target_col = df.columns[-1] 

    # Create a mapping for string targets to numbers
    target_mapping = {}
    if target_col and target_col in df.columns:
        if df[target_col].dtype == object or df[target_col].dtype.name == 'category':
            unique_vals = df[target_col].dropna().unique()
            target_mapping = {val: float(idx) for idx, val in enumerate(unique_vals)}

    # Build points array 
    points = [] 
    for idx, row in df.iterrows(): 
        raw_vals = {} 
        coords_vals = {} 
        for col in numeric_cols: 
            # Raw values for tooltips 
            raw_vals[col] = float(row[col]) if not pd.isna(row[col]) else None 
            coords_vals[col] = float(df_normalized.at[idx,col]) 

        # Color-coding classification/regression target values 
        target_val = None 
        if target_col and target_col in df.columns: 
            val = row[target_col] 
            if pd.isna(val):
                target_val = None
            elif isinstance(val, (int, float, bool)):
                target_val = float(val)
            elif val in target_mapping:
                target_val = target_mapping[val]
            else:
                try:
                    target_val = float(val)
                except ValueError:
                    target_val = 0.0

        points.append({
            "id": idx, 
            "raw": raw_vals, 
            "coords": coords_vals, 
            "target": target_val
        })

    # Extract model parameters  
    coefficients = None 
    intercept = None 
    feature_importance = [] 
    tree_data = None 

    if active_job: 
        model_path = os.path.join("storage", "models", f"{active_job.id}.joblib") 
        if os.path.exists(model_path): 
            try: 
                # Load joblib artifacts 
                model_data = joblib.load(model_path) 
                model = model_data.get("model") 
                features_used = model_data.get("features_used", []) 

                # IF pipeline, retrieve the final estimator step 
                estimator = model 
                if hasattr(model, "steps"): 
                    estimator = model.steps[-1][1] 

                # Extract linear coefficients (planes/boundaries)            
                if hasattr(estimator, "coef_"): 
                    coef_val = estimator.coef_ 
                    # If binary logistic regression, coef_ is shape (1, n_features) 
                    if len(coef_val.shape) > 1 and coef_val.shape[0] == 1: 
                        raw_coefs = coef_val[0].tolist() 
                    else:
                        # For multi-class or multi-target, just grab the first one for visualization
                        raw_coefs = coef_val[0].tolist() if len(coef_val.shape) > 1 else coef_val.tolist()
                    
                    coefficients = {}
                    for idx, weight in enumerate(raw_coefs):
                        feature_name = features_used[idx] if idx < len(features_used) else f"Feat_{idx}"
                        coefficients[feature_name] = weight

                if hasattr(estimator, "intercept_"):
                    intercept_val = estimator.intercept_ 
                    if hasattr(intercept_val, "tolist"): 
                        intercept = intercept_val.tolist()
                    else: 
                        intercept = float(intercept_val) 

                # Extract feature importances (pillars) 
                if hasattr(estimator, "feature_importances_"): 
                    importances = estimator.feature_importances_.tolist() 
                    feature_importance = [
                        {"feature": f, "importance": imp}
                        for f, imp in zip(features_used, importances)
                    ] 
                elif hasattr(estimator, "coef_"):
                    # Use absolute value of coefficients as importance for linear models
                    coef_val = estimator.coef_
                    if len(coef_val.shape) > 1:
                        importances = np.abs(coef_val[0]).tolist()
                    else:
                        importances = np.abs(coef_val).tolist()
                    
                    # Normalize importances so they scale nicely like tree importances (0 to 1)
                    max_imp = max(importances) if importances else 1.0
                    if max_imp == 0: max_imp = 1.0
                    
                    feature_importance = [
                        {"feature": f, "importance": imp / max_imp}
                        for f, imp in zip(features_used, importances)
                    ]

                # Extract decision tree node structures recursively 
                from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor 
                from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor 

                tree_estimator = None 
                if isinstance(estimator, (DecisionTreeClassifier, DecisionTreeRegressor)): 
                    tree_estimator = estimator 
                elif isinstance(estimator, (RandomForestClassifier, RandomForestRegressor)): 
                    tree_estimator = estimator.estimators_[0]

                if tree_estimator and hasattr(tree_estimator, "tree_"): 
                    def serialize_scikit_tree(tree, node_id): 
                        # Leaf check: children_left is -1 
                        if tree.children_left[node_id] == -1: 
                            val = tree.value[node_id] 
                            # Resolve class probabilities array if classification 
                            if len (val.shape) > 1: 
                                val = val[0].tolist() 
                            else: 
                                val = val.tolist() 
                            return {
                                "is_leaf": True, 
                                "value": val 
                            }

                        feat_idx = tree.feature[node_id] 
                        feature_name = features_used[feat_idx] if feat_idx < len(features_used) else f"Feat_{feat_idx}"
                        return {
                            "is_leaf": False, 
                            "feature": feature_name, 
                            "threshold": float(tree.threshold[node_id]), 
                            "left": serialize_scikit_tree(tree, tree.children_left[node_id]), 
                            "right": serialize_scikit_tree(tree, tree.children_right[node_id])
                        }
                    tree_data = serialize_scikit_tree(tree_estimator.tree_, 0) 

            except Exception as e: 
                print(f"Warning: Failed to parse visual parameters: {e}") 

    # Determine task type
    task_type = "Classification"
    if active_job:
        algo = active_job.config.get("algorithm", "").lower()
        if "regress" in algo and "logistic" not in algo:
            task_type = "Regression"

    response = {
        "points": points, 
        "target_column": target_col, 
        "coefficients": coefficients, 
        "intercept": intercept, 
        "feature_importance": feature_importance, 
        "tree": tree_data,
        "scale_params": scale_params,
        "task_type": task_type
    }

    # Extract extra Unsupervised/Tree data from the model run result
    if active_job and active_job.result:
        if "cluster_centers" in active_job.result:
            response["cluster_centers"] = active_job.result["cluster_centers"]
        if "feature_names" in active_job.result:
            response["feature_names"] = active_job.result["feature_names"]

    # Compute proper PCA (StandardScaler -> PCA) for K-Means models, or if explicitly requested
    if active_job and active_job.config.get("algorithm", "").lower() == "kmeans":
        try:
            from sklearn.preprocessing import StandardScaler
            from sklearn.decomposition import PCA
            
            # Select raw numeric data, dropping entirely empty columns
            X_raw = df[numeric_cols].dropna(axis=1, how="all")
            
            if X_raw.shape[1] >= 3:
                X_raw = X_raw.fillna(X_raw.median())
                
                # 1. Scale properly to mean=0, var=1 (this centers the PCA projection)
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X_raw)
                
                # 2. Fit PCA
                pca = PCA(n_components=3)
                pca.fit(X_scaled)
            
                response["pca_variance_ratio"] = pca.explained_variance_ratio_.tolist()
                response["pca_components"] = pca.components_.tolist()
                response["pca_mean"] = pca.mean_.tolist()
                
                # Calculate the transformed PCA coordinates for each point so the frontend doesn't have to
                X_pca = pca.transform(X_scaled)
                
                # Scale the PCA output nicely into the [-10, 10] coordinate space bounds of the 3D grid
                # This ensures the projection doesn't exceed the bounds of the visual universe.
                for idx, pt in enumerate(points):
                    # Standard scaling usually puts most data within [-3, 3]. We can roughly scale it up
                    # to [-10, 10] with a multiplier, or just let it sit natively.
                    # Since X_pca is standard scaled, multiplying by 3 gives a nice visual spread.
                    pt["coords"]["pca_x"] = float(X_pca[idx, 0]) * 2.5
                    pt["coords"]["pca_y"] = float(X_pca[idx, 1]) * 2.5
                    pt["coords"]["pca_z"] = float(X_pca[idx, 2]) * 2.5

                if "cluster_centers" in response and len(response["cluster_centers"]) > 0:
                    try:
                        centers_scaled = scaler.transform(response["cluster_centers"])
                        centers_pca = pca.transform(centers_scaled)
                        response["cluster_centers_pca"] = (centers_pca * 2.5).tolist()
                    except Exception as e:
                        print(f"Warning: Failed to compute PCA for cluster centers: {e}")

        except Exception as e:
            print(f"Warning: Failed to compute PCA: {e}")

    return response
                