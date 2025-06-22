import { astalify, ConstructProps, Astal, App, Gdk, Widget, Gtk } from "astal/gtk3";
import { Gtk as GtkL } from "gi://Gtk?version=3.0";
import { bind, GLib, GObject, Variable } from "astal";
import { Button, EventBox, Revealer, Window } from "astal/gtk3/widget";
import { HybridMonitor, MonitorManager } from "src/core/monitor";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { Timer } from "src/core/timer";

/**
 * Calendar component that extends Gtk.Calendar.
 *
 * @class Calendar
 * @extends {astalify(Gtk.Calendar)}
 */
class CalendarWidget extends astalify(Gtk.Calendar) {
    static {
        GObject.registerClass(this);
    }

    /**
     * Creates an instance of Calendar.
     * @param props - The properties for the Calendar component.
     * @memberof Calendar
     */
    constructor(props: ConstructProps<CalendarWidget, Gtk.Calendar.ConstructorProps>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        super(props as any);
    }
}

// Todo: abstract revealer
// Todo: abstract basic clickable dropdown
// Todo: configure calendar
export default async function Calendar(): Promise<JSX.Element> {
    return (
        <window
            name="calendar"
            className={"calendar"}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
            visible={false}
            canFocus={false}
            keymode={Astal.Keymode.ON_DEMAND}
            application={App}
            layer={Astal.Layer.TOP}
            exclusivity={Astal.Exclusivity.IGNORE}
            halign={Gtk.Align.FILL}
            valign={Gtk.Align.FILL}
        >
            <revealer
                transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                transition_duration={100}
                setup={(self: Revealer) => {
                    App.connect("window-toggled", app => {
                        self.revealChild = App.get_window("calendar")!.is_visible() ?? false;
                    });
                }}
            >
                <eventbox
                    vexpand
                    hexpand
                    onButtonPressEvent={(window, event) => {
                        if (event.get_button()[1] === Gdk.BUTTON_PRIMARY) {
                            ``;
                            App.toggle_window("calendar");
                        }
                    }}
                    onKeyPressEvent={(window, event) => {
                        const key = event.get_keyval()[1];
                        print(key);
                        if (key === Gdk.KEY_Escape) {
                            App.get_window("calendar")!.set_visible(false);
                        }
                    }}
                >
                    <box className={"calendar-container-box"} canFocus={false}>
                        <CalendarWidget
                            canFocus={false}
                            className={"calendar-menu-widget"}
                            halign={Gtk.Align.FILL}
                            valign={Gtk.Align.FILL}
                            showDetails={true}
                            expand
                            showDayNames
                            showHeading
                        />
                    </box>
                </eventbox>
            </revealer>
        </window>
    );
}

export const systemTime = Variable(GLib.DateTime.new_now_local()).poll(
    1000,
    (): GLib.DateTime => GLib.DateTime.new_now_local()
);

export const DateTimeCalendar = (): JSX.Element => {
    return (
        <eventbox
            onButtonPressEvent={async (eventbox, event) => {
                const timer = new Timer();
                if (event.get_button()[1] === Gdk.BUTTON_PRIMARY) {
                    const window = App.get_window("calendar")!;
                    // Perform relative calculation
                    // window.set_margin_top(80);
                    // window.set_margin_bottom(1440);
                    // window.set_margin_left(2260);
                    // window.set_margin_right(20);
                    App.toggle_window("calendar");
                }
            }}
        >
            <label
                className={"bar-item bar-timer"}
                label={bind(systemTime).as(time => {
                    return time?.format(" 󰸗 %Y-%m-%d  %I:%M:%S %p ") ?? "";
                })}
            />
        </eventbox>
    );
};

// Todo: solve issue with x,y in event not including screen
// Todo: solve issue with subwindow position
// Todo: solve issue getting the target widget
