import { Variable } from "astal";
import { bind } from "astal/binding";
import Hyprland from "gi://AstalHyprland";

const hypr = Hyprland.get_default();

export function activeWorkspaces(monitors: Hyprland.Monitor[]): Hyprland.Workspace[] {
    return monitors.map(monitor => monitor.activeWorkspace).filter(monitor => monitor !== null);
}

function toSubscript(num: number): string {
    const subscriptMap: { [key: string]: string } = {
        "0": "₀",
        "1": "₁",
        "2": "₂",
        "3": "₃",
        "4": "₄",
        "5": "₅",
        "6": "₆",
        "7": "₇",
        "8": "₈",
        "9": "₉",
        "-": "₋", // handle negative sign if needed
    };

    return num
        .toString()
        .split("")
        .map(ch => subscriptMap[ch] ?? ch)
        .join("");
}

export function workspaceClass(
    workspace: Hyprland.Workspace,
    focused: Hyprland.Workspace,
    actives: Hyprland.Workspace[]
): string {
    if (workspace === focused) {
        return "focused";
    } else if (actives.includes(workspace)) {
        return "active-unfocused";
    } else {
        return "";
    }
}

export function Workspaces() {
    const v = Variable.derive(
        [bind(hypr, "workspaces"), bind(hypr, "focusedWorkspace"), bind(hypr, "monitors")],
        (workspaces, focused, monitors) => {
            const filtered = workspaces.filter(ws => !(ws.id >= -99 && ws.id <= -2)); // filter out special workspaces

            monitors = monitors.sort((a, b) => a.get_x() - b.get_x());
            const actives = activeWorkspaces(monitors);

            const jsxRemaining = monitors.map((monitor, index) => {
                const forMonitor = filtered
                    .sort((a, b) => a.id - b.id)
                    .filter(ws => ws.monitor == monitor)
                    .map(ws => (
                        <box className="workspaces">
                            <button
                                cursor={"pointer"}
                                className={`${workspaceClass(ws, focused, actives)}`}
                                onClicked={() => hypr.dispatch("workspace", ws.id.toString())}
                            >
                                {ws.id}
                            </button>
                        </box>
                    ));
                const baseItems = [<label label={`${toSubscript(index + 1)}`} />, forMonitor];
                if (monitors.length !== index + 1) {
                    baseItems.push(<label label="┃" />);
                }
                return baseItems;
            });

            return [<label label="󰘔⁝ " />, ...jsxRemaining];
        }
    );

    return <box className="bar-item">{bind(v)}</box>;
}
