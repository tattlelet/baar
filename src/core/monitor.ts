import { App, Gdk, Gtk } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland";
import { Logger } from "./lang/log";
import { Measured } from "./lang/timer";
import { Resultify } from "./matcher/helpers";
import { Optional } from "./matcher/optional";

export class MonitorKey {
    private static logger = Logger.get(MonitorKey);
    private static hyprlandService = AstalHyprland.get_default();

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
        const hyprlandMonitors = MonitorKey.hyprlandService.get_monitors();

        let hyprlandMonitor: AstalHyprland.Monitor | undefined = hyprlandMonitors.find(
            monitor => this.keyForHyprlandMonitor(monitor) === keyForGdkMonitor
        );

        if (hyprlandMonitor === undefined) {
            MonitorKey.logger.warn(`Could not map GDK Monitor ${keyForGdkMonitor} to any Hyprland monitor`);
        }

        return new HybridMonitor(gdkMonitor, Optional.from(hyprlandMonitor));
    }

    public static async monitorMappings(): Promise<HybridMonitor[]> {
        const display = Gdk.Display.get_default();
        if (display === null) {
            MonitorKey.logger.error("No display available");
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
    public readonly gdkMonitorKey: string;
    public readonly hyprlandMonitorKey: Optional<string>;
    public readonly key: string;

    constructor(
        public readonly gdkMonitor: Gdk.Monitor,
        public readonly hyprlandMonitor: Optional<AstalHyprland.Monitor>
    ) {
        this.gdkMonitorKey = MonitorKey.keyForGdkMonitor(this.gdkMonitor);
        this.hyprlandMonitorKey = this.hyprlandMonitor.apply(MonitorKey.keyForHyprlandMonitor);
        this.key = this.hyprlandMonitorKey.getOr(this.gdkMonitorKey);
    }
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

    private addToCache(loadedWidget: LoadedWidget): void {
        const gdkMappedWidgets = this.gdkMap.get(loadedWidget.hybridMonitor.gdkMonitor) || [];
        gdkMappedWidgets.push(loadedWidget);
        this.gdkMap.set(loadedWidget.hybridMonitor.gdkMonitor, gdkMappedWidgets);

        const hyprlandMonitor = loadedWidget.hybridMonitor.hyprlandMonitor;
        if (loadedWidget.hybridMonitor.hyprlandMonitor.isSome()) {
            const monitor = hyprlandMonitor.unwrap();
            const hyprlandMappedWidgets = this.hyprlandMap.get(monitor) || [];
            hyprlandMappedWidgets.push(loadedWidget);
            this.hyprlandMap.set(monitor, gdkMappedWidgets);
        }
    }

    @Measured(MonitorManager.logger.debug)
    public async applyOnAllMononitor(
        widgetF: (hybridMonitor: HybridMonitor) => Promise<JSX.Element | null>,
        monitors = MonitorKey.monitorMappings()
    ): Promise<Optional<Promise<LoadedWidget[]>>> {
        /*
         * A Promise of monitors has to be mapped into a Promise of widgets and then flattened into
         * a Promise of LoadedWidgets, filtered by the ones that aren't null/empty. Because the
         * transformations are all done on Promises and are non-blocking, this has to be handled inside
         * Promise.all. Because the mappings for monitors themselves can have issues of their own, we
         * end up with a Promise, holding an Optional which holds a Promise.all.
         */
        return Resultify.promise(monitors).then(result => {
            const monitors = result.match(Optional.from, err => {
                MonitorManager.logger.error("Failed loading monitors", err);
                return Optional.none<HybridMonitor[]>();
            });

            return monitors.apply(monitors => {
                const promises: Promise<[HybridMonitor, Optional<Gtk.Widget>]>[] = monitors.map(monitor =>
                    Resultify.promise(widgetF(monitor)).then(widgetLoaded =>
                        widgetLoaded.match(
                            v => [monitor, Optional.from(v)],
                            e => {
                                MonitorManager.logger.error(`Apply widget to monitor ${monitor.key} failed`, e);
                                return [monitor, Optional.none<Gtk.Widget>()];
                            }
                        )
                    )
                );

                return Promise.all(promises).then(all => {
                    all.filter(([_, widget]) => widget.isNone()).forEach(([hybridMonitor, _]) =>
                        MonitorManager.logger.warn(`Widget is null for ${hybridMonitor.key}, skipping`)
                    );

                    const loadedWidgets = all
                        .filter(([_, widget]) => widget.isSome())
                        .map(([hybridMonitor, widget]) => new LoadedWidget(hybridMonitor, widget.unwrap()));

                    loadedWidgets.forEach(loadedWidget => {
                        this.addToCache(loadedWidget);
                        MonitorManager.logger.info(`Loaded widget for ${loadedWidget.hybridMonitor.key}`);
                    });

                    return loadedWidgets;
                });
            });
        });
    }

    @Measured(MonitorManager.logger.debug)
    public async destroyWidgets(monitor: HybridMonitor): Promise<boolean> {
        const loadedWidgets = Optional.from(this.gdkMap.get(monitor.gdkMonitor));
        if (loadedWidgets.isNone()) {
            MonitorManager.logger.warn(`Could not find widget for monitor ${monitor.key} on removal event`);
            return true;
        }

        loadedWidgets.unwrap().forEach(loadedWidget => {
            loadedWidget.widget.destroy();
            MonitorManager.logger.info(`Widget destroyed from ${monitor.key}`);
            if (this.gdkMap.delete(loadedWidget.hybridMonitor.gdkMonitor)) {
                MonitorManager.logger.debug(`Removed ${monitor.key} from cache`);
            }

            const hyprlandMonitor = loadedWidget.hybridMonitor.hyprlandMonitor;
            if (hyprlandMonitor.isSome()) {
                if (this.hyprlandMap.delete(hyprlandMonitor.unwrap())) {
                    MonitorManager.logger.debug(`Removed ${loadedWidget.hybridMonitor.key} from cache`);
                }
            }
            MonitorManager.logger.debug(`Widget Cache cleared for ${monitor.key}`);
        });

        return true;
    }

    public registerEvents(widgetF: (hybridMonitor: HybridMonitor) => Promise<JSX.Element | null>) {
        App.connect("monitor-added", async (_, gdkmonitor) => {
            const hybridMonitor = MonitorKey.mapGdkMonitor(gdkmonitor);
            MonitorManager.logger.debug(`monitor-added event for ${hybridMonitor.key} received`);

            Resultify.promise(this.applyOnAllMononitor(widgetF, Promise.resolve([hybridMonitor]))).then(
                () => MonitorManager.logger.info(`Add monitor event handled successfully for ${hybridMonitor.key}`),
                err => MonitorManager.logger.error(`Failed bootstrapping new monitor ${hybridMonitor.key}`, err)
            );
        });

        App.connect("monitor-removed", async (_, gdkmonitor) => {
            const hybridMonitor = MonitorKey.mapGdkMonitor(gdkmonitor);
            MonitorManager.logger.debug(`monitor-removed event for ${hybridMonitor.key} received`);

            Resultify.promise(
                this.destroyWidgets(hybridMonitor).then(
                    () => MonitorManager.logger.info(`Destroyed all widgets from monitor ${hybridMonitor.key}`),
                    err => MonitorManager.logger.error(`Failed tearing down monitor ${hybridMonitor.key}`, err)
                )
            );
        });
    }
}
