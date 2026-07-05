# Lattis - API Contracts (v0.1) 

This document defines the JSON contracts exchanged between the frontend (Next.js) and the backend (FastAPI). 
Goal: keep responses stable so UI + backend can evolve without breaking each other. 

## Contract conventions  
- All IDs are strings (UUID). 
- Timestamps are ISO 8601 strings. 
- Backend returns plot-ready data (arrays/matrices), not images.
- Large datasets: backend may sample rows/points and must mention sampling in `meta`. 
- Unknown future fields must be ignored by consumers (forward-compatible design).


## Screen → Endpoint Mapping (MVP)

### Screen A — Upload & Inspect
- POST /datasets/upload → returns { datasetId }
- GET /datasets/{datasetId}/profile → DatasetProfile

### Screen B — Problem Setup
- PUT /datasets/{datasetId}/config → DatasetConfig (optional)
- GET /datasets/{datasetId}/profile → DatasetProfile

### Screen C — Pipeline Builder
- POST /datasets/{datasetId}/pipeline-config → PipelineConfig
- GET /datasets/{datasetId}/pipeline-config/{pipelineConfigId} → PipelineConfig

### Screen D — Model Lab
- POST /runs/start → RunStatus (initial)

### Screen E — Results
- GET /runs/{runId}/status → RunStatus
- GET /runs/{runId}/results → RunResult

### Screen F — Visualization
- GET /runs/{runId}/viz → VizPayload


---

## 1) DatasetProfile (MVP) 

### Purpose 
Returned after upload/profile. Powers Screen A and provides enough info to choose a target and configure pipeline. 

### Produced by 
Backend (`GET /datasets/{datasetId}/profile`)

### Consumed by 
Frontend (dataset, preview, stats cards, missingness, column types, warnings) 

### Shape (example JSON) 
```json
{
    "contractVersion": "0.1", 
    "datasetId": "ds_123", 
    "meta": {
        "name": "housing.csv", 
        "rows": 20640, 
        "columns": 10, 
        "uploadedAt": "2026-02-23T10:12:00Z", 
        "sampled": {
            "previewRows": 50, 
            "reason": "UI preview"
        }
    },
    "schema": {
        "columns": [
            {
                "name": "median_income", 
                "role": "feature", 
                "dtype": "numeric", 
                "nullable": false 
            },
            {
                "name": "ocean_proximity", 
                "role": "feature", 
                "dtype": "categorical", 
                "nullable": true 
            }
        ]
    },
    "quality": {
        "missingness": [
            { "column": "total_bedrooms", "missingCount": 208, "missingPct": 1.00 }
        ],
        "duplicates": { "rowDuplicates": 0 },
        "suspectedIdColumns": ["id"]
    },
    "stats": {
        "numeric": [
            {
                "column": "median_income", 
                "count": 2555, 
                "mean": 3.84, 
                "std": 1.90,
                "min": 0.50,
                "p25": 2.56,
                "median": 3.53,
                "p75": 4.74,
                "max": 15.00
            }
        ],
        "categorical": [
            {
                "column": "ocean_proximity", 
                "count": 25959, 
                "uniqueCount": 5, 
                "topValues": [
                    { "value": "<1H OCEAN", "count": 8134 }, 
                    { "value": "INLAND", "count": 6551}
                ]
            }
        ]
    },
    "preview": {
        "rows": [
            {
                "median_income": 8.32, 
                "ocean_proximity": "NEAR BAY"
            }
        ]
    },
    "suggestions": {
        "targetCandidates": [
            { "column": "median_house_value", "taskHint": "regression", "confidence": 0.78 }
        ]
    }, 
    "warnings": [
        {
            "code": "HIGH_MISSINGNESS", 
            "severity": "medium", 
            "message": "Column total_bedrooms has missing values (1.0%). Consider imputation."
        }
    ]
}
```

## 2) PipelineConfig

### Purpose 
Represents the user-defined preprocessing + feature engineering pipeline that will be applied before model training. 
This contract is the 'recipe' that makes runs reproducible: same dataset + same PipelineConfig &rarr; same transformed features. 

