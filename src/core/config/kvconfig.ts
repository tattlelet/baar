import { RegexMatcher } from "../regex";
import { ConfigRecordParser, ConfigParser } from "./base";
import { NoopTransformer, RecordAggregator, ConfigHelper, partialConfigMatcher } from "./common";

class KVConfigRecordParser implements ConfigRecordParser<[string, string]> {
    private static RECORD_REGEX: RegExp = partialConfigMatcher()
        .orRegexes(/(?<paramKey>[a-zA-Z][a-zA-Z0-9-.]+[a-zA-Z0-9]) +(?<paramValue>[# a-zA-Z0-9-.]+[a-zA-Z0-9])/)
        .build();

    public parse(line: string): Result<[string, string], undefined> {
        return RegexMatcher.matchString(line, KVConfigRecordParser.RECORD_REGEX, "paramKey", "paramValue").mapResult(
            match => {
                const { paramKey, paramValue } = match.groups!;
                return new Ok([paramKey, paramValue]);
            },
            e => new Err(undefined)
        );
    }
}

export class KVConfigParser extends ConfigParser<[string, string], [string, string], Readonly<Record<string, string>>> {
    public static logger: Logger = Logger.get(KVConfigParser);

    constructor() {
        super(KVConfigParser.logger, new KVConfigRecordParser(), new NoopTransformer(), new RecordAggregator());
    }
}

export class KVConfig {
    private static logger = Logger.get(KVConfig);

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
        KVConfig.logger.debug("End config:", JSON.stringify(this));
    }
}

export function toCss<T extends Readonly<KVConfig>>(config: T): string {
    return Object.getOwnPropertyNames(config)
        .map(key => `\$${key}: ${(config as any)[key]};`)
        .join("\n");
}
