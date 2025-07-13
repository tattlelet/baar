import { Gio, monitorFile } from "astal";
import { Logger } from "./lang/log";
import { Optional } from "./matcher/optional";

export interface MonitorWatcherProps {
    readonly path: string;
    readonly callback: (file: string, event: Gio.FileMonitorEvent) => void;
}

export class FileManager {
    private static readonly logger: Logger = Logger.get(FileManager);

    constructor(protected readonly watchersProps: MonitorWatcherProps[]) {}

    public async startMonitors(): Promise<Record<string, Optional<Gio.FileMonitor>>> {
        return Object.fromEntries(
            this.watchersProps.map(watcherProps => [
                watcherProps.path,
                Optional.from(monitorFile(watcherProps.path, watcherProps.callback)),
            ])
        );
    }
}
