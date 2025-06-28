import { execAsync } from "astal";
import { Menu, MenuItem } from "./common/astalified";
import { Gtk, Gdk } from "astal/gtk3";


const logger = Logger.get();


// Todo refactor basic onpress
export const PowerMenuButton = (): JSX.Element => {
    const menu = (
        <Menu halign={Gtk.Align.START} className="power-menu-box">
            <MenuItem
                className="power-menu-item"
                label="󰍃 Logout"
                onButtonPressEvent={(self, event) => {
                    const [isButton, button] = event.get_button();
                    if (isButton && button === Gdk.BUTTON_PRIMARY) {
                        wrapIO(logger, execAsync("hyprctl dispatch exit"), "Failed logout");
                    }
                }}
            />
            <MenuItem
                className="power-menu-item"
                label=" Lock"
                onButtonPressEvent={(self, event) => {
                    const [isButton, button] = event.get_button();
                    if (isButton && button === Gdk.BUTTON_PRIMARY) {
                        wrapIO(logger, execAsync("hyprlock"), "Failed lock");
                    }
                }}
            />
            <MenuItem
                className="power-menu-item"
                label="󰜉 Reboot"
                onButtonPressEvent={(self, event) => {
                    const [isButton, button] = event.get_button();
                    if (isButton && button === Gdk.BUTTON_PRIMARY) {
                        wrapIO(logger, execAsync("systemctl reboot"), "Failed reboot");
                    }
                }}
            />
            <MenuItem
                className="power-menu-item"
                label="󰐥 Power off"
                onButtonPressEvent={(self, event) => {
                    const [isButton, button] = event.get_button();
                    if (isButton && button === Gdk.BUTTON_PRIMARY) {
                        wrapIO(logger, execAsync("systemctl poweroff"), "Failed poweroff");
                    }
                }}
            />
        </Menu>
    ) as Gtk.Menu;

    return (
        <eventbox
            cursor={"pointer"}
            onButtonPressEvent={(self, event) => {
                const [isButton, button] = event.get_button();
                if (isButton && button === Gdk.BUTTON_PRIMARY) {
                    if (window !== null) {
                        (menu as Gtk.Menu).popup_at_widget(self, Gdk.Gravity.NORTH, Gdk.Gravity.SOUTH, null);
                    }
                }
            }}
        >
            <box className="bar-item power-menu">
                <label className="power-button" label="󰐥" tooltipText="Power menu" />
            </box>
        </eventbox>
    );
};
