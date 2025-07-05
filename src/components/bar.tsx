import { App, Astal, Gdk, Gtk } from "astal/gtk3";
import { HybridMonitor } from "src/core/monitor";
import { DateTimeCalendar } from "./calendar";
import { SysTray } from "./tray";
import { Workspaces } from "./workspace";
import { KbLayout } from "./kblayout";
import { TaskBar } from "./taskbar";
import { GLib, Variable } from "astal";
import { Box, CenterBox } from "astal/gtk3/widget";
import { PowerMenuButton } from "./powermenu";
import { PollerLabel, CPU_POLLER, GPU_POLLER, RAM_POLLER } from "./pollerlabel";

// Todo make this less shit
function getTaskBar(window: Gtk.Window): Gtk.ScrolledWindow {
    const centerBox = window.get_children()[0] as CenterBox;
    const firstBox = centerBox.get_children()[0];
    return (firstBox as Gtk.Box).get_children()[3] as Gtk.ScrolledWindow;
}

export interface Dimension {
    readonly width: number;
    readonly height: number;
}

function getTaskbarSize(window: Gtk.Window): Dimension {
    const centerBox = window.get_children()[0] as CenterBox;
    const [left, mid, right] = centerBox.get_children() as Box[];
    const taskbar = getTaskBar(window);

    const maxSize = window.get_allocated_width();
    const leftW = left.get_allocated_width() - taskbar.get_allocated_width();
    const midW = mid.get_allocated_width();
    const rightW = right.get_allocated_width();

    const newW = maxSize - leftW - midW - rightW;

    return {
        width: newW,
        height: window.get_allocated_height(),
    };
}

export default async function Bar(hybridMonitor: HybridMonitor): Promise<Nullable<JSX.Element>> {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;
    const activeX = new Variable(0);
    const enableResize = new Variable(false);

    return (
        <window
            inhibit={false}
            className="Bar"
            application={App}
            gdkmonitor={hybridMonitor.gdkMonitor}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            layer={Astal.Layer.BOTTOM}
            anchor={TOP | LEFT | RIGHT}
            setup={self => {
                const taskbar = getTaskBar(self);

                GLib.idle_add(
                    GLib.PRIORITY_LOW,
                    ((enableResize: Variable<boolean>, activeX: Variable<number>, taskbar: Gtk.ScrolledWindow) => {
                        if (!enableResize.get() || activeX.get() === taskbar.get_allocated_width()) {
                            return GLib.SOURCE_CONTINUE;
                        }

                        taskbar.set_size_request(activeX.get(), taskbar.get_allocated_height());
                        taskbar.queue_resize();

                        return GLib.SOURCE_CONTINUE;
                    }).bind(null, enableResize, activeX, taskbar)
                );

                self.connect_after("size-allocate", (_, event) => {
                    activeX.set(getTaskbarSize(self).width);
                });

                // Todo: refactor based on tray size and other triggers to do the first load to avoid sliding
                GLib.idle_add(
                    GLib.PRIORITY_DEFAULT_IDLE,
                    ((enableResize: Variable<boolean>, activeX: Variable<number>) => {
                        if (CPU_POLLER.get() !== "" && GPU_POLLER.get() !== "" && RAM_POLLER.get() !== "") {
                            print(activeX.get());
                            enableResize.set(true);
                            return GLib.SOURCE_REMOVE;
                        }
                        return GLib.SOURCE_CONTINUE;
                    }).bind(null, enableResize, activeX)
                );
            }}
        >
            <centerbox className="bar-box">
                <box className="bar-section" halign={Gtk.Align.START} valign={Gtk.Align.CENTER}>
                    <box className="bar-left" />
                    <PowerMenuButton />
                    <Workspaces />
                    <TaskBar hybridMonitor={hybridMonitor} />
                </box>
                <box className="bar-section" />
                <box className="bar-section" halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
                    <box className="bar-dashboard">
                        <PollerLabel tooltip="CPU Info" symbol="" className="cpu-poller" poller={CPU_POLLER} />
                        <PollerLabel tooltip="GPU Info" symbol="󰢮" className="gpu-poller" poller={GPU_POLLER} />
                        <PollerLabel tooltip="RAM Info" symbol="" className="ram-poller" poller={RAM_POLLER} />
                    </box>
                    <SysTray />
                    <KbLayout />
                    <DateTimeCalendar />
                    <box className="bar-right" />
                </box>
            </centerbox>
        </window>
    );
}
