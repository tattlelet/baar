import { App, Astal, Gtk, Gdk } from "astal/gtk3";
import { Variable, bind } from "astal";
import { HybridMonitor } from "src/util/monitor";

const time = Variable("").poll(1000, "date");

const idleInhibit = Variable(false);

export default async function Bar(hybridMonitor: HybridMonitor): Promise<Nullable<JSX.Element>> {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

    return (
        <window
            inhibit={bind(idleInhibit)}
            className="Bar"
            application={App}
            gdkmonitor={hybridMonitor.gdkMonitor}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            anchor={TOP | LEFT | RIGHT}
        >
            <centerbox>
                <button onClicked="echo hello" halign={Gtk.Align.START}>
                    Welcome to AGS!
                </button>
                <button onClicked={() => print("hello")} halign={Gtk.Align.END}>
                    <label label={time()} />
                </button>
            </centerbox>
        </window>
    );
}
