import { Logger } from "../log";
import { Result } from "../matcher/base";
import { ConfigHelper } from "./common";

export type Readonly<T> = {
    readonly [K in keyof T]: T[K];
};

export interface ConfigAggregator<T, U> {
    aggregate(results: T[]): U;
}

export interface ConfigRecordTransformer<R, T> {
    transform(configRecord: R): Result<T, undefined>;
}

export interface ConfigRecordParser<R> {
    parse(line: string): Result<R, undefined>;
}

export abstract class ConfigParser<R, T, U> {
    constructor(
        readonly logger: Logger,
        readonly configRecordParser: ConfigRecordParser<R>,
        readonly configRecordTransformer: ConfigRecordTransformer<R, T>,
        readonly configAggregator: ConfigAggregator<T, U>
    ) {}

    public async parse(content?: string): Promise<U> {
        const results: T[] = [];
        content?.split("\n").forEach((line, lineNumber) => {
            const result = this.configRecordParser.parse(line).match(
                record =>
                    this.configRecordTransformer.transform(record).match(
                        result => result,
                        noResult => {
                            this.logger.warn(
                                `Skipping line ${lineNumber + 1}: '[${line}]' for config. Failed parsing object.`
                            );
                            return undefined;
                        }
                    ),
                noRecord => {
                    this.logger.warn(`Skipping line ${lineNumber + 1}: '[${line}]' for config. Failed matching rules`);
                    return undefined;
                }
            );

            if (result !== undefined) {
                results.push(result);
            }
        });
        return this.configAggregator.aggregate(results);
    }
}

export async function readConfigFile<C, U>(
    that: new (data: U) => C,
    configParser: ConfigParser<any, any, U>,
    path: string
): Promise<C> {
    const content = ConfigHelper.readConfigFile(path);
    const partialConfig = configParser.parse((await content) || "");
    return new that(await partialConfig);
}