### Produced by 
- `POST /datasets/{datasetId}/pipeline-config` (create) 
- `PUT /datasets/{datasetId}/pipeline-config/{pipelineConfigId}` (update) 
- `GET /datasets/{datasetId}/pipeline-config/{pipelineConfigId}` (fetch) 


### Consumed by 
Fronted (Screen C: Pipeline Builder) and Backend training job (to build an sklearn Pipeline). 


### Shape (example JSON)  
```json 
{
    "contractVersion": "0.1", 
    "pipelineConfigId": "pc_123", 
    "datasetId": "ds_123", 
    "createdAt": "2026-02-23T12:10:00Z",
    "updatedAt": "2026-02-23T12:20:00Z",

    "steps": [
        {
            "id": "step_1", 
            "name": "imputation", 
            "enabled": true, 
            "params": {
                "numericStrategy": "median", 
                "categoricalStrategy": "most_frequent"
            }
        },
        {
            "id": "step_2", 
            "name": "encoding", 
            "enabled": true, 
            "params": {
                "categorical": "onehot", 
                "handleUnknown": "ignore"
            }
        },
        {
            "id": "step_3", 
            "name": "scaling", 
            "enabled": true, 
            "params": {
                "method": "standard"
            }
        },
        {
            "id": "step_4", 
            "name": "drop_columns", 
            "enabled": false, 
            "params": {
                "columns": [] 
            }
        }
    ],
    "featureSelection": {
        "enabled": false, 
        "method": null, 
        "params": {} 
    },

    "validation": {
        "status": "ok", 
        "warnings": [
            {
                "code": "HIGH_CARDINALITY", 
                "severity": "low", 
                "message": "Column 'zipcode' has 1200 unique values. One-hot encoding may create many features."
            }
        ],
        "errors": [] 
    }
}
```

## 3) RunStatus

### Purpose 
Represents the current state of a training run so the frontend can show progress, handle polling, and display clear messages (queued &rarr; running &rarr; completed/failed). 
This powers the "job status" UI for Screen D/E and prevents the user from guessing what's happening. 

### Produced by 
Backend (job system / API reads from DB + queue state) 
* `GET /runs/{runId}/status` 
(Optionally returned immediately from POST /runs/start as the initial status.)

### Consumed by 
Frontend (progress UI, polling, retry button, error display) 

### Shape (example JSON) 
```json 
{
  "contractVersion": "0.1",
  "runId": "run_123",
  "datasetId": "ds_123",
  "pipelineConfigId": "pc_123",

  "state": "running",
  "stage": "TRAINING_MODELS",

  "progress": {
    "current": 1,
    "total": 3,
    "unit": "models"
  },

  "message": "Training models (1/3): LogisticRegression",
  "startedAt": "2026-02-23T13:05:00Z",
  "updatedAt": "2026-02-23T13:06:12Z",
  "finishedAt": null,

  "etaSeconds": null,

  "error": null,

  "links": {
    "results": "/runs/run_123/results",
    "viz": "/runs/run_123/viz"
  }
}
```

### Allowed values (MVP) 
- `state`: `"queued" | "running" | "succeeded" | "failed" | "canceled"`
- `stage`: 
  - `"QUEUED"` 
  - `"LOADING_DATA"` 
  - `"BUILDING_PIPELINE"`
  - `"TRAINING_MODELS"` 
  - `"COMPUTING_METRICS"`
  - `"GENERATING_VIZ"`
  - `"DONE"`

### Error Shape (when failed) 
If `state = "failed"`, `error` becomes: 
```json
{
    "code": "TRAINING_ERROR",
    "message": "Model training failed due to invalid input.", 
    "details": "Found NaN in target column after filtering.", 
    "retryable": true 
}
```

## 4) RunRequest (MVP) 

### Purpose 
Defines **what experiment to run**: dataset + target/task + pipelineConfig + selected models + evaluation settings. 
This is the payload the frontend sends to start a training job. It should be small, explicit, reproducible. 

