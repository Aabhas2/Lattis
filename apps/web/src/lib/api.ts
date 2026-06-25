import {
    DatasetUploadResponse,
    DatasetProfile,
    PipelineCreateResponse,
    PipelineResponse,
    PipelinePreviewResponse,
    PipelineOperation,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function uploadDataset(file: File): Promise<DatasetUploadResponse> {
    const formData = new FormData();
    formData.append("dataset", file);
    const response = await fetch(`${BASE_URL}/datasets/upload`, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to upload the dataset! (${response.status}): ${text}`);
    }
    return response.json();
}

export async function getDatasetProfile(datasetId: string): Promise<DatasetProfile> {
    const response = await fetch(`${BASE_URL}/datasets/${datasetId}/profile`)
    if (!response.ok) {
        throw new Error("Failed to fetch dataset profile")
    }
    return response.json();
}

export async function createPipeline(
    datasetId: string,
    name?: string
): Promise<PipelineCreateResponse> {
    const response = await fetch(`${BASE_URL}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, name }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create pipeline (${response.status}): ${text}`);
    }
    return response.json();
}

export async function getPipeline(pipelineId: string): Promise<PipelineResponse> {
    const response = await fetch(`${BASE_URL}/pipelines/${pipelineId}`);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch pipeline (${response.status}): ${text}`);
    }

    return response.json();
}

export async function addPipelineOperation(
    pipelineId: string,
    operation: PipelineOperation
): Promise<PipelineResponse> {
    const response = await fetch(`${BASE_URL}/pipelines/${pipelineId}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to add operation (${response.status}): ${text}`);
    }
    return response.json();
}

export async function previewPipeline(
    pipelineId: string,
    maxPreviewRows: 100
): Promise<PipelinePreviewResponse> {
    const response = await fetch(`${BASE_URL}/pipelines/${pipelineId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_preview_rows: maxPreviewRows }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to preview pipeline (${response.status}): ${text}`);
    }
    return response.json();
}
export async function runPipeline(pipelineId: string): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/pipelines/${pipelineId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to run pipeline (${response.status}): ${text}`);
    }
    return response.json();
}
export async function deletePipelineOperation(
    pipelineId: string,
    index: number
): Promise<PipelineResponse> {
    const response = await fetch(`${BASE_URL}/pipelines/${pipelineId}/operations/${index}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete operation (${response.status}): ${text}`)
    }
    return response.json();
}
export async function getHistogram(
    datasetId: string,
    column: string,
    bins: number = 10
): Promise<any> {
    const response = await fetch(`${BASE_URL}/datasets/${datasetId}/histogram?column=${column}&bins=${bins}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch histogram data (${response.status}): ${text}`);
    }
    return response.json();
}
export async function getBoxplot(
    datasetId: string,
    column: string
): Promise<any> {
    const response = await fetch(`${BASE_URL}/datasets/${datasetId}/boxplot?column=${column}`);
    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to fetch boxplot data (${response.status}): ${text}`);
    }
    return response.json();
}
export async function getScatterplot(
    datasetId: string,
    colX: string,
    colY: string,
    sampleLimit: number = 1000
): Promise<any> {
    const response = await fetch(`${BASE_URL}/datasets/${datasetId}/scatterplot?col_x=${colX}&col_y=${colY}&sample_limit=${sampleLimit}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch scatterplot data (${response.status}): ${text}`);
    }
    return response.json();
}
export async function getCorrelationMatrix(
    datasetId: string
): Promise<any> {
    const response = await fetch(`${BASE_URL}/datasets/${datasetId}/correlation-matrix`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch correlation matrix (${response.status}): ${text}`);
    }
    return response.json();
}
export async function trainModel(
    datasetId: string,
    targetColumn: string,
    taskType: string,
    algorithm: string,
    trainSplit: number = 0.8,
    parameters?: Record<string, any>
): Promise<{ job_id: string; status: "queued" | "running" | "complete" | "failed" }> {
    const response = await fetch(`${BASE_URL}/models/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            dataset_id: datasetId,
            target_column: targetColumn,
            task_type: taskType,
            algorithm: algorithm,
            train_split: trainSplit,
            parameters: parameters || {}
        }),
    });
    if (!response.ok) {
        const text = await response.text()
        throw new Error(text || "Failed to train machine learning model");
    }
    return response.json();
}
export async function getModelJobStatus(
    jobId: string
): Promise<{
    job_id: string;
    status: "queued" | "running" | "complete" | "failed";
    result: any | null;
    error_message: string | null;
}> {
    const response = await fetch(`${BASE_URL}/models/runs/${jobId}/status`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch model training status (${response.status}): ${text}`);
    }
    return response.json();
}

export async function downloadDataset(datasetId: string, filename: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/datasets/${datasetId}/download`);

    if (!response.ok) {
        throw new Error("Failed to download dataset file.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

export async function runPrediction(
    jobId: string,
    inputs: Record<string, number>
): Promise<{ prediction: string; confidence: number | null; task_type: string }> {
    const response = await fetch(`${BASE_URL}/models/runs/${jobId}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to make prediction.")
    }
    return response.json();
}

export async function getDatasetModels(datasetId: string): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/models/datasets/${datasetId}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch model history (${response.status}): ${text}`);
    }
    return response.json();
}