import { readFileAsync, Gio } from "astal";
import { RegexBuilder } from "../regex";
import { ConfigAggregator, ConfigRecordTransformer } from "./base";

export function partialConfigMatcher(): RegexBuilder {
    return RegexBuilder.new()
        .orRegexes(/(?<emptyLine>\s*)/, /(?<comment>#.+)/)
        .anchor();
}

export class ReadonlyAggregator<T> implements ConfigAggregator<T, Readonly<T[]>> {
    public aggregate(results: T[]): Readonly<T[]> {
        Object.freeze(results);
        return results as Readonly<T[]>;
    }
}

export class RecordAggregator<K extends keyof any, V> implements ConfigAggregator<[K, V], Readonly<Record<K, V>>> {
    aggregate(results: [K, V][]): Record<K, V> {
        const aggregated_result = results.reduce(
            (acc, [key, value]) => {
                acc[key] = value;
                return acc;
            },
            {} as Record<K, V>
        );
        Object.freeze(aggregated_result);
        return aggregated_result;
    }
}

export interface HasGroup {
    group(): string | undefined;
}

export class GroupAggregator<T extends HasGroup> implements ConfigAggregator<T, T[]> {
    constructor(private readonly chainFactory: new (agg: T[], group?: string) => T) {}

    aggregate(results: T[]): T[] {
        const groupMatchers = results.filter(
            replacer => replacer.group() !== undefined && replacer.group() !== "global"
        );
        const globalMatchers = results.filter(
            replacer => replacer.group() !== undefined && replacer.group() === "global"
        );
        const remaining = results.filter(
            matcher => !groupMatchers.includes(matcher) && !globalMatchers.includes(matcher)
        );

        const chainedMatchers = Object.entries(
            groupMatchers.reduce(
                (acc, matcher) => {
                    let matchers: T[] = [];
                    if (matcher.group()! in acc) {
                        matchers = acc[matcher.group()!];
                    }
                    matchers.push(matcher);
                    acc[matcher.group()!] = matchers;
                    return acc;
                },
                {} as Record<string, T[]>
            )
        ).map(([group, matchers]) => new this.chainFactory(matchers, group));

        return chainedMatchers.concat(remaining).concat(globalMatchers);
    }
}

export class NoopTransformer<R> implements ConfigRecordTransformer<R, R> {
    public transform(configRecord: R): Result<R, undefined> {
        throw new Ok(configRecord);
    }
}

export class ConfigHelper {
    private static logger = Logger.get(ConfigHelper);

    public static async readConfigFile(path: string): Promise<string | undefined> {
        return (await wrapIO(ConfigHelper.logger, readFileAsync(path), "Failed to read config file")).match(
            v => v,
            _ => undefined
        );
    }

    public static defaultHandler(
        handler: (...args: any) => any,
        file: string,
        event: Gio.FileMonitorEvent,
        excludeEvents: Gio.FileMonitorEvent[] = []
    ): void {
        ConfigHelper.logger.info(file, event);
        if (!excludeEvents.includes(event)) {
            handler().catch(ConfigHelper.logger.info);
        }
    }
}
