import { App, Astal, Gtk } from "astal/gtk3";
import { bind } from "astal";
import { HybridMonitor } from "src/core/monitor";
import { DateTimeCalendar } from "./Calendar";
import { RamPoller } from "./stats/ram";
import { GpuPoller } from "./stats/gpu";
import { CpuPoller } from "./stats/cpu";
import { fmt } from "src/core/formatter";

const cpuPoller = bind(new CpuPoller().pollerVariable(1000)).as(
    cpuStats => ` ┃${fmt(cpuStats.usage)}% ${fmt(cpuStats.temp)}󰔄 `
);
const ramPoller = bind(new RamPoller().pollerVariable(1000)).as(ramStats => ` ┃${fmt(ramStats.usage)}% `);
const gpuPoller = bind(new GpuPoller().pollerVariable(1000)).as(
    gpuStats => ` 󰢮┃${fmt(gpuStats.cpuUsage)}% ${fmt(gpuStats.ramUsage)}%  ${gpuStats.temp}󰔄 `
);

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
                    <label className="bar-item" label={cpuPoller} />
                    <label className="bar-item" label={gpuPoller} />
                    <label className="bar-item" label={ramPoller} />
                    <label className="bar-item">One day I will be a tray</label>
                    <DateTimeCalendar />
                    <box className="bar-right" />
                </box>
            </centerbox>
        </window>
    );
}
