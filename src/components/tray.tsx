import { Gio, Variable, bind } from "astal";
import { Gtk, Gdk, Astal } from "astal/gtk3";
import AstalTray from "gi://AstalTray?version=0.1";

const systemtray = AstalTray.get_default();

const createMenu = (menuModel: Gio.MenuModel, actionGroup: Gio.ActionGroup | null): Gtk.Menu => {
    const menu = Gtk.Menu.new_from_model(menuModel);
    menu.insert_action_group("dbusmenu", actionGroup);

    return menu;
};

const MenuDefaultIcon = ({ item }: MenuEntryProps): JSX.Element => {
    return <icon className={"systray-icon"} gicon={bind(item, "gicon")} tooltipMarkup={bind(item, "tooltipMarkup")} />;
};

const MenuEntry = ({ item, child }: MenuEntryProps): JSX.Element => {
    let menu: Gtk.Menu;

    const entryBinding = Variable.derive(
        [bind(item, "menuModel"), bind(item, "actionGroup")],
        (menuModel, actionGroup) => {
            if (menuModel === null) {
                return console.error(`Menu Model not found for ${item.id}`);
            }
            if (actionGroup === null) {
                return console.error(`Action Group not found for ${item.id}`);
            }

            menu = createMenu(menuModel, actionGroup);
        }
    );

    return (
        <button
            className="tray-item"
            cursor={"pointer"}
            onClick={(self, event) => {
                if (event.button === Astal.MouseButton.PRIMARY) {
                    item.activate(0, 0);
                }

                if (event.button === Astal.MouseButton.SECONDARY) {
                    menu?.popup_at_widget(self, Gdk.Gravity.NORTH, Gdk.Gravity.SOUTH, null);
                }
            }}
            onDestroy={() => {
                menu?.destroy();
                entryBinding.drop();
            }}
        >
            {child}
        </button>
    );
};

export const SysTray = (): Gtk.Widget => {
    const componentChildren = Variable.derive([bind(systemtray, "items")], items => {
        return items.map(item => {
            return (
                <MenuEntry item={item}>
                    <MenuDefaultIcon item={item} />
                </MenuEntry>
            );
        });
    });

    const component = (
        <box
            className={"bar-item bar-tray"}
            onDestroy={() => {
                componentChildren.drop();
            }}
        >
            {componentChildren()}
        </box>
    );

    return component;
};

interface MenuEntryProps {
    item: AstalTray.TrayItem;
    child?: JSX.Element;
}

export default { SysTray };
