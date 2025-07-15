import { bind, GLib, Variable } from "astal";
import Hyprland from "gi://AstalHyprland";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { HybridMonitor } from "src/core/monitor";
import { Astal, Gdk, Gtk } from "astal/gtk3";
import { toSubscript } from "src/core/symbols";
import { isScrollDown, isScrollUp } from "./common/events";
import { SymbolConfig } from "src/core/config/symbolconfig";
import { DefaultKVConfigValues } from "src/core/config/kvconfig";
import { ConfigManager } from "src/core/config/configmanager";
import { Logger } from "src/core/lang/log";

const hyprlandService = Hyprland.get_default();

const logger = Logger.get(this);

export interface TaskBarProps {
    readonly hybridMonitor: HybridMonitor;
}

function getClassName(client: AstalHyprland.Client, focusedClient: AstalHyprland.Client): string {
    const result = ["bar-item", "task"];
    if (client === focusedClient) {
        result.push("task-focused");
    } else {
        result.push("task-unfocused");
    }
    return result.join(" ");
}

function setSymbol(label: Astal.Label, client: AstalHyprland.Client) {
    const symbolConfig = ConfigManager.instace()
        .symbols.get()
        .apply(symbols => symbols.getSymbol(client))
        .getOr(SymbolConfig.DEFAULT_RESULT);

    label.label = symbolConfig.symbol;
    if (symbolConfig.color.isSome()) {
        label.get_style_context().add_class("symbol-override");

        let cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_data(`
            label.symbol-override {
                color: ${symbolConfig.color.get()};
            }
        `);

        label.get_style_context().add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
    } else {
        label.get_style_context().remove_class("symbol-override");
    }
}

function setTitle(label: Astal.Label, client: AstalHyprland.Client) {
    let title = ConfigManager.instace()
        .replacer.get()
        .apply(replacer => replacer.replace(client))
        .getOr(client.title);

    const maxLenght = ConfigManager.instace()
        .config.get()
        .apply(config => config.taskbarMaxLength)
        .getOr(DefaultKVConfigValues.TASKBAR_MAX_LENGTH);

    if (title.length <= maxLenght) {
        label.label = title;
    } else {
        label.label = title.substring(0, maxLenght - 3) + "...";
    }
}

// Todo: Refactor this to a global context
const focusedCoordinates = new Variable<(number | null)[]>([null, null]);
const focusedClinetMonitor = new Variable<Hyprland.Monitor | null>(null);

// Todo: abstract class
// Todo: workspace move is not being adequately tracked
export const TaskBar = (props: TaskBarProps): JSX.Element => {
    // Todo: Abstract flip flag
    const replacerReloaded = new Variable(0);
    const symbolsReloaded = new Variable(0);

    ConfigManager.instace().symbols.onLoadNofity(async () => {
        replacerReloaded.set(replacerReloaded.get() ^ 1);
    });

    ConfigManager.instace().replacer.onLoadNofity(async () => {
        symbolsReloaded.set(symbolsReloaded.get() ^ 1);
    });

    const v = Variable.derive(
        [
            bind(hyprlandService, "clients"),
            bind(hyprlandService, "focusedClient"),
            bind(hyprlandService, "monitors"),
            bind(hyprlandService, "workspaces"),
            bind(hyprlandService, "focusedWorkspace"),
            bind(hyprlandService, "focusedMonitor"),
            bind(focusedClinetMonitor),
            bind(focusedCoordinates),
            bind(replacerReloaded),
            bind(symbolsReloaded),
        ],
        (clients, focusedClient, ...argv: any[]) => {
            return clients
                .filter(
                    client =>
                        client.monitor === props.hybridMonitor.hyprlandMonitor.get() &&
                        client.workspace.id > 0 &&
                        client.workspace.id > -1
                    // && activeWorkspaces(monitors).includes(client.workspace)
                )
                .sort((a, b) => {
                    if (a.workspace.id > b.workspace.id) {
                        return 1;
                    } else if (a.workspace.id < b.workspace.id) {
                        return -1;
                    } else {
                        const xDelta = a.get_x() - b.get_x();
                        if (xDelta === 0) {
                            return a.get_y() - b.get_y();
                        } else {
                            return xDelta;
                        }
                    }
                })
                .map(client => (
                    <button
                        cursor={"pointer"}
                        className={getClassName(client, focusedClient)}
                        onClick={(self, event) => {
                            if (event.button === Astal.MouseButton.PRIMARY) {
                                client.focus();
                            } else if (event.button === Astal.MouseButton.MIDDLE) {
                                client.kill();
                            }
                        }}
                    >
                        <box tooltipText={`${client.title}`}>
                            <label className="task-ws-n" label={toSubscript(client.workspace.id)} />
                            <label
                                className={"task-symbol"}
                                setup={self => {
                                    setSymbol(self, client);
                                    self.hook(client, "notify::title", () => {
                                        setSymbol(self, client);
                                    });
                                }}
                            />
                            <label label={": "} />
                            <label
                                className={"task-title" + (client === focusedClient ? " task-title-focused" : "")}
                                setup={self => {
                                    setTitle(self, client);
                                    self.hook(client, "notify::title", () => {
                                        setTitle(self, client);
                                    });
                                }}
                            />
                        </box>
                    </button>
                ));
        }
    );

    return (
        <scrollable
            hscrollbar_policy={Gtk.PolicyType.EXTERNAL}
            vscrollbar_policy={Gtk.PolicyType.NEVER}
            setup={self => {
                GLib.idle_add(
                    GLib.PRIORITY_LOW,
                    ((
                        focusedCoordinates: Variable<(number | null)[]>,
                        focusedClinetMonitor: Variable<Hyprland.Monitor | null>
                    ) => {
                        const client = hyprlandService.focusedClient;
                        const oldMonitor = focusedClinetMonitor.get();
                        const [oldX, oldY] = focusedCoordinates.get();

                        if (hyprlandService.focusedClient !== null) {
                            const newMonitor = hyprlandService.focusedClient.monitor;
                            if (oldMonitor !== newMonitor) {
                                focusedClinetMonitor.set(newMonitor);
                            }

                            const [newX, newY] = [client.get_x(), client.get_y()];
                            if (oldX !== newX || oldY !== newY) {
                                focusedCoordinates.set([newX, newY]);
                            }
                        } else {
                            if (oldMonitor !== null) {
                                focusedClinetMonitor.set(null);
                            }

                            if (oldX !== null || oldY !== null) {
                                focusedCoordinates.set([null, null]);
                            }
                        }
                        return GLib.SOURCE_CONTINUE;
                    }).bind(null, focusedCoordinates, focusedClinetMonitor)
                );

                self.connect("scroll-event", (_, event: Gdk.Event) => {
                    const [, , yScroll] = event.get_scroll_deltas();

                    let modifier = undefined;
                    if (isScrollUp(event)) {
                        modifier = yScroll < 0 ? 1 : -1;
                    } else if (isScrollDown(event)) {
                        modifier = 1;
                    } else {
                        return false;
                    }

                    const adj = self.get_hadjustment();
                    adj.set_value((adj.get_value() + 30 * yScroll) * modifier);
                    self.set_hadjustment(adj);
                    return true;
                });
            }}
        >
            <box className="taskbox" orientation={Gtk.Orientation.HORIZONTAL}>
                {bind(v)}
            </box>
        </scrollable>
    );
};
