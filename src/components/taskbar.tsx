import { bind, GLib, Variable } from "astal";
import Hyprland from "gi://AstalHyprland";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { HybridMonitor } from "src/core/monitor";
import { Astal, Gdk, Gtk } from "astal/gtk3";
import { escapeRegExp } from "src/core/regex";
import { toSubscript } from "src/core/symbols";
import { isScrollDown, isScrollUp } from "./common/events";

const hyprlandService = Hyprland.get_default();

// Todo: refactor icons to config
export interface ClassNameIcon {
    readonly symbol: string;
}

const IconMap: Record<string, ClassNameIcon> = {
    kitty: {
        symbol: "",
    },
    "code-oss": {
        symbol: "󰨞",
    },
    librewolf: {
        symbol: "",
    },
    nemo: {
        symbol: "󰝰",
    },
    discord: {
        symbol: "",
    },
    "com.discordapp.Discord": {
        symbol: "",
    },
    steam: {
        symbol: "",
    },
    mpv: {
        symbol: "",
    },
    "org.kde.gwenview": {
        symbol: "",
    },
    "Mullvad VPN": {
        symbol: "",
    },
};

const DefaultIcon = (): ClassNameIcon => {
    return {
        symbol: "",
    };
};

// Todo: refactor trimmers to config
const TitleTrimRegex: Record<string, (initialClass: string) => RegExp> = {
    "code-oss": _ => / \- Code \- OSS/,
    "com.discordapp.Discord": _ => / \- Discord/,
};

const DefaultTrimRegex = (initialClass: string): RegExp => {
    return new RegExp(`(?:\\s*[-—]\\s*)${escapeRegExp(initialClass)}`, "i");
};

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

const MAX_LABEL = 20;

function setTitle(label: Astal.Label, client: AstalHyprland.Client) {
    const foundIcon = IconMap[client.class];
    let title = client.title;

    if (foundIcon !== null) {
        const regexF = TitleTrimRegex[client.class] || DefaultTrimRegex;
        title = title.replace(regexF(client.initialClass), "");
    }

    title = `${(foundIcon || DefaultIcon()).symbol}: ${title}`;
    title = title.replaceAll(" ", " ");

    if (title.length <= MAX_LABEL) {
        label.label = title;
    } else {
        label.label = title.substring(0, MAX_LABEL - 3) + "...";
    }
}

const focusedCoordinates = new Variable<(number | null)[]>([null, null]);
const focusedClinetMonitor = new Variable<Hyprland.Monitor | null>(null);

// Todo: abstract class
export const TaskBar = (props: TaskBarProps): JSX.Element => {
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
        ],
        (clients, focusedClient, ...argv: any[]) => {
            return clients
                .filter(
                    client =>
                        client.monitor === props.hybridMonitor.hyprlandMonitor &&
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
                            } else if (event.button === Astal.MouseButton.SECONDARY) {
                                client.kill();
                            }
                        }}
                    >
                        <box tooltipText={`${client.title}`}>
                            <label className="task-ws-n" label={toSubscript(client.workspace.id)} />
                            <label
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
