export function fmt(v?: number): string {
    if (v === undefined) {
        return "";
    }
    return v.toFixed(1).padStart(5, " ");
}
