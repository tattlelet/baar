import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { RegexMatcher } from "../regex";
import { ConfigRecordParser, ConfigRecordTransformer, ConfigParser, ConfigAggregator } from "./base";
import { GroupAggregator, HasGroup, partialConfigMatcher, ReadonlyAggregator } from "./common";
import { enumContainsValue } from "../enum";
import { ClientInfoType, getClientInfo } from "../hyprclt";
import { Measured } from "../timer";
import { LogMe } from "../log";

export interface SymbolConfigRecord {
    readonly group?: string;
    readonly infoType: string;
    readonly matcher: string;
    readonly symbol: string;
}

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

    public parse(line: string): Result<SymbolConfigRecord, undefined> {
        return RegexMatcher.matchString(line, SymbolConfigRecordParser.RECORD_REGEX, "matcher", "symbol").mapResult(
            match => {
                const { group, infoType = ClientInfoType.CLASS, matcher, symbol } = match.groups!;
                return new Ok({ group, infoType, matcher, symbol });
            },
            e => new Err(undefined)
        );
    }
}

export class SymbolConfigTransformer implements ConfigRecordTransformer<SymbolConfigRecord, SymbolTranslator> {
    private static logger: Logger = Logger.get(this);

    transform(configRecord: SymbolConfigRecord): Result<SymbolMatcher, undefined> {
        if (!enumContainsValue(ClientInfoType, configRecord.infoType)) {
            return new Err(undefined);
        }

        const matcher = RegexMatcher.parse(configRecord.matcher).match(
            regex => regex,
            e => e
        );

        if (matcher === undefined) {
            return new Err(undefined);
        }

        return new Ok(
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
    public parse(content?: string): Promise<SymbolTranslator[]> {
        return super.parse(content);
    }
}

@LogMe(SymbolConfig.logger.debug)
export class SymbolConfig {
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

        return "";
    }

    private *matcherIterator(): Generator<SymbolTranslator> {
        for (const matcher of this.symbolMatchers) {
            yield matcher;
        }
    }
}
