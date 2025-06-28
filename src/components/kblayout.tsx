import { bind, execAsync, Variable } from "astal";
import { Astal, Gtk } from "astal/gtk3";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { escapeRegExp } from "src/core/regex";

const logger = Logger.get();

export type HyprctlKeyboard = {
    address: string;
    name: string;
    rules: string;
    model: string;
    layout: string;
    variant: string;
    options: string;
    active_keymap: string;
    main: boolean;
};

type HyprctlMouse = {
    address: string;
    name: string;
    defaultSpeed: number;
};

export type HyprctlDeviceLayout = {
    mice: HyprctlMouse[];
    keyboards: HyprctlKeyboard[];
    tablets: unknown[];
    touch: unknown[];
    switches: unknown[];
};

export interface KbLayoutMapping {
    readonly symbol: string;
    readonly layout: string;
}

export class KbLayoutFinder {
    private static readonly logger = Logger.get(KbLayoutFinder);
    private static readonly ERROR_SYMBOL = "💥";
    private readonly hyprlandService = AstalHyprland.get_default();
    private readonly cache: Map<string, string> = new Map();

    private async layout(): Promise<Result<string, unknown>> {
        try {
            const devices: HyprctlDeviceLayout = JSON.parse(this.hyprlandService.message("j/devices"));
            const main = devices.keyboards.find(kb => kb.main);

            if (main === undefined) {
                throw Error("Failed to find layout");
            }

            return new Ok(main.active_keymap);
        } catch (error) {
            return new Err(error);
        }
    }

    private toSymbol(countryCode: string): string {
        let symbol = KbLayoutFinder.ERROR_SYMBOL;
        if (countryCode.length !== 2) {
            return symbol;
        }

        const OFFSET = 0x1f1e6;

        const firstChar = countryCode[0].toUpperCase().charCodeAt(0);
        const secondChar = countryCode[1].toUpperCase().charCodeAt(0);

        if (firstChar < 65 || firstChar > 90 || secondChar < 65 || secondChar > 90) {
            // Ensure it's A–Z
            return symbol;
        }

        return String.fromCodePoint(OFFSET + (firstChar - 65)) + String.fromCodePoint(OFFSET + (secondChar - 65));
    }

    private async findCountryCode(layout: string): Promise<string> {
        if (this.cache.has(layout)) {
            return this.cache.get(layout)!;
        }

        // This comes from xkeyboard
        const cmd = `grep -P '^\\s*\\w{2}\\s+${escapeRegExp(layout)}$' /usr/share/X11/xkb/rules/evdev.lst`;
        return (await wrapIO(KbLayoutFinder.logger, execAsync(cmd), `Failed executing ${cmd}`)).match(
            v => {
                const match = v.match(/^\s*(?<code>\w{2})/);
                let code = "";
                if (match !== null && match.groups !== undefined) {
                    code = match.groups.code;
                }
                this.cache.set(layout, code);
                return code;
            },
            _ => ""
        );
    }

    public async layoutSymbol(): Promise<KbLayoutMapping> {
        return await (
            await this.layout()
        ).match(
            async v => {
                return {
                    symbol: this.toSymbol(await this.findCountryCode(v)),
                    layout: v,
                };
            },
            async e => {
                return {
                    symbol: KbLayoutFinder.ERROR_SYMBOL,
                    layout: String(e),
                };
            }
        );
    }
}

// Cycle layout based on config with button
export const KbLayout = (): JSX.Element => {
    const variableWritter = async (v: Variable<KbLayoutMapping>, f: () => Promise<KbLayoutMapping>): Promise<void> => {
        v.set(await f());
    };

    const kbf = new KbLayoutFinder();
    const layoutMap = new Variable({} as KbLayoutMapping);
    const f = kbf.layoutSymbol.bind(kbf);
    const hookF = variableWritter.bind(null, layoutMap, f);
    const hyprlandService = AstalHyprland.get_default();

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
                    try {
                        const devices: HyprctlDeviceLayout = JSON.parse(hyprlandService.message("j/devices"));
                        const main = devices.keyboards.find(kb => kb.main);

                        if (main === undefined) {
                            throw Error("Couldnt get main keyboard");
                        }

                        const direction = event.button === Astal.MouseButton.PRIMARY ? "next" : "prev";

                        const cmd = `hyprctl switchxkblayout ${main?.name} ${direction}`;
                        wrapIO(logger, execAsync(cmd), `Failed executing ${cmd}`);
                    } catch (err) {
                        logger.warn("Failed to switch kb layout", err);
                    }
                }
            }}
        />
    );
};
