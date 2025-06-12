import { App, Astal, Gtk, Gdk } from 'astal/gtk3';
import { Variable, bind } from 'astal';
import { MonitorIndex } from 'src/util/monitor';

const time = Variable('').poll(1000, 'date');

const idleInhibit = Variable(false);

export default async function Bar(monitorIndex: MonitorIndex): Promise<Nullable<JSX.Element>> {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

    return (
        <window
            inhibit={bind(idleInhibit)}
            name={`bar-${monitorIndex.hyprlandMonitor}`}
            namespace={`bar-${monitorIndex.hyprlandMonitor}`}
            className="Bar"
            application={App}
            monitor={monitorIndex.gdkMonitor}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            anchor={TOP | LEFT | RIGHT}
        >
            <centerbox>
                <button onClicked="echo hello" halign={Gtk.Align.START}>
                    Welcome to AGS!
                </button>
                <button onClicked={() => print('hello')} halign={Gtk.Align.END}>
                    <label label={time()} />
                </button>
            </centerbox>
        </window>
    );
}
