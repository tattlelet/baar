import { GLib, Gio, monitorFile } from "astal";
import { KVConfig, KVConfigParser } from "./config/kvconfig";
import { Replacer, ReplacerConfig, ReplacerConfigParser } from "./config/replacer";
import { SymbolConfig, SymbolConfigParser, SymbolTranslator } from "./config/symbolconfig";
import { ConfigHelper } from "./config/common";
import { readConfigFile } from "./config/base";
import { Measured } from "./timer";
import { MonitorWatcherProps } from "./files";

import { Logger } from "./log";
import { Result, Ok, Err } from "./matcher/base";
import { LockedRunner } from "./async/base";

export abstract class ConfigLoader<T> {
    public abstract get(): T | undefined;
    public abstract getOrLoad(): Promise<T>;
    public abstract set(t: T): Promise<void>;
    public abstract load(): Promise<void>;
    public abstract notify(t: T): Promise<void>;
    public abstract onLoadNofity(callback: (config: T) => Promise<void>): void;
}

export class DefaultConfigLoader<T> extends ConfigLoader<T> {
    protected listeners: ((config: T) => Promise<void>)[] = [];
    private currentConfig: T | undefined;

    constructor(private readonly configLoadF: () => Promise<T>) {
        super();
    }

    public get(): T | undefined {
        return this.currentConfig;
    }

    public async getOrLoad(): Promise<T> {
        const config = this.currentConfig;
        if (config !== undefined) {
            return config;
        }
        await this.load();
        return this.currentConfig!;
    }

    public async set(t: T): Promise<void> {
        this.currentConfig = t;
        this.notify(this.currentConfig);
    }

    public async notify(t: T): Promise<void> {
        for (const listener of this.listeners) {
            listener(t);
        }
    }

    public async load(): Promise<void> {
        this.set(await this.configLoadF());
    }

    public onLoadNofity(callback: (config: T) => Promise<void>): void {
        this.listeners.push(callback);
    }
}

export class LockedConfigLoader<T> extends DefaultConfigLoader<T> {
    private static logger = Logger.get(this);

    protected readonly reloader = new LockedRunner();

    @Measured(LockedConfigLoader.logger.debug)
    public async syncLoad(): Promise<Result<void, unknown>> {
        return this.reloader.sync(this.load.bind(this)).then(filled => filled.mapResult(
            _ => new Ok(_),
            e => {
                LockedConfigLoader.logger.except("Unable to load config", e);
                return new Err(e);
            }
        ));
    }

    @Measured(LockedConfigLoader.logger.debug)
    public notify(t: T): Promise<void> {
        return super.notify(t);
    }
}

export class ConfigManager {
    private static logger = Logger.get(this);
    private static INSTANCE = new ConfigManager();

    readonly config: LockedConfigLoader<KVConfig>;
    readonly symbols: LockedConfigLoader<SymbolConfig>;
    readonly replacer: LockedConfigLoader<ReplacerConfig>;

    private readonly watchersProps: MonitorWatcherProps[];

    public static instace(): ConfigManager {
        return this.INSTANCE;
    }

    private constructor(
        private readonly configPath = CONFIG_FILE,
        private readonly symbolsPath = `${GLib.get_user_config_dir()}/baar/symbols`,
        private readonly replacerPath = `${GLib.get_user_config_dir()}/baar/replacer`,
        private monitors?: Gio.FileMonitor[]
    ) {
        this.config = new LockedConfigLoader(
            (readConfigFile<KVConfig, Readonly<Record<string, string>>>).bind(
                null,
                KVConfig,
                new KVConfigParser(),
                this.configPath
            )
        );

        this.symbols = new LockedConfigLoader(
            (readConfigFile<SymbolConfig, SymbolTranslator[]>).bind(
                null,
                SymbolConfig,
                new SymbolConfigParser(),
                this.symbolsPath
            )
        );

        this.replacer = new LockedConfigLoader(
            (readConfigFile<ReplacerConfig, Replacer[]>).bind(
                null,
                ReplacerConfig,
                new ReplacerConfigParser(),
                this.replacerPath
            )
        );

        this.watchersProps = [
            {
                path: configPath,
                callback: (file, event) =>
                    ConfigHelper.defaultHandler(this.config.syncLoad.bind(this.config), file, event),
            },
            {
                path: symbolsPath,
                callback: (file, event) =>
                    ConfigHelper.defaultHandler(this.symbols.syncLoad.bind(this.symbols), file, event),
            },
            {
                path: replacerPath,
                callback: (file, event) =>
                    ConfigHelper.defaultHandler(this.replacer.syncLoad.bind(this.replacer), file, event),
            },
        ];
    }

    public startMonitors(): void {
        this.monitors =
            this.monitors ??
            this.watchersProps.map(watcherProps => monitorFile(watcherProps.path, watcherProps.callback));
    }

    @Measured(ConfigManager.logger.debug)
    public async load(): Promise<void> {
        await Promise.all([this.config.syncLoad(), this.symbols.syncLoad(), this.replacer.syncLoad()]);
    }
}

export class ConfigSetup {
    private static logger = Logger.get(ConfigSetup);

    @Measured(ConfigSetup.logger.debug)
    public static run(): void {
        this.logger.debug(`CONFIG_DIR - ${CONFIG_DIR}`);
        this.logger.debug(`CONFIG_FILE - ${CONFIG_FILE}`);
        this.logger.debug(`TMP - ${TMP}`);
        this.logger.debug(`USER - ${USER}`);
        this.logger.debug(`SRC_DIR - ${SRC_DIR}`);
        this.ensureDirectory(TMP);
    }

    private static ensureDirectory(path: string): void {
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            if (Gio.File.new_for_path(path).make_directory_with_parents(null)) {
                this.logger.debug(`Path ${path} created`);
            }
        }
    }
}
