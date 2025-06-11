import { App, Astal, Gtk, Gdk } from 'astal/gtk3';
import { Variable, bind } from 'astal';

const time = Variable('').poll(1000, 'date');

const idleInhibit = Variable(false);

export type JSXElement = JSX.Element | null;

export default function Bar(gdkmonitor: Gdk.Monitor): JSXElement {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

    return (
        <window
            inhibit={bind(idleInhibit)}
            className="Bar"
            gdkmonitor={gdkmonitor}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            anchor={TOP | LEFT | RIGHT}
            application={App}
        >
            <centerbox>
                <button onClicked="echo hello" halign={Gtk.Align.CENTER}>
                    Welcome to AGS!
                </button>
                <box />
                <button onClicked={() => print('hello')} halign={Gtk.Align.CENTER}>
                    <label label={time()} />
                </button>
            </centerbox>
        </window>
    );
}
