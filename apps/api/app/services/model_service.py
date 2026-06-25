import joblib
import os 
import joblib
import numpy as np 
import pandas as pd 
from typing import Dict, Any, List 
from sklearn.model_selection import train_test_split 
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.svm import SVC 
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score 
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix 

from app.schemas.model import ModelTrainRequest 

try:
    from xgboost import XGBRegressor, XGBClassifier
    XGB_AVAILABLE = True 
except ImportError: 
    XGB_AVAILABLE = False 

try: 
    from lightgbm import LGBMClassifier, LGBMRegressor 
    LGBM_AVAILABLE = True 
except ImportError: 
    LGBM_AVAILABLE = False 

class ModelService: 
    def train_model(self, df: pd.DataFrame, req: ModelTrainRequest, job_id: str = None) -> Dict[str, Any]: 
        if req.target_column not in df.columns: 
            raise ValueError(f"Target column '{req.target_column}' does not exist in dataset.")

        # Preprocessing and cleaning 
        # Drop rows where target is missing 
        df_clean = df.dropna(subset=[req.target_column]) 
        if len(df_clean) < 10: 
            raise ValueError("Dataset has too few samples for training (less than 10).") 

        y = df_clean[req.target_column] 
        X = df_clean.drop(columns=[req.target_column]) 

        # Exclude non-numeric columns for feature set 
        X = X.select_dtypes(include=[np.number]) 
        if X.empty: 
            raise ValueError("No numeric features available for training. Ensure you encode categorical variables.") 

        # Impute missing values in features with median 
        X = X.fillna(X.median()) 
        features_used = X.columns.tolist()  

        # Train test split 
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, train_size=req.train_split, random_state=42
        )

        # Clean parameter values from the frontend (e.g., converting string "None" to Python None)
        raw_params = req.parameters or {}
        params = {}
        for k, v in raw_params.items():
            if v is None or v == "None" or v == "none" or v == "":
                params[k] = None
            else:
                params[k] = v

        # Model Selection 
        model = None
        le = None 
        if req.task_type == "regression": 
            if req.algorithm == "linear_regression": 
                model = LinearRegression(
                    fit_intercept=params.get("fit_intercept", True), 
                    n_jobs=-1
                )
            elif req.algorithm == "ridge": 
                model = Ridge(
                    alpha=float(params.get("alpha", 1.0)), 
                    random_state=42
                )
            elif req.algorithm == "random_forest": 
                model = RandomForestRegressor(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    max_depth=params.get("max_depth", None), 
                    min_samples_split=int(params.get("min_samples_split", 2)), 
                    n_jobs=-1,
                    random_state=42 
                )
            elif req.algorithm == "gradient_boosting": 
                model = GradientBoostingRegressor(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    learning_rate=float(params.get("learning_rate", 0.1)), 
                    max_depth=int(params.get("max_depth", 3)), 
                    random_state=42 
                )
            elif req.algorithm == "xgboost": 
                if not XGB_AVAILABLE:
                    raise ValueError("XGBoost is not installed on the server. Please run 'pip install xgboost' to use this model.")
                model = XGBRegressor(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    max_depth=int(params.get("max_depth", 6)), 
                    learning_rate=float(params.get("learning_rate", 0.1)), 
                    n_jobs=-1, 
                    random_state=42 
                )
            elif req.algorithm == "lightgbm":
                if not LGBM_AVAILABLE:
                    raise ValueError("LightGBM is not installed on the server. Please run 'pip install lightgbm' to use this model.")
                model = LGBMRegressor(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    max_depth=int(params.get("max_depth", -1)), 
                    learning_rate=float(params.get("learning_rate", 0.1)), 
                    n_jobs=-1, 
                    random_state=42 
                )
            else: 
                raise ValueError(f"Unsupported regression algorithm: {req.algorithm}") 

        elif req.task_type == "classification": 
            if y_train.nunique() > 20: 
                raise ValueError("Target column has too many unique values for a classification task.") 

            if req.algorithm == "logistic_regression": 
                model = LogisticRegression(
                    C=float(params.get("C", 1.0)), 
                    max_iter=int(params.get("max_iter", 1000)), 
                    solver=params.get("solver", "lbfgs"), 
                    n_jobs=-1, 
                    random_state=42 
                )
            elif req.algorithm == "random_forest": 
                model = RandomForestClassifier(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    max_depth=params.get("max_depth", None), 
                    class_weight=params.get("class_weight", None), 
                    n_jobs=-1,
                    random_state=42
                )
            elif req.algorithm == "gradient_boosting": 
                model = GradientBoostingClassifier(
                    n_estimators=int(params.get("n_estimators", 100)),
                    learning_rate=float(params.get("learning_rate", 0.1)), 
                    max_depth=int(params.get("max_depth", 3)), 
                    random_state=42 
                )
            elif req.algorithm == "svm": 
                model = SVC(
                    C=float(params.get("C", 1.0)), 
                    kernel=params.get("kernel", "rbf"), 
                    probability=True, 
                    random_state=42
                )
            elif req.algorithm == "xgboost": 
                if not XGB_AVAILABLE:
                    raise ValueError("XGBoost is not installed on the server. Please run 'pip install xgboost' to use this model.")
                from sklearn.preprocessing import LabelEncoder
                le = LabelEncoder()
                y_train = le.fit_transform(y_train) 
                y_test = le.transform(y_test) 

                model = XGBClassifier(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    max_depth=int(params.get("max_depth", 6)), 
                    learning_rate=float(params.get("learning_rate", 0.1)), 
                    n_jobs=-1, 
                    random_state=42 
                )
            elif req.algorithm == "lightgbm":
                if not LGBM_AVAILABLE:
                    raise ValueError("LightGBM is not installed on the server. Please run 'pip install lightgbm' to use this model.")
                model = LGBMClassifier(
                    n_estimators=int(params.get("n_estimators", 100)), 
                    max_depth=int(params.get("max_depth", -1)), 
                    learning_rate=float(params.get("learning_rate", 0.1)), 
                    n_jobs=-1, 
                    random_state=42 
                )
            else: 
                raise ValueError(f"Unsupported classification algorithm: {req.algorithm}") 
        else: 
            raise ValueError(f"Unsupported task type: {req.task_type}") 

        # Training 
        model.fit(X_train, y_train) 

        # Inference & Evaluation
        preds = model.predict(X_test) 
        metrics = {} 
        if req.task_type == "regression": 
            metrics = {
                "rmse": float(np.sqrt(mean_squared_error(y_test, preds))), 
                "mae": float(mean_absolute_error(y_test, preds)), 
                "r2": float(r2_score(y_test, preds))
            }
        else: 
            cm = confusion_matrix(y_test, preds) 
            classes = sorted(list(set(y_test.tolist())) if req.algorithm == "xgboost" else y_train.unique().tolist()) 
            classes_labels = [str(le.inverse_transform([c])[0]) for c in classes] if req.algorithm == "xgboost" else [str(c) for c in classes] 

            metrics = {
                "accuracy": float(accuracy_score(y_test, preds)),
                "precision": float(precision_score(y_test, preds, average="macro", zero_division=0)), 
                "recall": float(recall_score(y_test, preds, average="macro", zero_division=0)), 
                "f1": float(f1_score(y_test, preds, average="macro", zero_division=0)), 
                "confusion_matrix": cm.tolist(), 
                "classes": classes_labels
            }

        # Extract feature importance / weights (DE-INDENTED OUT OF ELSE BLOCK)
        importances = [] 
        if hasattr(model, "feature_importances_"): 
            weights = model.feature_importances_ 
        elif hasattr(model, "coef_"): 
            # Linear model: take abs weight coefficients as importances  
            if req.task_type == "classification" and len(model.coef_) > 1: 
                weights = np.mean(np.abs(model.coef_), axis=0) 
            else: 
                weights = np.abs(model.coef_.flatten()) 
        else: 
            weights = np.zeros(len(features_used)) 

        # Normalize weights
        total_weight = np.sum(weights) 
        if total_weight > 0: 
            weights = weights / total_weight 

        for col, weight in zip(features_used, weights): 
            importances.append({
                "feature": col, 
                "importance": float(weight)
            })

        # Sort weights cleanly using parameter x
        importances = sorted(importances, key=lambda x: x["importance"], reverse=True)

        # Save model artifacts if job_id is provided 
        if job_id:
            # Ensure storage/models directory exists 
            model_dir = os.path.join("storage","models") 
            os.makedirs(model_dir, exist_ok=True) 

            model_path = os.path.join(model_dir, f"{job_id}.joblib") 
            model_data = {
                "model": model, 
                "features_used": features_used, 
                "target_column": req.target_column, 
                "task_type": req.task_type, 
                "label_encoder": le # Saves the LabelEncoder (if used by XGBoost)
            }
            joblib.dump(model_data, model_path) 

        return {
            "task_type": req.task_type, 
            "algorithm": req.algorithm, 
            "metrics": metrics, 
            "feature_importances": importances, 
            "target_column": req.target_column, 
            "features_used": features_used 
        }