### Sent to 
Backend `POST /runs/start` 

### Produced by 
Frontend (Screen D: Model Lab) 

### Consumed by 
Backend worker/job runner (RQ job uses this to train + evaluate) 

### Shape (example JSON) 
```json 
{
  "contractVersion": "0.1",
  "datasetId": "ds_123",

  "problem": {
    "taskType": "classification",
    "targetColumn": "churn",
    "features": {
      "includeColumns": null,
      "excludeColumns": ["customer_id"]
    }
  },

  "pipelineConfigId": "pc_123",

  "evaluation": {
    "split": {
      "method": "train_test",
      "testSize": 0.2,
      "randomSeed": 42,
      "stratify": true
    },
    "crossValidation": null
  },

  "models": [
    {
      "modelId": "logreg",
      "displayName": "Logistic Regression",
      "params": {
        "C": 1.0,
        "max_iter": 1000
      }
    },
    {
      "modelId": "rf_clf",
      "displayName": "Random Forest",
      "params": {
        "n_estimators": 200,
        "max_depth": null
      }
    }
  ],

  "artifacts": {
    "saveTrainedPipeline": true,
    "savePredictions": true
  },

  "notes": "Baseline classification run for churn dataset"
}
```

### Notes 
- `problem` is inside RunRequest so the run is self-contained (even if you also store it separately). 
- `pipelineConfigId` references the PipelineConfig contract (keeps this request small).
- `models[].modelId` must match the backend `ml/registry.py`.


## 5) RunResult (MVP) 

### Purpose 
Returns the final outputs of a completed run: model leaderboard, metrics, selected "best model", and plot-ready data for 2D charts. 
This powers Screen E (Results & Comparison). 

### Produced by 
Backend `GET /runs/{runId}/results` 

### Consumed by 
Frontend (leaderboard UI, metrics detail page, charts)  

### Shape (example JSON) 
```json
{
  "contractVersion": "0.1",
  "runId": "run_123",
  "datasetId": "ds_123",
  "pipelineConfigId": "pc_123",

  "problem": {
    "taskType": "classification",
    "targetColumn": "churn"
  },

  "status": {
    "state": "succeeded",
    "startedAt": "2026-02-23T13:05:00Z",
    "finishedAt": "2026-02-23T13:06:40Z",
    "durationSeconds": 100
  },

  "summary": {
    "bestModelId": "rf_clf",
    "primaryMetric": "f1",
    "sortedBy": "f1"
  },

  "leaderboard": [
    {
      "modelId": "rf_clf",
      "displayName": "Random Forest",
      "metrics": {
        "accuracy": 0.89,
        "precision": 0.86,
        "recall": 0.83,
        "f1": 0.845,
        "rocAuc": 0.92
      },
      "trainSeconds": 2.1
    },
    {
      "modelId": "logreg",
      "displayName": "Logistic Regression",
      "metrics": {
        "accuracy": 0.85,
        "precision": 0.81,
        "recall": 0.79,
        "f1": 0.80,
        "rocAuc": 0.88
      },
      "trainSeconds": 0.4
    }
  ],

  "details": {
    "rf_clf": {
      "paramsUsed": {
        "n_estimators": 200,
        "max_depth": null
      },
      "confusionMatrix": {
        "labels": ["no", "yes"],
        "matrix": [[120, 10], [15, 55]]
      },
      "rocCurve": {
        "fpr": [0.0, 0.1, 0.2, 1.0],
        "tpr": [0.0, 0.6, 0.85, 1.0],
        "thresholds": [1.0, 0.7, 0.4, 0.0]
      },
      "calibration": null
    }
  },

  "predictions": {
    "saved": true,
    "downloadUrl": "/runs/run_123/artifacts/predictions.csv"
  },

  "artifacts": {
    "trainedPipeline": {
      "saved": true,
      "downloadUrl": "/runs/run_123/artifacts/pipeline.joblib"
    }
  },

  "warnings": []
}
```

