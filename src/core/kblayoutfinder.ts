import { execAsync } from "astal";
import { escapeRegExp, RegexMatcher } from "./regex";
import { HyprCtl } from "./hyprclt";
import { isAtoZ } from "./symbols";
import { Measured } from "./timer";
import { Logger } from "./log";
import { Result, Ok, Err, Resultify } from "./matcher/base";

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
        return this.hyprctl.mainKeyboard().then(filled => filled.apply(main => Ok.of(main.active_keymap)));
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
        return Resultify.promise(execAsync(cmd)).then(filled =>
            filled
                .or(err => {
                    KbLayoutFinder.logger.except(`Failed finding country code ${layout}`, err);
                    return new Err("");
                })
                .apply(v =>
                    Ok.of(
                        RegexMatcher.matchString(v, /^\s*(?<code>\w{2})/, "code")
                            .map(match => {
                                this.cache.set(layout, match.groups!.code);
                                return match.groups!.code;
                            })
                            .getOr("")
                    )
                )
                .collect()
        );
    }

    @Measured(KbLayoutFinder.logger.debug)
    public async layoutSymbol(): Promise<KbLayoutMapping> {
        return this.layout().then(filled =>
            filled.match(
                v =>
                    this.findCountryCode(v).then(countryCodeFilled => {
                        return {
                            symbol: this.toSymbol(countryCodeFilled),
                            layout: v,
                        };
                    }),
                e =>
                    Promise.resolve({
                        symbol: KbLayoutFinder.ERROR_SYMBOL,
                        layout: String(e),
                    })
            )
        );
    }
}
