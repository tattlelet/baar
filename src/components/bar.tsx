import { App, Astal, Gtk } from "astal/gtk3";
import { bind } from "astal";
import { HybridMonitor } from "src/core/monitor";
import { DateTimeCalendar } from "./calendar";
import { RAM_POLLER, RamPoller } from "./stats/ram";
import { GPU_POLLER, GpuPoller } from "./stats/gpu";
import { CPU_POLLER } from "./stats/cpu";
import { fmt } from "external/HyprPanel/src/lib/poller/Poller";
import { SysTray } from "./tray/tray";
import { PollerLabel } from "./stats/poller";

export default async function Bar(hybridMonitor: HybridMonitor): Promise<Nullable<JSX.Element>> {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

    return (
        <window
            inhibit={false}
            className="Bar"
            application={App}
            gdkmonitor={hybridMonitor.gdkMonitor}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            anchor={TOP | LEFT | RIGHT}
        >
            <centerbox className="bar-box">
                <box>
                    <box className="bar-left" />
                </box>
                <box />
                <box className="bar-section" halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
                    <PollerLabel symbol="" className="cpu-poller" poller={CPU_POLLER} />
                    <PollerLabel symbol="󰢮" className="gpu-poller" poller={GPU_POLLER} />
                    <PollerLabel symbol="" className="ram-poller" poller={RAM_POLLER} />
                    <SysTray />
                    <DateTimeCalendar />
                    <box className="bar-right" />
                </box>
            </centerbox>
        </window>
    );
}
