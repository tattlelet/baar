import { Gdk } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland";

const hyprlandService = AstalHyprland.get_default();


/**
 * Creates widgets for all available monitors with proper GDK to Hyprland monitor mapping.
 *
 * @param widget - Function that creates a widget for a given monitor index
 * @returns Array of created widgets for all available monitors
 */
export async function forMonitors(
    widget: (monitorIndex: MonitorIndex) => Promise<Nullable<JSX.Element>>
): Promise<Nullable<JSX.Element>[]> {
    const display = Gdk.Display.get_default();
    if (display === null) {
        console.error('[forMonitors] No display available');
        return [];
    }

    const mappings = [];
    for (let gdkMonitorIndex = 0; gdkMonitorIndex < display.get_n_monitors(); gdkMonitorIndex++) {
        const monitor = display.get_monitor(gdkMonitorIndex);
        if (monitor === null) {
            console.warn(`[forMonitors] Skipping invalid monitor at index ${gdkMonitorIndex}`);
            continue;
        }

        const mapping = MonitorUtil.mapGdkMonitor({ gdkMonitorIndex: gdkMonitorIndex, gdkMonitor: monitor });
        if (mapping !== null) {
            mappings.push(mapping);
        }
    }

    const monitorPromises = mappings.map(async (monitorIndex) => {
        try {
            return await widget(monitorIndex);
        } catch (error) {
            console.error(`[forMonitors] Failed to create widget for monitor ${monitorIndex.gdkMonitor}:`, error);
            return null;
        }
    });
    const widgets = await Promise.all(monitorPromises);

    return widgets.filter(widget => widget !== null);
}


export class MonitorUtil {
    public static keyForGdkMonitor(monitor: Gdk.Monitor): string {
        const {width, height} = monitor.get_geometry();
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

    public static mapGdkMonitor(gdkMonitorArg: GdkMonitorArg): Nullable<MonitorIndex> {
        const keyForGdkMonitor = this.keyForGdkMonitor(gdkMonitorArg.gdkMonitor);
        const hyprlandMonitors = hyprlandService.get_monitors();
        
        let result: Undefinable<number> = hyprlandMonitors.findIndex((monitor) => this.keyForHyprlandMonitor(monitor) === keyForGdkMonitor);

        if (result === -1) {
            console.error(`[MonitorService] Could not map GDK Monitor ${keyForGdkMonitor} to any Hyprland monitors.`);
            result = undefined;
        }

        return {
            gdkMonitor: gdkMonitorArg.gdkMonitorIndex,
            hyprlandMonitor: result
        };
    }
}

export type GdkMonitorArg = {
    readonly gdkMonitorIndex: number;
    readonly gdkMonitor: Gdk.Monitor;
}

export type MonitorIndex = {
    readonly gdkMonitor: number;
    readonly hyprlandMonitor?: number;
}