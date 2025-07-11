import { execAsync } from "astal";
import { escapeRegExp, RegexMatcher } from "./regex";
import { HyprCtl } from "./hyprclt";
import { isAtoZ } from "./symbols";
import { Measured } from "./timer";
import { Logger } from "./log";
import { Result, Ok, Err, wrapIO } from "./matcher/base";

export interface KbLayoutMapping {
    readonly symbol: string;
    readonly layout: string;
}

export class KbLayoutFinder {
    private static readonly logger = Logger.get(this);
    private static readonly ERROR_SYMBOL = "💥";
    private static readonly FLAG_OFFSET = 0x1f1e6;
    private readonly cache: Map<string, string> = new Map();
    private readonly hyprctl: HyprCtl = HyprCtl.instance();

    private static INSTANCE = new KbLayoutFinder();

    public static instace(): KbLayoutFinder {
        return this.INSTANCE;
    }

    private constructor() {}

    private async layout(): Promise<Result<string, unknown>> {
        return (await this.hyprctl.mainKeyboard()).mapResult(
            main => new Ok(main.active_keymap),
            e => new Err(e)
        );
    }

    private toSymbol(countryCode: string): string {
        let symbol = KbLayoutFinder.ERROR_SYMBOL;
        if (countryCode.length !== 2) {
            return symbol;
        }

        const firstChar = countryCode[0].toUpperCase().charCodeAt(0);
        const secondChar = countryCode[1].toUpperCase().charCodeAt(0);

        if (isAtoZ(firstChar) || isAtoZ(secondChar)) {
            return symbol;
        }

        return (
            String.fromCodePoint(KbLayoutFinder.FLAG_OFFSET + (firstChar - "A".charCodeAt(0))) +
            String.fromCodePoint(KbLayoutFinder.FLAG_OFFSET + (secondChar - "A".charCodeAt(0)))
        );
    }

    private async findCountryCode(layout: string): Promise<string> {
        if (this.cache.has(layout)) {
            return this.cache.get(layout)!;
        }

        // This comes from xkeyboard
        const cmd = `grep -P '^\\s*\\w{2}\\s+${escapeRegExp(layout)}$' /usr/share/X11/xkb/rules/evdev.lst`;
        return (await wrapIO(KbLayoutFinder.logger, execAsync(cmd), `Failed executing ${cmd}`)).match(
            v =>
                RegexMatcher.matchString(v, /^\s*(?<code>\w{2})/, "code").match(
                    match => {
                        this.cache.set(layout, match.groups!.code);
                        return match.groups!.code;
                    },
                    _ => ""
                ),
            _ => ""
        );
    }

    @Measured(KbLayoutFinder.logger.debug)
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
