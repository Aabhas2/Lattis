from fastapi.routing import serialize_response
from pydantic import InstanceOf
from app.schemas.pipeline import PipelineOperation
from typing import List, Dict, Any 
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler, MinMaxScaler 
import pandas as pd 

class PipelineService: 
    def apply_pipeline(self, df: pd.DataFrame, pipeline_operations: List[PipelineOperation]) -> pd.DataFrame: 
        df_copy = df.copy() 

        for operation in pipeline_operations: 
            operation_type = operation.type 
            params = operation.params or {} 

            if operation_type == "drop_columns": 
                df_copy = self.drop_columns(df_copy, params)  
            elif operation_type == "fill_missing": 
                df_copy = self.fill_missing(df_copy, params) 
            elif operation_type == "remove_duplicates": 
                df_copy = self.remove_duplicates(df_copy) 
            elif operation_type == "convert_type": 
                df_copy = self.convert_type(df_copy, params) 
            elif operation_type == "rename_columns": 
                df_copy = self.rename_columns(df_copy, params)
            elif operation_type == "one_hot_encode": 
                df_copy = self.one_hot_encode(df_copy, params) 
            elif operation_type == "label_encode": 
                df_copy = self.label_encode(df_copy, params)
            elif operation_type == "standard_scale": 
                df_copy = self.standard_scale(df_copy, params) 
            elif operation_type == "minmax_scale": 
                df_copy = self.minmax_scale(df_copy, params) 
            elif operation_type == "handle_outliers": 
                df_copy = self.handle_outliers(df_copy, params) 
            else: 
                raise ValueError(f"Unsupported pipeline operation: {operation_type}")
        
        return df_copy 
    

    def drop_columns(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns = params.get("columns", []) 

        if not isinstance(columns, list): 
            raise ValueError("drop_columns expects 'columns' to be a list") 
        
        existing_columns = [column for column in columns if column in df.columns]  
        return df.drop(columns=existing_columns)
        

    def fill_missing(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        column = params.get("column") 
        strategy = params.get("strategy") 
        constant_value = params.get("value") 

        if not column: 
            raise ValueError("fill_missing requires 'column")
        if column not in df.columns: 
            raise ValueError(f"Column `{column} does not exist") 
        
        if not strategy: 
            raise ValueError("fill_missing requires 'strategy'") 
        
        series = df[column] 

        if strategy == "mean": 
            if not pd.api.types.is_numeric_dtype(series):
                raise ValueError(f"Mean fill only works on numeric columns: {column}") 
            fill_value = series.mean()  

        elif strategy == "median": 
            if not pd.api.types.is_numeric_dtype(series): 
                raise ValueError(f"Median fill only works on numeric columns: {column}") 
            fill_value = series.median() 
        
        elif strategy == "mode": 
            mode_values = series.mode(dropna=True) 
            if mode_values.empty: 
                raise ValueError(f"Cannot compute mode for column '{column}") 
            fill_value = mode_values.iloc[0]
        
        elif strategy == "constant": 
            fill_value = constant_value 
        
        else: 
            raise ValueError(f"Unsupported fill strategy: {strategy}")
        
        df_copy = df.copy() 
        df_copy[column] = df_copy[column].fillna(fill_value) 

        return df_copy

    def remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame: 
        return df.drop_duplicates().copy() 

    def convert_type(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        column = params.get("column")  
        target_type = params.get("target_type")

        if not column: 
            raise ValueError("convert_type requires 'column") 
        if column not in df.columns: 
            raise ValueError(f"Column '{column}' does not exist") 
        
        if not target_type: 
            raise ValueError("convert_type requires 'target_type'")
        
        df_copy = df.copy()  
        
        if target_type == "int":  
            df_copy[column] = pd.to_numeric(df_copy[column], errors="raise").astype("Int64")
        
        elif target_type == "float": 
            df_copy[column] = pd.to_numeric(df_copy[column], errors="raise").astype("float64") 

        elif target_type == "category": 
            df_copy[column] = df_copy[column].astype("category") 
        
        elif target_type == "string": 
            df_copy[column] = df_copy[column].astype("string") 
        
        else: 
            raise ValueError(f"Unsupported target type: {target_type}") 
        
        return df_copy 

    def rename_columns(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns_map = params.get("columns_map", {}) 
        if not isinstance(columns_map, dict):
            raise ValueError("rename_columns expects 'columns_map' to be a dictionary")

        for old_col in columns_map.keys(): 
            if old_col not in df.columns: 
                raise ValueError(f"Column '{old_col}' does not exist, cannot rename.") 

        return df.rename(columns=columns_map)

    def one_hot_encode(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns = params.get("columns", [])
        if not isinstance(columns, list): 
            raise ValueError("one_hot_encode expects 'columns' to be a list") 
            
        existing_cols = [c for c in columns if c in df.columns] 
        if not existing_cols: 
            return df 

        encoder = OneHotEncoder(
            handle_unknown=params.get("handle_unknown", "error"), 
            drop=params.get("drop", None), 
            sparse_output=params.get("sparse_output", False), 
            dtype=params.get("dtype", int),
            min_frequency=params.get("min_frequency", None), 
            max_categories=params.get("max_categories", None), 
        )

        # Transform the target columns into a numpy array 
        encoded_array = encoder.fit_transform(df[existing_cols]) 

        encoded_cols = encoder.get_feature_names_out(existing_cols) 

        encoded_df = pd.DataFrame(encoded_array, columns=encoded_cols, index=df.index) 

        return pd.concat([df.drop(columns=existing_cols), encoded_df], axis=1).copy()

    def label_encode(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns = params.get("columns", []) 
        if not isinstance(columns, list): 
            raise ValueError("label_encode expects 'columns' to be a list") 
        
        existing_cols = [c for c in columns if c in df.columns] 
        if not existing_cols: 
            return df 
        
        df_copy = df.copy()  

        # OrdinalEncoder encodes categories to integers (0,1,2,....) 
        # Missing values (NaN) will be kept as np.nan
        encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1) 
        df_copy[existing_cols] = encoder.fit_transform(df_copy[existing_cols]) 

        # Convert output floats to clean nullable integers (Int64) 
        for col in existing_cols: 
            df_copy[col] = df_copy[col].astype("Int64") 

        return df_copy 

    def standard_scale(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns = params.get("columns", []) 
        if not isinstance(columns, list): 
            raise ValueError("standard_scale expects 'columns' to be a list") 

        existing_cols = [c for c in columns if c in df.columns] 
        if not existing_cols: 
            return df 

        df_copy = df.copy() 
        scaler = StandardScaler() 
        df_copy[existing_cols] = scaler.fit_transform(df_copy[existing_cols]) 
        return df_copy 

    def minmax_scale(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns = params.get("columns", []) 
        if not isinstance(columns, list): 
            raise ValueError("minmax_scale expects 'columns' to be a list")

        existing_cols = [c for c in columns if c in df.columns] 

        if not existing_cols: 
            return df 
        
        df_copy = df.copy() 
        scaler = MinMaxScaler() 
        df_copy[existing_cols] = scaler.fit_transform(df_copy[existing_cols]) 
        return df_copy

    def handle_outliers(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame: 
        columns = params.get("columns", []) 
        if not isinstance(columns, list): 
            raise ValueError("handle_outliers expects 'columns' to be a list") 

        strategy = params.get("strategy", "iqr") 
        df_copy = df.copy() 

        for col in columns: 
            if col in df_copy.columns: 
                series = df_copy[col] 
                # Validate the column is numerical 
                if not pd.api.types.is_numeric_dtype(series): 
                    raise ValueError(f"Outlier handling only works on numeric columns. '{col}' is not numeric.")

                if strategy == "iqr": 
                    q1 = series.quantile(0.25) 
                    q3 =series.quantile(0.75) 
                    iqr = q3 - q1 
                    lower_bound = q1 - 1.5 * iqr 
                    upper_bound = q3 + 1.5 * iqr 
                    df_copy[col] = series.clip(lower=lower_bound, upper=upper_bound) 

                elif strategy == "percentile": 
                    lower_pct = float(params.get("lower_percentile", 1)) / 100.0 
                    upper_pct = float(params.get("upper_percentile", 99)) / 100.0 
                    lower_bound = series.quantile(lower_pct) 
                    upper_bound = series.quantile(upper_pct) 
                    df_copy[col] = series.clip(lower=lower_bound, upper=upper_bound) 
                
                else: 
                    raise ValueError(f"Unsupported outlier handling strategy: {strategy}") 

        return df_copy 