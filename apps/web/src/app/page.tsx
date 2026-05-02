"use client"
import { useState } from "react";
import { uploadDataset, getDatasetProfile } from "../lib/api";

export default function Page() {
    const [log, setLog] = useState<string | null>(null); 

    const handleFile = async (e:  React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] 
        if (!file) return;  
        try {
            const res = await uploadDataset(file); 
            console.log(res); 
            const profile = await getDatasetProfile(res.dataset_id); 
            console.log(profile); 
            setLog(JSON.stringify({res, profile },null, 2)); 
        } catch (err) {
            console.error(err); 
            setLog(String(err)); 
        }
    };
    return (
        <main>
            <input type="file" onChange={handleFile} />
            <pre>{log}</pre>
        </main>
    );
}