# ML Playground

ML Playground is an interactive, web-based sandbox designed for dataset profiling, data cleaning, automated pipeline building, and model training. Built as a high-performance portfolio application, it enables users to upload datasets, analyze feature properties, clean/transform their data step-by-step, and queue machine learning models asynchronously in the background.

---

## 🚀 Tech Stack

### Frontend
* **Framework:** Next.js (React)
* **Styling:** Vanilla CSS & TailwindCSS (Dark theme, glassmorphism UI)
* **Charts & Analytics:** Recharts (Interactive histograms, boxplots, scatter plots, feature importance bar charts)

### Backend
* **API Framework:** FastAPI (Python)
* **Task Queue:** Redis Queue (RQ) for async, non-blocking model training
* **Database:** PostgreSQL with SQLAlchemy ORM
* **Migrations:** Alembic
* **Cache & Broker:** Redis

### Machine Learning
* **Libraries:** Scikit-Learn, XGBoost, LightGBM, Pandas, NumPy

---

## 🛠 Features Implemented (Current State)

### 1. Dataset Profiling & Overview
* CSV/XLSX file upload validation and backend parsing.
* Interactive overview dashboard providing metrics on total rows, columns, missing values, and numerical ratios.
* Column-by-column deep profile insights (detected datatype, null percentage, cardinality, median, standard deviation, and value distribution charts).
* Inline sample table previewing the raw uploaded dataset.

### 2. Interactive Visualizations
* Dynamic scroll-driven correlation matrix map.
* Interactive scatter plots (custom $X$ and $Y$ column selectors).
* Feature-specific boxplots and bin-adjustable histograms.
* Graceful fallback placeholders for empty datasets or non-conforming features.

### 3. Pipeline Builder (Transformations)
* Multi-step pipeline builder with chronological operations lists.
* Data transformations supported:
  * Drop redundant/unused columns.
  * Impute missing values (median, mean, custom placeholders).
  * Datatype cast adjustments.
  * One-hot encoding of categorical variables.
* Instant step preview: Compares post-operation dataset shapes (rows/cols) prior to execution.
* Direct handoff of the generated cleaned dataset version for subsequent modeling.

### 4. Async Model Training Sandbox
* Hyperparameter customization sliders and toggles for multiple estimators:
  * **Regression:** Linear Regression, Ridge, Random Forest, Gradient Boosting, XGBoost, LightGBM.
  * **Classification:** Logistic Regression, Random Forest, Gradient Boosting, SVM, XGBoost, LightGBM.
* Asynchronous background queuing using Redis Queue (RQ) preventing request timeouts.
* Dynamic status polling indicators showing queue states (`queued` ➔ `running` ➔ `complete` / `failed`).
* Model performance evaluation dashboard:
  * R-squared (R²), RMSE, and MAE for regression.
  * Accuracy, Macro F1-score, Macro Precision, and an interactive colored Confusion Matrix for classification.
  * Normalized relative feature importance bar charts.

---

## 📝 Roadmap & Future Goals

- [ ] **Model Download & Export:** Enable downloading trained model files (`.pkl` / `.joblib` / ONNX formats) for local runtime inference.
- [ ] **Code Generation:** Generate standalone Python scripts reproducing the exact cleaning pipeline and model hyperparameters.
- [ ] **Batch Deployments:** Integrate a single-click API deployment block to expose the trained model as a REST API endpoint.
- [ ] **Pre-training scaling:** Add options to standard-scale, min-max normalize, or select features prior to model fit.

---

## 🏁 Usecases

* **ML Education Sandbox:** Great visual aid for teaching how features are drop-mapped, models are fit, and performance metrics vary with custom hyperparameters.
* **Rapid Prototyping:** Allows users to quickly test multiple scikit-learn/gradient boosted models on small-to-medium tabular datasets in minutes without writing code.
