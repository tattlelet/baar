import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { RegexMatcher, escapeRegExp } from "../regex";
import { ConfigRecordParser, ConfigRecordTransformer, ConfigParser } from "./base";
import { partialConfigMatcher, ReadonlyAggregator } from "./common";
import { enumContainsValue } from "../enum";

export enum SymbolMatcherType {
    CLASS = "class",
    INITIAL_TITLE = "initial-title",
    TITLE = "title",
}

export interface SymbolConfigRecord {
    readonly infoType: string;
    readonly matcher: string;
    readonly symbol: string;
}

export class SymbolMatcher {
    private static logger = Logger.get(SymbolMatcher);

    constructor(
        readonly infoType: SymbolMatcherType,
        readonly infoMatcher: RegExp,
        readonly symbol: string
    ) {}

    public translate(client: AstalHyprland.Client): string | undefined {
        let info;
        if (this.infoType === SymbolMatcherType.CLASS) {
            info = client.class;
        } else if (this.infoType === SymbolMatcherType.TITLE) {
            info = client.title;
        } else if (this.infoType === SymbolMatcherType.INITIAL_TITLE) {
            info = client.initialTitle;
        } else {
            return undefined;
        }

        if (this.infoMatcher.test(info)) {
            return this.symbol;
        }

        return undefined;
    }
}

export class SymbolConfigRecordParser implements ConfigRecordParser<SymbolConfigRecord> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(/(?<infoType>[^,]*)\s*,\s*(?<matcher>.+)\s*,\s*(?<symbol>.)/)
        .flags("u")
        .build();

    parse(line: string): Result<SymbolConfigRecord, undefined> {
        return RegexMatcher.matchString(line, SymbolConfigRecordParser.RECORD_REGEX, "matcher", "symbol").mapResult(
            match => {
                const { infoType = SymbolMatcherType.CLASS, matcher, symbol } = match.groups!;
                return new Ok({ infoType, matcher, symbol });
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

        return new Ok(new SymbolMatcher(configRecord.infoType as SymbolMatcherType, matcher, configRecord.symbol));
    }
}

export class SymbolConfigParser extends ConfigParser<SymbolConfigRecord, SymbolMatcher, Readonly<SymbolMatcher[]>> {
    public static logger: Logger = Logger.get(SymbolConfigParser);

    constructor() {
        super(
            SymbolConfigParser.logger,
            new SymbolConfigRecordParser(),
            new SymbolConfigTransformer(),
            new ReadonlyAggregator<SymbolMatcher>()
        );
    }
}

export class SymbolConfig {
    private static logger = Logger.get(SymbolConfig);
    private static DEFAULT_SYMBOLS = [
        new SymbolMatcher(SymbolMatcherType.CLASS, /kitty/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /code-oss/, "󰨞"),
        new SymbolMatcher(SymbolMatcherType.CLASS, /librewolf/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /nemo/, "󰝰"),
        new SymbolMatcher(SymbolMatcherType.CLASS, /discord/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /com.discordapp.Discord/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /steam/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /mpv/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /org.kde.gwenview/, ""),
        new SymbolMatcher(SymbolMatcherType.CLASS, /Mullvad VPN/, ""),
    ];

    constructor(private readonly symbolMatcher: Readonly<SymbolMatcher[]>) {
        SymbolConfig.logger.debug(
            "End config:",
            this.symbolMatcher.map(matcher => matcher.infoMatcher.source)
        );
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

    private *matcherIterator(): Generator<SymbolMatcher> {
        for (const matcher of this.symbolMatcher) {
            yield matcher;
        }

        for (const matcher of SymbolConfig.DEFAULT_SYMBOLS) {
            yield matcher;
        }
    }
}
