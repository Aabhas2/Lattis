import { ColumnProfile } from "@/src/lib/types";

export function normalizeValue(val: number, colName: string, columns: ColumnProfile[]): number {
    const col = columns.find(c => c.name === colName);
    if (!col || !col.stats) return 0;

    const stats = col.stats as any;
    if (stats.min !== undefined && stats.max !== undefined && stats.min !== null && stats.max !== null) {
        const min = stats.min;
        const max = stats.max;
        if (max !== min) {
            // Map value to [-10,10] range matching threejs boundaries 
            return -10 + 20 * ((val - min) / (max - min));
        }
    }
    return 0;
}