import { App, Astal, Gtk } from "astal/gtk3";
import { HybridMonitor } from "src/core/monitor";
import { DateTimeCalendar } from "./calendar";
import { RAM_POLLER } from "./stats/ram";
import { GPU_POLLER } from "./stats/gpu";
import { CPU_POLLER } from "./stats/cpu";
import { SysTray } from "./tray";
import { PollerLabel } from "./stats/poller";
import { Workspaces } from "./workspace";
import { KbLayout } from "./kblayout";

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
                <box className="bar-section" halign={Gtk.Align.START} valign={Gtk.Align.CENTER}>
                    <box className="bar-left" />
                    <Workspaces />
                </box>
                <box />
                <box className="bar-section" halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
                    <PollerLabel tooltip="CPU Info" symbol="" className="cpu-poller" poller={CPU_POLLER} />
                    <PollerLabel tooltip="GPU Info" symbol="󰢮" className="gpu-poller" poller={GPU_POLLER} />
                    <PollerLabel tooltip="RAM Info" symbol="" className="ram-poller" poller={RAM_POLLER} />
                    <SysTray />
                    <KbLayout />
                    <DateTimeCalendar />
                    <box className="bar-right" />
                </box>
            </centerbox>
        </window>
    );
}
