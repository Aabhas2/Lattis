import pandas as pd 
from pathlib import Path 
from pandas.errors import EmptyDataError, ParserError
from pandas.api.types import is_numeric_dtype

# Helper functions 
def load_data(file_path: str) -> tuple[pd.DataFrame, str]: 
    path = Path(file_path)
    ext = path.suffix.lower()
    if ext not in {".csv", ".xlsx"}: 
        raise ValueError(f"Unsupported file type: {ext!r}. Only '.csv' and '.xlsx' are supported.")
    
    try:
        if ext == '.xlsx': 
            df = pd.read_excel(path) 
        else: 
            df = pd.read_csv(path) 
    except (FileNotFoundError, PermissionError): 
        raise 
    except (ParserError, EmptyDataError, UnicodeDecodeError, ValueError) as e: 
        raise ValueError(f"Failed to parse file: {path}: ({ext})") from e
    
    return df, ext.lstrip(".")

# Column type detection function 
def detect_column_type(series: pd.Series) -> str: 
    s = series.dropna() 

    # Check boolean first before numeric 
    if set(s.unique()).issubset({True, False, 0, 1}):
        return "Boolean"
    
    if is_numeric_dtype(s): 
        if s.nunique() <= 10 and len(s) > 50: 
            return "Categorical" 
        return "Numerical"
    
    if pd.api.types.is_datetime64_any_dtype(s):
        return "Datetime" 
    
    if s.nunique() / len(s) > 0.5: 
        return "Text" 

    return "Categorical" 
    

def profile_dataset(file_path: str) -> dict: 
    # load the data 
    df, file_type = load_data(file_path) 

    # data profile (about the dataset / dataset info) 
    row_count = len(df) 
    column_count = len(df.columns) 

    df = df.astype(object).where(pd.notnull(df), None)

    columns = [] 
    for col in df.columns: 
        series = df[col]
        # missing values 
        missing_count = series.isnull().sum() 
        missing_percentage = missing_count / len(series) if len(series) > 0 else 0

        # Stats 
        col_type = detect_column_type(series) 

        stats = None  

        if col_type == "Numerical": 
            val = series.mean() 
            mean = float(val) if pd.notna(val) else None 
            min = float(series.min()) if pd.notna(series.min()) else None
            max = float(series.max()) if pd.notna(series.max()) else None 
            median = float(series.median()) if pd.notna(series.median()) else None 
            std = float(series.std()) if pd.notna(series.std()) else None 
            stats = {
                "mean": mean, 
                "min": min, 
                "max": max, 
                "median": median, 
                "std": std, 
            }
        elif col_type in {"Categorical", "Text", "Datetime"}:
            value_counts = series.dropna().astype(str).value_counts().head(5) 
            top_values = [{"value": str(idx), "count": int(val)} for idx, val in value_counts.items()]
            stats = {
                "top_values": top_values, 
                "unique_count": int(series.nunique(dropna=True)), 
            }
        elif col_type == "Boolean": 
            stats = {
                "top_values": [{"value": str(k), "count": int(v)} for k, v in series.value_counts().items()],
                "unique_count": int(series.nunique()), 
            }

        # Column object 
        columns.append({
            "name": col, 
            "dtype": str(series.dtype),
            "nullable": bool(series.isna().any()),
            "unique_count": int(series.nunique(dropna=True)),
            "detected_type": col_type, 
            "missing_count": int(missing_count),
            "missing_percentage": float(missing_percentage),
            "stats": stats
        })

    preview = df.head(10).to_dict(orient="records")

    return {
        "row_count": row_count, 
        "column_count": column_count, 
        "columns": columns, 
        "preview_rows": preview 
    }