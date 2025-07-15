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

export function* gobbler(dir: Gio.File): Iterable<Gio.File> {
    const enumerator = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
    try {
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            yield dir.get_child(fileInfo.get_name());
        }
    } finally {
        enumerator.close(null);
    }
}

export function tryLoadFileTrimmedSafe(file: Optional<Gio.File>): Optional<string> {
    return file.flatMap(file => {
        const [ok, contents] = file.load_contents(null);
        if (!ok || !contents) {
            return Optional.none();
        }

        const decoder = new TextDecoder('utf-8');
        const trimmed = decoder.decode(contents).trim();
        return trimmed.length > 0 ? Optional.some(trimmed) : Optional.none();
    });
}
