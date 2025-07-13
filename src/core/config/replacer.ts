import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { ClientInfoType, getClientInfo } from "../hyprclt";
import { enumContainsValue } from "../lang/enum";
import { Logger, LogMe } from "../lang/log";
import { Measured } from "../lang/timer";
import { Optional } from "../matcher/optional";
import { RegexMatcher } from "../regex";
import { ConfigParser, ConfigRecordParser, ConfigRecordTransformer } from "./base";
import { GroupAggregator, HasGroup, partialConfigMatcher } from "./common";

export interface ReplaceConfigRecord {
    readonly group?: string;
    readonly infoType: string;
    readonly matcher: string;
    readonly replacer: string;
    readonly replacement?: string;
}

export interface ReplacerProps {
    readonly group?: string;
    readonly infoType: ClientInfoType;
    readonly infoMatcher: RegExp;
    readonly replacer: RegExp;
    readonly replacement?: string;
}

export interface Replacer extends HasGroup {
    replace(client: AstalHyprland.Client, title: string): string | undefined;
}

export class BasicReplacer implements Replacer {
    constructor(readonly props: ReplacerProps) {}

    public group(): string | undefined {
        return this.props.group;
    }

    public replace(client: AstalHyprland.Client, title: string): string | undefined {
        const info = getClientInfo(client, this.props.infoType);
        if (info === undefined || !this.props.infoMatcher.test(info)) {
            return undefined;
        }

        return title.replace(this.props.replacer, this.props.replacement || "");
    }
}

export class ReplacerConfigRecordParser implements ConfigRecordParser<ReplaceConfigRecord> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(
            /(?:group=(?<group>[^,]+)\s*,\s*)?(?<infoType>[^,]*)\s*,\s*(?<matcher>.+?)\s*,\s*(?<replacer>.+?)(?:(?:\s*,\s*(?<replacement>.+))|$)/
        )
        .flags("u")
        .build();

    public parse(line: string): Optional<ReplaceConfigRecord> {
        return RegexMatcher.matchString(line, ReplacerConfigRecordParser.RECORD_REGEX, "matcher").apply(match => {
            const { group, infoType = ClientInfoType.CLASS, matcher, replacer, replacement } = match.groups!;
            return { group, infoType, matcher, replacer, replacement };
        });
    }
}

export class ReplacerConfigTransformer implements ConfigRecordTransformer<ReplaceConfigRecord, Replacer> {
    public transform(configRecord: ReplaceConfigRecord): Optional<Replacer> {
        if (!enumContainsValue(ClientInfoType, configRecord.infoType)) {
            return Optional.none();
        }

        const matcher = RegexMatcher.parse(configRecord.matcher);
        if (matcher.isNone()) {
            return Optional.none();
        }

        const replacer = RegexMatcher.parse(configRecord.replacer);
        if (replacer.isNone()) {
            return Optional.none();
        }

        return Optional.some(
            new BasicReplacer({
                group: configRecord.group,
                infoType: configRecord.infoType as ClientInfoType,
                infoMatcher: matcher.unwrap(),
                replacer: replacer.unwrap(),
                replacement: configRecord.replacement,
            })
        );
    }
}

export class ChainedReplacer implements Replacer {
    constructor(
        private readonly replacers: Replacer[],
        private readonly thisGroup?: string
    ) {}

    public group(): string | undefined {
        return this.thisGroup;
    }

    public replace(client: AstalHyprland.Client, title: string): string | undefined {
        for (const replacer of this.replacers) {
            const newTitle = replacer.replace(client, title);
            if (newTitle !== undefined) {
                title = newTitle;
            }
        }
        return title;
    }
}

export class ReplacerConfigParser extends ConfigParser<ReplaceConfigRecord, Replacer, Replacer[]> {
    public static logger: Logger = Logger.get(this);

    constructor() {
        super(
            ReplacerConfigParser.logger,
            new ReplacerConfigRecordParser(),
            new ReplacerConfigTransformer(),
            new GroupAggregator<Replacer>(ChainedReplacer)
        );
    }

    @Measured(ReplacerConfigParser.logger.debug)
    public parse(content: Optional<string>): Promise<Replacer[]> {
        return super.parse(content);
    }
}

@LogMe(ReplacerConfig.logger.debug)
export class ReplacerConfig {
    private static logger = Logger.get(ReplacerConfig);

    private static defaultReplacement(): Replacer[] {
        return [
            new BasicReplacer({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /.*/,
                replacer: /\s/g,
                replacement: " ",
            }),
            new BasicReplacer({
                infoType: ClientInfoType.CLASS,
                infoMatcher: /.*/,
                replacer: /(?:\s*[-—]\s*)\w+$/i,
            }),
        ];
    }

    private readonly replacers: Replacer[];

    constructor(replacers: Replacer[]) {
        this.replacers = replacers.concat(ReplacerConfig.defaultReplacement());
    }

    public replace(client: AstalHyprland.Client): string {
        let title = client.title;
        for (const replacer of this.replacerIterator()) {
            const newTitle = replacer.replace(client, title);
            if (newTitle !== undefined) {
                title = newTitle;
            }
        }

        return title;
    }

    private *replacerIterator(): Generator<Replacer> {
        for (const matcher of this.replacers) {
            yield matcher;
        }
    }
}
