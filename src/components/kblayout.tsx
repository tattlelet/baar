import { bind, Variable } from "astal";
import { Astal } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { HyprCtl, SWITCH_KB_OPTIONS } from "src/core/hyprclt";
import { KbLayoutFinder, KbLayoutMapping } from "src/core/kblayoutfinder";

// Further refactor Variable interactions
export const KbLayout = (): JSX.Element => {
    const variableWritter = async (v: Variable<KbLayoutMapping>, f: () => Promise<KbLayoutMapping>): Promise<void> => {
        v.set(await f());
    };

    const kbf = new KbLayoutFinder();
    const layoutMap = new Variable({} as KbLayoutMapping);
    const f = kbf.layoutSymbol.bind(kbf);
    const hookF = variableWritter.bind(null, layoutMap, f);
    const hyprlandService = AstalHyprland.get_default();
    const hyprctl = HyprCtl.instance();

    return (
        <button
            cursor={"pointer"}
            className="bar-item kblayout"
            label={bind(layoutMap).as(layoutMap => layoutMap.symbol || "")}
            tooltipText={bind(layoutMap).as(layoutMap => layoutMap.layout || "")}
            setup={(self): void => {
                hookF();
                self.hook(hyprlandService, "keyboard-layout", hookF);
            }}
            onClick={(_, event) => {
                if (event.button === Astal.MouseButton.PRIMARY || event.button === Astal.MouseButton.SECONDARY) {
                    const direction: SWITCH_KB_OPTIONS = event.button === Astal.MouseButton.PRIMARY ? "next" : "prev";
                    hyprctl.switchKbLayout(direction);
                }
            }}
        />
    );
};
