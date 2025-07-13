import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { ClientInfoType, getClientInfo } from "../hyprclt";
import { enumContainsValue } from "../lang/enum";
import { Logger, LogMe } from "../lang/log";
import { Measured } from "../lang/timer";
import { Optional } from "../matcher/optional";
import { RegexMatcher } from "../regex";
import { ConfigParser, ConfigRecordParser, ConfigRecordTransformer } from "./base";
import { GroupAggregator, HasGroup, partialConfigMatcher } from "./common";

export interface SymbolConfigRecord {
    readonly group?: string;
    readonly infoType: string;
    readonly matcher: string;
    readonly symbol: string;
}

// Todo: support color
export interface SymbolMatcherProps {
    readonly group?: string;
    readonly infoType: ClientInfoType;
    readonly infoMatcher: RegExp;
    readonly symbol: string;
}

export interface SymbolTranslator extends HasGroup {
    translate(client: AstalHyprland.Client): string | undefined;
}

export class SymbolMatcher implements SymbolTranslator {
    private static logger = Logger.get(this);
    constructor(readonly props: SymbolMatcherProps) {}

    public group(): string | undefined {
        return this.props.group;
    }

    public translate(client: AstalHyprland.Client): string | undefined {
        const info = getClientInfo(client, this.props.infoType);
        if (info === undefined) {
            return undefined;
        }

        if (this.props.infoMatcher.test(info)) {
            return this.props.symbol;
        }

        return undefined;
    }
}

export class ChainedMatcher implements SymbolTranslator {
    constructor(
        private readonly matchers: SymbolTranslator[],
        private readonly thisGroup?: string
    ) {}

    public group(): string | undefined {
        return this.thisGroup;
    }

    public translate(client: AstalHyprland.Client): string | undefined {
        return this.matchers.map(matcher => matcher.translate(client)).reduce((a, b) => a && b);
    }
}

export class SymbolConfigRecordParser implements ConfigRecordParser<SymbolConfigRecord> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(/(?:group=(?<group>[^,]+)\s*,\s*)?(?<infoType>[^,]*)\s*,\s*(?<matcher>.+)\s*,\s*(?<symbol>.)/)
        .flags("u")
        .build();

    public parse(line: string): Optional<SymbolConfigRecord> {
        return RegexMatcher.matchString(line, SymbolConfigRecordParser.RECORD_REGEX, "matcher", "symbol").apply(
            match => {
                const { group, infoType = ClientInfoType.CLASS, matcher, symbol } = match.groups!;
                return { group, infoType, matcher, symbol } as SymbolConfigRecord;
            }
        );
    }
}

export class SymbolConfigTransformer implements ConfigRecordTransformer<SymbolConfigRecord, SymbolTranslator> {
    private static logger: Logger = Logger.get(this);

    transform(configRecord: SymbolConfigRecord): Optional<SymbolMatcher> {
        if (!enumContainsValue(ClientInfoType, configRecord.infoType)) {
            return Optional.none();
        }

        return RegexMatcher.parse(configRecord.matcher).apply(
            matcher =>
                new SymbolMatcher({
                    group: configRecord.group,
                    infoType: configRecord.infoType as ClientInfoType,
                    infoMatcher: matcher,
                    symbol: configRecord.symbol,
                })
        );
    }
}

export class SymbolConfigParser extends ConfigParser<SymbolConfigRecord, SymbolTranslator, SymbolTranslator[]> {
    public static logger: Logger = Logger.get(SymbolConfigParser);

    constructor() {
        super(
            SymbolConfigParser.logger,
            new SymbolConfigRecordParser(),
            new SymbolConfigTransformer(),
            new GroupAggregator(ChainedMatcher)
        );
    }

    @Measured(SymbolConfigParser.logger.debug)
    public parse(content: Optional<string>): Promise<SymbolTranslator[]> {
        return super.parse(content);
    }
}

@LogMe(SymbolConfig.logger.debug)
export class SymbolConfig {
    public static DEFAULT_ICON = "";
    private static logger = Logger.get(SymbolConfig);

    private static defaultSymbols(): SymbolTranslator[] {
        return [
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /kitty/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /code-oss/,
                symbol: "󰨞",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /librewolf/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /nemo/,
                symbol: "󰝰",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /discord/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /com.discordapp.Discord/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /steam/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /mpv/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /org.kde.gwenview/,
                symbol: "",
            }),
            new SymbolMatcher({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /Mullvad VPN/,
                symbol: "",
            }),
        ];
    }

    private readonly symbolMatchers: SymbolTranslator[];

    constructor(symbolMatchers: SymbolTranslator[]) {
        this.symbolMatchers = symbolMatchers.concat(SymbolConfig.defaultSymbols());
    }

    public getSymbol(client: AstalHyprland.Client): string {
        for (const matcher of this.matcherIterator()) {
            const symbol = matcher.translate(client);

            if (symbol !== undefined) {
                return symbol;
            }
        }

        return SymbolConfig.DEFAULT_ICON;
    }

    private *matcherIterator(): Generator<SymbolTranslator> {
        for (const matcher of this.symbolMatchers) {
            yield matcher;
        }
    }
}
