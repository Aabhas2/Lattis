import { DatasetUploadResponse, DatasetProfile } from "./types";

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
    const response = await fetch (`${BASE_URL}/datasets/${datasetId}/profile`)

    if (!response.ok) {
        throw new Error("Failed to fetch dataset profile")
    }

    return response.json();
}