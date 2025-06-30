import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { RegexMatcher, escapeRegExp, jsonReplacer } from "../regex";
import { ConfigRecordParser, ConfigRecordTransformer, ConfigParser, ConfigAggregator } from "./base";
import { partialConfigMatcher, ReadonlyAggregator } from "./common";
import { enumContainsValue } from "../enum";

export enum SymbolMatcherType {
    CLASS = "class",
    INITIAL_TITLE = "initial-title",
    TITLE = "title",
}

export interface SymbolConfigRecord {
    readonly group?: string;
    readonly infoType: string;
    readonly matcher: string;
    readonly symbol: string;
}

export interface SymbolMatcherProps {
    readonly group?: string;
    readonly infoType: SymbolMatcherType;
    readonly infoMatcher: RegExp;
    readonly symbol: string;
}

export interface SymbolTranslator {
    translate(client: AstalHyprland.Client): string | undefined;
}

export class SymbolMatcher implements SymbolTranslator {
    private static logger = Logger.get(SymbolMatcher);

    constructor(readonly props: SymbolMatcherProps) {}

    public group(): string | undefined {
        return this.props.group;
    }

    public translate(client: AstalHyprland.Client): string | undefined {
        let info;
        if (this.props.infoType === SymbolMatcherType.CLASS) {
            info = client.class;
        } else if (this.props.infoType === SymbolMatcherType.TITLE) {
            info = client.title;
        } else if (this.props.infoType === SymbolMatcherType.INITIAL_TITLE) {
            info = client.initialTitle;
        } else {
            return undefined;
        }

        if (this.props.infoMatcher.test(info)) {
            return this.props.symbol;
        }

        return undefined;
    }
}

export class ChainedMatcher implements SymbolTranslator {
    private matcher: SymbolMatcher[];

    constructor(matchers: SymbolMatcher[]) {
        this.matcher = matchers;
    }

    public translate(client: AstalHyprland.Client): string | undefined {
        return this.matcher.map(matcher => matcher.translate(client)).reduce((a, b) => a && b);
    }
}

export class SymbolConfigRecordParser implements ConfigRecordParser<SymbolConfigRecord> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(/(?:group=(?<group>[^,]+)\s*,\s*)?(?<infoType>[^,]*)\s*,\s*(?<matcher>.+)\s*,\s*(?<symbol>.)/)
        .flags("u")
        .build();

    parse(line: string): Result<SymbolConfigRecord, undefined> {
        return RegexMatcher.matchString(line, SymbolConfigRecordParser.RECORD_REGEX, "matcher", "symbol").mapResult(
            match => {
                const { group, infoType = SymbolMatcherType.CLASS, matcher, symbol } = match.groups!;
                return new Ok({ group, infoType, matcher, symbol });
            },
            e => new Err(undefined)
        );
    }
}

export class SymbolConfigTransformer implements ConfigRecordTransformer<SymbolConfigRecord, SymbolMatcher> {
    private static logger: Logger = Logger.get(SymbolConfigTransformer);

    transform(configRecord: SymbolConfigRecord): Result<SymbolMatcher, undefined> {
        if (!enumContainsValue(SymbolMatcherType, configRecord.infoType)) {
            return new Err(undefined);
        }

        let matcher;
        try {
            matcher = RegexMatcher.matchString(
                configRecord.matcher,
                /^\/(?<pattern>.*)\/(?<flags>[gimsuy])?$/,
                "pattern"
            ).match(
                matcher => new RegExp(matcher.groups!.pattern, matcher.groups!.flags),
                noMatch => new RegExp(`${escapeRegExp(configRecord.matcher)}`)
            );
        } catch (e) {
            SymbolConfigTransformer.logger.warn(
                `Bad regex provided in config record: ${configRecord}, skipping record`
            );
            return new Err(undefined);
        }

        return new Ok(
            new SymbolMatcher({
                group: configRecord.group,
                infoType: configRecord.infoType as SymbolMatcherType,
                infoMatcher: matcher,
                symbol: configRecord.symbol,
            })
        );
    }
}

export class SymbolMatcherAggregator implements ConfigAggregator<SymbolMatcher, SymbolTranslator[]> {
    aggregate(results: SymbolMatcher[]): SymbolTranslator[] {
        const groupMatchers = results.filter(matcher => matcher.group() !== undefined);
        const remaining = results.filter(matcher => !groupMatchers.includes(matcher));

        const chainedMatchers = Object.entries(
            groupMatchers.reduce(
                (acc, matcher) => {
                    let matchers: SymbolMatcher[] = [];
                    if (matcher.group()! in acc) {
                        matchers = acc[matcher.group()!];
                    }
                    matchers.push(matcher);
                    acc[matcher.group()!] = matchers;
                    return acc;
                },
                {} as Record<string, SymbolMatcher[]>
            )
        ).map(([group, matchers]) => new ChainedMatcher(matchers));

        return ([] as SymbolTranslator[]).concat(remaining).concat(chainedMatchers);
    }
}

export class SymbolConfigParser extends ConfigParser<SymbolConfigRecord, SymbolMatcher, SymbolTranslator[]> {
    public static logger: Logger = Logger.get(SymbolConfigParser);

    constructor() {
        super(
            SymbolConfigParser.logger,
            new SymbolConfigRecordParser(),
            new SymbolConfigTransformer(),
            new SymbolMatcherAggregator()
        );
    }
}

export class SymbolConfig {
    private static logger = Logger.get(SymbolConfig);
    private static DEFAULT_SYMBOLS = [
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /kitty/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /code-oss/,
            symbol: "󰨞",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /librewolf/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /nemo/,
            symbol: "󰝰",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /discord/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /com.discordapp.Discord/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /steam/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /mpv/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /org.kde.gwenview/,
            symbol: "",
        }),
        new SymbolMatcher({
            infoType: SymbolMatcherType.CLASS,
            infoMatcher: /Mullvad VPN/,
            symbol: "",
        }),
    ];

    constructor(private readonly symbolMatcher: SymbolTranslator[]) {
        SymbolConfig.logger.debug("End config:", JSON.stringify(this, jsonReplacer, 2));
    }

    // Todo: memoize LRU (?)
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
        for (const matcher of this.symbolMatcher) {
            yield matcher;
        }

        for (const matcher of SymbolConfig.DEFAULT_SYMBOLS) {
            yield matcher;
        }
    }
}
