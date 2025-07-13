import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { ClientInfoType, getClientInfo } from "../hyprclt";
import { enumContainsValue } from "../lang/enum";
import { Logger, LogMe } from "../lang/log";
import { Measured } from "../lang/timer";
import { Optional } from "../matcher/optional";
import { RegexMatcher } from "../regex";
import { ConfigParser, ConfigRecordParser, ConfigRecordTransformer } from "./base";
import { GroupAggregator, HasGroup, partialConfigMatcher } from "./common";
import { allOf, toIterator } from "../lang/iter";

export interface SymbolConfigRecord {
    readonly group?: string;
    readonly infoType: string;
    readonly matcher: string;
    readonly symbol: string;
    readonly color?: string;
}

// Todo: support color
export interface SymbolMatcherProps {
    readonly group?: string;
    readonly infoType: ClientInfoType;
    readonly infoMatcher: RegExp;
    readonly symbol: string;
    readonly color?: string;
}

export class SymbolResult {
    constructor(public readonly symbol: string, public readonly color: Optional<string> = Optional.none()) {}
}

export interface SymbolTranslator extends HasGroup {
    translate(client: AstalHyprland.Client): Optional<SymbolResult>;
}

export class SymbolMatcher implements SymbolTranslator {
    private static logger = Logger.get(this);
    constructor(readonly props: SymbolMatcherProps) {}

    public group(): string | undefined {
        return this.props.group;
    }

    public translate(client: AstalHyprland.Client): Optional<SymbolResult> {
        const info = getClientInfo(client, this.props.infoType);
        if (info === undefined) {
            return Optional.none();
        }

        if (this.props.infoMatcher.test(info)) {
            return Optional.some(new SymbolResult(this.props.symbol, Optional.from(this.props.color)));
        }

        return Optional.none();
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

    public translate(client: AstalHyprland.Client): Optional<SymbolResult> {
        const matches = this.matchers.map(matcher => matcher.translate(client));
        if (matches.length > 0 && allOf(toIterator(matches), match => match.isSome())) {
            return Optional.from(matches.pop())
                .getOr(Optional.none());
        }
        return Optional.none();
    }
}

export class SymbolConfigRecordParser implements ConfigRecordParser<SymbolConfigRecord> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(/(?:group=(?<group>[^,]+)\s*,\s*)?(?<infoType>[^,]*)\s*,\s*(?<matcher>.+)\s*,\s*(?<symbol>.)(?:\s*,\s*(?<color>#[a-fA-F0-9]{6}))?/)
        .flags("u")
        .build();

    public parse(line: string): Optional<SymbolConfigRecord> {
        return RegexMatcher.matchString(line, SymbolConfigRecordParser.RECORD_REGEX, "matcher", "symbol").apply(
            match => {
                const { group, infoType = ClientInfoType.CLASS, matcher, symbol, color } = match.groups!;
                return { group, infoType, matcher, symbol, color } as SymbolConfigRecord;
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
                    color: configRecord.color
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
    // Grab this from KVConfig
    public static DEFAULT_RESULT = new SymbolResult("");
    private static logger = Logger.get(SymbolConfig);

    // Todo: move this to default config, which has to pointed to by KVConfig
    private static defaultSymbols(): SymbolTranslator[] {
        return [];
    }

    private readonly symbolMatchers: SymbolTranslator[];

    constructor(symbolMatchers: SymbolTranslator[]) {
        this.symbolMatchers = symbolMatchers.concat(SymbolConfig.defaultSymbols());
    }

    public getSymbol(client: AstalHyprland.Client): SymbolResult {
        for (const matcher of this.matcherIterator()) {
            const symbol = matcher.translate(client);

            if (symbol.isSome()) {
                return symbol.get();
            }
        }

        return SymbolConfig.DEFAULT_RESULT;
    }

    private *matcherIterator(): Generator<SymbolTranslator> {
        for (const matcher of this.symbolMatchers) {
            yield matcher;
        }
    }
}
