import { bind, Variable } from "astal";
import Hyprland from "gi://AstalHyprland";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { HybridMonitor } from "src/core/monitor";
import { toSubscript } from "./workspace";
import { Astal, Gdk, Gtk } from "astal/gtk3";
import { escapeRegExp } from "src/core/regex";

const hyprlandService = Hyprland.get_default();

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
    steam: {
        symbol: "",
    },
    mpv: {
        symbol: "",
    },
};

const DefaultIcon = (): ClassNameIcon => {
    return {
        symbol: "",
    };
};

const TitleTrimRegex: Record<string, (initialClass: string) => RegExp> = {
    "code-oss": _ => /\ - Code \- OSS/,
};

const DefaultTrimRegex = (initialClass: string): RegExp => {
    return new RegExp(`(?:\\s*[-—]\\s*)?${escapeRegExp(initialClass)}`, "i");
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

const MAX_LABEL = 25;

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

export const TaskBar = (props: TaskBarProps): JSX.Element => {
    const v = Variable.derive(
        [
            bind(hyprlandService, "clients"),
            bind(hyprlandService, "focusedClient"),
            bind(hyprlandService, "monitors"),
            bind(hyprlandService, "workspaces"),
            bind(hyprlandService, "focusedWorkspace"),
        ],
        (clients, focusedClient, monitors, workspaces, focusedWorkspace) => {
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
                        onButtonPressEvent={(_, event) => {
                            const [isButton, button] = event.get_button();
                            if (isButton && button === Gdk.BUTTON_PRIMARY) {
                                client.focus();
                            } else if (isButton && button === Gdk.BUTTON_MIDDLE) {
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
            <box orientation={Gtk.Orientation.HORIZONTAL}>{bind(v)}</box>
        </scrollable>
    );
};

export const isScrollUp = (event: Gdk.Event): boolean => {
    const [directionSuccess, direction] = event.get_scroll_direction();
    const [deltaSuccess, , yScroll] = event.get_scroll_deltas();

    if (directionSuccess && direction === Gdk.ScrollDirection.UP) {
        return true;
    }

    if (deltaSuccess && yScroll < 0) {
        return true;
    }

    return false;
};

export const isScrollDown = (event: Gdk.Event): boolean => {
    const [directionSuccess, direction] = event.get_scroll_direction();
    const [deltaSuccess, , yScroll] = event.get_scroll_deltas();

    if (directionSuccess && direction === Gdk.ScrollDirection.DOWN) {
        return true;
    }

    if (deltaSuccess && yScroll > 0) {
        return true;
    }

    return false;
};
