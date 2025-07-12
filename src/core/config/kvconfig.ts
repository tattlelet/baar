import { Logger, LogMe } from "../log";
import { Optional } from "../matcher/optional";
import { RegexMatcher } from "../regex";
import { Measured } from "../timer";
import { ConfigRecordParser, ConfigParser } from "./base";
import { NoopTransformer, RecordAggregator, partialConfigMatcher } from "./common";

class KVConfigRecordParser implements ConfigRecordParser<[string, string]> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(/(?<paramKey>[a-zA-Z][a-zA-Z0-9-.]+[a-zA-Z0-9]) +(?<paramValue>[# a-zA-Z0-9-.]+[a-zA-Z0-9])/)
        .build();

    public parse(line: string): Optional<[string, string]> {
        return RegexMatcher.matchString(line, KVConfigRecordParser.RECORD_REGEX, "paramKey", "paramValue").map(
            match => {
                const { paramKey, paramValue } = match.groups!;
                return [paramKey, paramValue];
            }
        );
    }
}

export class KVConfigParser extends ConfigParser<[string, string], [string, string], Readonly<Record<string, string>>> {
    public static logger: Logger = Logger.get(this);

    constructor() {
        super(KVConfigParser.logger, new KVConfigRecordParser(), new NoopTransformer(), new RecordAggregator());
    }

    @Measured(KVConfigParser.logger.debug)
    public async parse(content: Optional<string>): Promise<Readonly<Record<string, string>>> {
        return super.parse(content);
    }
}

export enum DefaultKVConfigValues {
    TASKBAR_MAX_LENGTH = 20,
}

@LogMe(KVConfig.logger.debug)
export class KVConfig {
    private static logger = Logger.get(KVConfig);

    public readonly taskbarMaxLength = DefaultKVConfigValues.TASKBAR_MAX_LENGTH;

    private parseType<T extends string | number | boolean>(key: T, value?: string): T | undefined {
        if (value === "false") {
            return false as T;
        }
        if (value === "true") {
            return true as T;
        }
        if (typeof key === "number") {
            return Number(value) as T;
        } else {
            return value as T;
        }
    }

    constructor(data: Readonly<Partial<KVConfig>>) {
        Object.keys(data).forEach(key => {
            if (key in this) {
                const objKey = (this as any)[key];
                const value = data[key as keyof KVConfig] as string | undefined;
                (this as any)[key] = this.parseType(objKey, value);
            }
        });
        Object.freeze(this);
    }
}

export function toCss<T extends Readonly<KVConfig>>(configOp: Optional<T>): string {
    return configOp
        .map(config =>
            Object.getOwnPropertyNames(config)
                .map(key => `\$${key}: ${(config as any)[key]};`)
                .join("\n")
        )
        .getOr("");
}
