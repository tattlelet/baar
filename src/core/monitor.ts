import { App, Gdk } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland";
import { Measured, Timer } from "./timer";
import { Logger } from "./log";
import { Result, Err, Ok } from "./matcher/base";

const hyprlandService = AstalHyprland.get_default();

export class MonitorKey {
    private static logger = Logger.get(MonitorKey);

    public static keyForGdkMonitor(monitor: Gdk.Monitor): string {
        const { width, height } = monitor.get_geometry();
        const model = monitor.get_model();
        const manufacturer = monitor.get_manufacturer();

        return `${manufacturer}-${model}-${width}.${height}`;
    }

    public static keyForHyprlandMonitor(monitor: AstalHyprland.Monitor): string {
        const width = monitor.get_width();
        const height = monitor.get_height();
        const model = monitor.get_model();
        const manufacturer = monitor.get_make();

        return `${manufacturer}-${model}-${width}.${height}`;
    }

    public static mapGdkMonitor(gdkMonitor: Gdk.Monitor): HybridMonitor {
        const keyForGdkMonitor = this.keyForGdkMonitor(gdkMonitor);
        const hyprlandMonitors = hyprlandService.get_monitors();

        let hyprlandMonitor: AstalHyprland.Monitor | undefined = hyprlandMonitors.find(
            monitor => this.keyForHyprlandMonitor(monitor) === keyForGdkMonitor
        );

        if (hyprlandMonitor === undefined) {
            MonitorKey.logger.warn(`Could not map GDK Monitor ${keyForGdkMonitor} to any Hyprland monitors.`);
        }

        return new HybridMonitor(gdkMonitor, hyprlandMonitor);
    }

    public static async monitorMappings(): Promise<HybridMonitor[]> {
        const display = Gdk.Display.get_default();
        if (display === null) {
            MonitorKey.logger.error("No display available.");
            return [];
        }

        const mappings = [];
        for (let gdkMonitorIndex = 0; gdkMonitorIndex < display.get_n_monitors(); gdkMonitorIndex++) {
            const monitor = display.get_monitor(gdkMonitorIndex);
            if (monitor === null) {
                MonitorKey.logger.warn(`Skipping invalid monitor at index ${gdkMonitorIndex}`);
                continue;
            }

            mappings.push(MonitorKey.mapGdkMonitor(monitor));
        }
        return mappings;
    }
}

export class HybridMonitor {
    constructor(
        public readonly gdkMonitor: Gdk.Monitor,
        public readonly hyprlandMonitor?: AstalHyprland.Monitor
    ) {}
}

export class LoadedWidget {
    constructor(
        public readonly hybridMonitor: HybridMonitor,
        public readonly widget: JSX.Element
    ) {}
}

export class MonitorManager {
    private static logger = Logger.get(MonitorManager);
    private static INSTANCE = new MonitorManager();

    private hyprlandMap: Map<AstalHyprland.Monitor, LoadedWidget[]> = new Map();
    private gdkMap: Map<Gdk.Monitor, LoadedWidget[]> = new Map();

    public getWidgets(monitor: Gdk.Monitor): LoadedWidget[] {
        return this.gdkMap.get(monitor)!;
    }

    private constructor() {}

    public static instance() {
        return MonitorManager.INSTANCE;
    }

    private async wrapWidgetPromise(
        hybridMonitor: HybridMonitor,
        promise: Promise<JSX.Element| null>
    ): Promise<Result<LoadedWidget, unknown>> {
        return new Promise<Result<LoadedWidget, any>>((resolve, reject) => {
            promise
                .then(fulfillReason => {
                    if (fulfillReason === null) {
                        resolve(new Err<unknown>(new Error(`widget is null for ${hybridMonitor}`)));
                    } else {
                        resolve(new Ok(new LoadedWidget(hybridMonitor, fulfillReason)));
                    }
                })
                .catch(rejectReason => {
                    resolve(
                        new Err<unknown>(new Error("Failed to create widget for monitor", { cause: rejectReason }))
                    );
                });
        });
    }