### Metrics sets 
- **Regression metrics:** `r2`, `rmse`, `mae` 
- **Classification metrics:** `accuracy`, `precision`, `recall`, `f1`, `rocAuc`
- Backend should choose a `primaryMetric` per task: 
  - regression: `rmse` (lower is better) or `r2` (higher is better), pick one and stay consistent 
  - classification: `f1` (good default) 

## 6) VizPayload (MVP) 

### Purpose 
Provides **render-ready visualization data** for the frontend (2D/3D). 
For MVP, this primarily powers **Screen F (Signature Visualization)** using Three.js, and may also support 2D plots if needed. 

Key Idea: backend returns **points + styling/grouping info**, not images. 

### Produced by 
Backend `GET /runs/{runId}/viz` 

### Consumed by 
Frontend (Three.js scene via `react-three-fiber`, tooltips, legend, filtering)

### Variant A (MVP): Classification - 3D Embedding Scatter (PCA/UMAP) 
#### Shape (example JSON) 
```json
{
  "contractVersion": "0.1",
  "runId": "run_123",
  "modelId": "rf_clf",

  "viz": {
    "type": "embedding_scatter_3d",
    "method": "pca",
    "dimensions": 3,
    "sampling": {
      "applied": true,
      "maxPoints": 3000,
      "strategy": "random",
      "reason": "performance"
    }
  },

  "axes": {
    "x": { "label": "PC1" },
    "y": { "label": "PC2" },
    "z": { "label": "PC3" }
  },

  "legend": [
    { "key": "no", "label": "No", "colorHint": "class_no" },
    { "key": "yes", "label": "Yes", "colorHint": "class_yes" },
    { "key": "misclassified", "label": "Misclassified", "colorHint": "error" }
  ],

  "points": [
    {
      "id": "p_001",
      "x": 1.23,
      "y": -0.44,
      "z": 0.17,
      "trueLabel": "yes",
      "predLabel": "no",
      "group": "misclassified",
      "confidence": 0.62,
      "meta": {
        "rowIndex": 18
      }
    },
    {
      "id": "p_002",
      "x": -0.12,
      "y": 0.91,
      "z": -1.05,
      "trueLabel": "no",
      "predLabel": "no",
      "group": "no",
      "confidence": 0.88,
      "meta": {
        "rowIndex": 19
      }
    }
  ],

  "uiHints": {
    "defaultPointSize": 1.6,
    "hoverFields": ["trueLabel", "predLabel", "confidence"]
  }
}
```

### Variant B (Alternative MVP): Regression - 3D Residual Scatter 
#### Shape (example JSON) 
```json
{
  "contractVersion": "0.1",
  "runId": "run_456",
  "modelId": "rf_reg",

  "viz": {
    "type": "residual_scatter_3d",
    "dimensions": 3,
    "sampling": {
      "applied": true,
      "maxPoints": 5000,
      "strategy": "random",
      "reason": "performance"
    }
  },

  "axes": {
    "x": { "label": "y_true" },
    "y": { "label": "y_pred" },
    "z": { "label": "residual (y_true - y_pred)" }
  },

  "points": [
    {
      "id": "p_001",
      "x": 210000.0,
      "y": 198500.0,
      "z": 11500.0,
      "absError": 11500.0,
      "group": "error_band_medium",
      "meta": { "rowIndex": 7 }
    }
  ],

  "bands": [
    { "key": "error_band_low", "label": "|error| < 5k", "colorHint": "low" },
    { "key": "error_band_medium", "label": "5k–20k", "colorHint": "mid" },
    { "key": "error_band_high", "label": "> 20k", "colorHint": "high" }
  ],

  "uiHints": {
    "defaultPointSize": 1.4,
    "hoverFields": ["x", "y", "z", "absError"]
  }
}
```

### Notes (MVP standards to follow) 
- Always include `sampling` (real datasets can be huge) 
- Always include `axes` (so UI labels are meaningful) 
- Use `modelId` so the frontend can switch visualization per model 
- Keep `points` consistent: `id, x, y, z, group, meta` 
- `colorHint` is deliberate: frontend can map it to a theme later 