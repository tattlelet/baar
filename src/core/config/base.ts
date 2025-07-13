import { Logger } from "../lang/log";
import { Optional } from "../matcher/optional";
import { ConfigHelper } from "./common";

export type Readonly<T> = {
    readonly [K in keyof T]: T[K];
};

export interface ConfigAggregator<T, U> {
    aggregate(results: T[]): U;
}

export interface ConfigRecordTransformer<R, T> {
    transform(configRecord: R): Optional<T>;
}

export interface ConfigRecordParser<R> {
    parse(line: string): Optional<R>;
}

export abstract class ConfigParser<R, T, U> {
    constructor(
        readonly logger: Logger,
        readonly configRecordParser: ConfigRecordParser<R>,
        readonly configRecordTransformer: ConfigRecordTransformer<R, T>,
        readonly configAggregator: ConfigAggregator<T, U>
    ) {}

    public async parse(content: Optional<string>): Promise<U> {
        const results: T[] = [];
        if (content.isSome()) {
            content
                .unwrap()
                .split("\n")
                .forEach((line, lineNumber) => {
                    const transformedRecord = this.configRecordParser
                        .parse(line)
                        .flatMap(record =>
                            this.configRecordTransformer
                                .transform(record)
                                .onNone(() =>
                                    this.logger.debug(
                                        `Skipping line ${lineNumber + 1}: '[${line}]' for config. Failed parsing object.`
                                    )
                                )
                        )
                        .onNone(() =>
                            this.logger.debug(
                                `Skipping line ${lineNumber + 1}: '[${line}]' for config. Failed matching rules`
                            )
                        );

                    if (transformedRecord.isSome()) {
                        results.push(transformedRecord.unwrap());
                    }
                });
        }
        return this.configAggregator.aggregate(results);
    }
}

export async function readConfigFile<C, U>(
    that: new (data: U) => C,
    configParser: ConfigParser<any, any, U>,
    path: string
): Promise<C> {
    return ConfigHelper.readConfigFile(path)
        .then(content => configParser.parse(content))
        .then(partialConfig => new that(partialConfig));
}
