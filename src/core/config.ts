import { Gio, readFileAsync } from "astal";
import { Logger } from "./log";
import { delimiterSplit } from "./string";
import { RegexBuilder } from "./regex";

export type Readonly<T> = {
    readonly [K in keyof T]: T[K];
};

export class ConfigParser {
    private static logger = Logger.get(ConfigParser);
    private static configLine: RegExp = RegexBuilder.new()
        .orRegexes(
            /(?<emptyLine>\s*)/,
            /(?<comment>#.+)/,
            /(?<paramKey>[a-zA-Z][a-zA-Z0-9-.]+[a-zA-Z0-9]) +(?<paramValue>[# a-zA-Z0-9-.]+[a-zA-Z0-9])/
        )
        .anchor()
        .build();

    public async parse(content: string): Promise<Readonly<Partial<Config>>> {
        const configMap: { [key: string]: string } = {};
        let i = 0;
        for (const line of delimiterSplit(content, "\n")) {
            // this is okay because we always say the line number as +1
            ++i;
            const match = line.match(ConfigParser.configLine);
            if (match === null || match.groups === undefined) {
                ConfigParser.logger.warn(
                    `Skipping line ${i + 1}: '[${line}]' for config doesnt match pattern ${ConfigParser.configLine}.`
                );
                continue;
            }

            if (match.groups.emptyLine !== undefined || match.groups.comment !== undefined) {
                continue;
            }

            configMap[match.groups.paramKey] = match.groups.paramValue;
        }
        ConfigParser.logger.debug("Partial config parsed:", configMap);
        return Object.freeze(configMap);
    }
}

export class Config {
    private static logger = Logger.get(Config);

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

    private constructor(data: Partial<Config>) {
        Object.keys(data).forEach(key => {
            if (key in this) {
                const objKey = (this as any)[key];
                const value = data[key as keyof Config] as string | undefined;
                (this as any)[key] = this.parseType(objKey, value);
            }
        });
        Object.freeze(this);
    }

    private static create(data?: Partial<Config>): Readonly<Config> {
        const config = new Config(data ?? {}) as Readonly<Config>;
        Config.logger.debug("End config:", config);
        return config;
    }

    public static async readConfigFile(path: string): Promise<Readonly<Config>> {
        try {
            const configContent = (
                await wrapIO(Config.logger, readFileAsync(path), "Failed to read config file")
            ).match(
                v => v || "",
                _ => ""
            );

            const partialConfig = new ConfigParser().parse(configContent);
            const config = this.create(await partialConfig);
            return config;
        } catch (err: unknown) {
            Config.logger.warn("No config was loaded: ", err);
            return this.create();
        }
    }

    public static defaultHandler(
        handler: (...args: any) => any,
        file: string,
        event: Gio.FileMonitorEvent,
        excludeEvents: Gio.FileMonitorEvent[] = []
    ): void {
        Config.logger.info(file, event);
        if (!excludeEvents.includes(event)) {
            handler().catch(Config.logger.info);
        }
    }
}

export function toCss<T extends Readonly<Config>>(config: T): string {
    return Object.getOwnPropertyNames(config)
        .map(key => `\$${key}: ${(config as any)[key]};`)
        .join("\n");
}

