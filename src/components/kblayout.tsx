import { bind, Variable } from "astal";
import { Astal } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { HyprCtl, SwitchKeyboardOptions } from "src/core/hyprclt";
import { KbLayoutFinder } from "src/core/kblayoutfinder";

// Todo: create global context
const hyprlandService = AstalHyprland.get_default();
const hyprctl = HyprCtl.instance();
const layoutMap = new Variable(await KbLayoutFinder.instace().layoutSymbol());

hyprlandService.connect("keyboard-layout", async () => {
    layoutMap.set(await KbLayoutFinder.instace().layoutSymbol());
});

// Todo: Further refactor Variable interactions
export const KbLayout = (): JSX.Element => {
    return (
        <button
            cursor={"pointer"}
            className="bar-item kblayout"
            label={bind(layoutMap).as(layoutMap => layoutMap.symbol || "")}
            tooltipText={bind(layoutMap).as(layoutMap => layoutMap.layout || "")}
            onClick={(_, event) => {
                if (event.button === Astal.MouseButton.PRIMARY || event.button === Astal.MouseButton.SECONDARY) {
                    const direction: SwitchKeyboardOptions =
                        event.button === Astal.MouseButton.PRIMARY ? "next" : "prev";
                    hyprctl.switchKbLayout(direction);
                }
            }}
        />
    );
};
