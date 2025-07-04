import { Gio } from "astal";

export interface MonitorWatcherProps {
    readonly path: string;
    readonly callback: (file: string, event: Gio.FileMonitorEvent) => void;
}
