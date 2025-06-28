import { astalify, ConstructProps, Astal, App, Gdk, Gtk } from "astal/gtk3";
import { bind, GLib, GObject, Variable } from "astal";
import { Revealer } from "astal/gtk3/widget";
import { Calendar } from "./common/astalified";
import { MouseEvents } from "./common/events";

// Todo: abstract revealer
// Todo: abstract basic clickable dropdown
// Todo: make it behave like a gtk menu
// Todo: configure calendar
// Todo: there's no button cursor for month and year buttons
export default async function CalendarWindow(): Promise<JSX.Element> {
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
            onButtonPressEvent={MouseEvents.onPrimaryHandler(target => target.set_focus())}
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
                <box className={"calendar-container-box"} vertical valign={Gtk.Align.FILL} canFocus={false}>
                    <box>
                        <Calendar
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
        <button
            cursor={"pointer"}
            className={"bar-item bar-timer"}
            label={bind(systemTime).as(time => time?.format("󰸗 %-d %b %y  %H:%M:%S") ?? "")}
            tooltipText="Calendar"
            onButtonPressEvent={MouseEvents.onPrimaryHandler(() => {
                const window = App.get_window("calendar");
                if (window !== null) {
                    window.set_visible(!window.visible);
                }
            })}
        />
    );
};
