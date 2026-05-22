"use client"
import { useState } from "react";
import { getDatasetProfile } from "../lib/api";
import UploadZone from "../components/dataset/UploadZone";
import { DatasetProfile } from "../lib/types";
import DatasetSummary from "../components/dataset/DatasetSummary";
import PreviewTable from "../components/dataset/PreviewTable";
import ColumnTable from "../components/dataset/ColumnTable";

export default function Page() {
    const [profile, setProfile] = useState<DatasetProfile | null>(null); 

    async function handleUploadSuccess(datasetId: string) {
        if (!datasetId) return; 
        try {
            const profile = await getDatasetProfile(datasetId); 
            setProfile(profile); 
        } catch (error) {
            console.error("Failed to fetch the profile:", error); 
        }
        
    }
    return (
        <main className="p-8">
            <UploadZone onUploadSuccess={handleUploadSuccess}/> 
            {profile && (
                <>
                    <DatasetSummary 
                        datasetId={profile.dataset_id}
                        rowCount={profile.row_count}
                        columnCount={profile.column_count}
                    />
                    <PreviewTable previewRows={profile.preview_rows} /> 
                    <ColumnTable columns={profile.columns} />
                </>
            )}
        </main>
    );
}