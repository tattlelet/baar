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