    private addToCache(loadedWidget: LoadedWidget): void {
        const gdkMappedWidgets = this.gdkMap.get(loadedWidget.hybridMonitor.gdkMonitor) || [];
        gdkMappedWidgets.push(loadedWidget);
        this.gdkMap.set(loadedWidget.hybridMonitor.gdkMonitor, gdkMappedWidgets);

        const hyprlandMonitor = loadedWidget.hybridMonitor.hyprlandMonitor;
        if (loadedWidget.hybridMonitor.hyprlandMonitor !== null) {
            const hyprlandMappedWidgets = this.hyprlandMap.get(hyprlandMonitor!) || [];
            hyprlandMappedWidgets.push(loadedWidget);
            this.hyprlandMap.set(hyprlandMonitor!, gdkMappedWidgets);
        }
    }

    @Measured(MonitorManager.logger.debug)
    public async applyOnAllMononitor(
        widgetF: (hybridMonitor: HybridMonitor) => Promise<JSX.Element | null>
    ): Promise<LoadedWidget[]> {
        const promises = (await MonitorKey.monitorMappings()).map(hybridMonitor =>
            this.wrapWidgetPromise(hybridMonitor, widgetF(hybridMonitor))
        );

        const loadedWidgets: LoadedWidget[] = [];
        (await Promise.all(promises)).forEach(result =>
            result.match(
                loadedWidget => {
                    loadedWidgets.push(loadedWidget);
                    this.addToCache(loadedWidget);
                },
                e => {
                    MonitorManager.logger.except("Apply widget to monitors", e);
                }
            )
        );

        return loadedWidgets;
    }

    // Todo: Rewrite monitor registration
    public registerEvents(widgetF: (hybridMonitor: HybridMonitor) => Promise<JSX.Element | null>) {
        App.connect("monitor-added", async (_, gdkmonitor) => {
            const timer = new Timer();
            MonitorManager.logger.debug(`monitor-added event for ${gdkmonitor} received.`);
            try {
                const hybridMonitor = MonitorKey.mapGdkMonitor(gdkmonitor);
                (await this.wrapWidgetPromise(hybridMonitor, widgetF(hybridMonitor))).match(
                    loadedWidget => {
                        this.addToCache(loadedWidget);
                        MonitorManager.logger.debug(`new widget added to ${gdkmonitor}.`);
                    },
                    e => {
                        MonitorManager.logger.except("Unable to apply widget to monitor", e);
                    }
                );
            } finally {
                MonitorManager.logger.debug(`Addeding monitor ellapsed ${timer.fmtElapsed()}`);
            }
        });

        App.connect("monitor-removed", async (_, gdkmonitor) => {
            const timer = new Timer();
            try {
                MonitorManager.logger.debug(`monitor-removed event for ${gdkmonitor} received.`);

                const loadedWidgets = this.gdkMap.get(gdkmonitor);
                if (loadedWidgets === null) {
                    MonitorManager.logger.error(`Could not find widget for monitor ${gdkmonitor} on removal event.`);
                    return;
                }

                loadedWidgets?.forEach(loadedWidget => {
                    loadedWidget.widget.destroy();
                    if (this.gdkMap.delete(loadedWidget.hybridMonitor.gdkMonitor)) {
                        MonitorManager.logger.debug(`Removed ${gdkmonitor} from cache.`);
                    }

                    const hyprlandMonitor = loadedWidget.hybridMonitor.hyprlandMonitor;
                    if (hyprlandMonitor !== undefined) {
                        if (this.hyprlandMap.delete(loadedWidget.hybridMonitor.hyprlandMonitor!)) {
                            MonitorManager.logger.debug(`Removed ${hyprlandMonitor} from cache.`);
                        }
                    }
                    MonitorManager.logger.debug(`All widgets destroyed from ${gdkmonitor}.`);
                });
            } finally {
                MonitorManager.logger.debug(`Removing monitor ellapsed ${timer.fmtElapsed()}`);
            }
        });
    }
}
