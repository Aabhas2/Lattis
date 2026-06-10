from app.schemas.pipeline import PipelineOperation
from typing import List, Dict, Any 
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
            df_copy[column] = pd.to_numeric(df_copy[column], errors="raise").astype("int64")
        
        elif target_type == "float": 
            df_copy[column] = pd.to_numeric(df_copy[column], errors="raise").astype("float64") 

        elif target_type == "category": 
            df_copy[column] = df_copy[column].astype("category") 
        
        elif target_type == "string": 
            df_copy[column] = df_copy[column].astype("string") 
        
        else: 
            raise ValueError(f"Unsupported target type: {target_type}") 
        
        return df_copy 

