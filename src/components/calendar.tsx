import { astalify, ConstructProps, Astal, App, Gdk, Gtk } from "astal/gtk3";
import { bind, GLib, GObject, Variable } from "astal";
import { Revealer } from "astal/gtk3/widget";

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
            className="calendar"
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
            visible={false}
            keymode={Astal.Keymode.ON_DEMAND}
            application={App}
            layer={Astal.Layer.TOP}
            exclusivity={Astal.Exclusivity.NORMAL}
            onKeyPressEvent={(_, event) => {
                const [isKey, key] = event.get_keyval();
                if (isKey && key === Gdk.KEY_Escape) {
                    App.get_window("calendar")?.set_visible(false);
                }
            }}
            onButtonPressEvent={async (window, event) => {
                const [isButton, button] = event.get_button();
                if (isButton && button === Gdk.BUTTON_PRIMARY) {
                    window.set_focus;
                }
            }}
        >
            <revealer
                transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                transition_duration={100}
                setup={(self: Revealer) => {
                    App.connect("window-toggled", app => {
                        self.revealChild = app.get_window("calendar")!.is_visible() ?? false;
                    });
                }}
            >
                <box className={"calendar-container-box"} canFocus={false}>
                    <CalendarWidget
                        canFocus={false}
                        className="calendar-menu-widget"
                        halign={Gtk.Align.FILL}
                        valign={Gtk.Align.FILL}
                        showDetails={true}
                        expand
                        showDayNames
                        showHeading
                    />
                </box>
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
            onButtonPressEvent={async (_, event) => {
                const [isButton, button] = event.get_button();
                if (isButton && button === Gdk.BUTTON_PRIMARY) {
                    const window = App.get_window("calendar");
                    if (window !== null) {
                        window.set_visible(!window.visible);
                    }
                }
            }}
        >
            <label
                className={"bar-item bar-timer"}
                label={bind(systemTime).as(time => {
                    return time?.format("󰸗 %Y-%m-%d  %I:%M:%S %p") ?? "";
                })}
                tooltipText="Calendar"
            />
        </eventbox>
    );
};
