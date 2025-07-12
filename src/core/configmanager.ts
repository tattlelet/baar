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
import { Optional } from "./matcher/optional";

export abstract class ConfigLoader<T> {
    public abstract get(): Optional<T>;
    public abstract getOrLoad(): Promise<Optional<T>>;
    protected abstract set(t: Promise<Optional<T>>): Promise<void>;
    public abstract load(): Promise<void>;
    public abstract notify(t: Optional<T>): Promise<void>;
    public abstract onLoadNofity(callback: (config: Optional<T>) => Promise<void>): void;
}

export class DefaultConfigLoader<T> extends ConfigLoader<T> {
    protected listeners: ((config: Optional<T>) => Promise<void>)[] = [];
    private currentConfig: Optional<T> = Optional.none();

    constructor(private readonly configLoadF: () => Promise<T>) {
        super();
    }

    public get(): Optional<T> {
        return this.currentConfig;
    }

    public async getOrLoad(): Promise<Optional<T>> {
        const config = this.currentConfig;
        if (config.isSome()) {
            return config;
        }
        return this.load().then(((self: this) => self.currentConfig).bind(null, this));
    }

    protected async set(t: Promise<Optional<T>>): Promise<void> {
        return t.then(
            ((self: this, filled: Optional<T>) => {
                self.currentConfig = filled;
                self.notify(self.currentConfig);
            }).bind(null, this)
        );
    }

    public async notify(t: Optional<T>): Promise<void> {
        for (const listener of this.listeners) {
            listener(t);
        }
    }

    public async load(): Promise<void> {
        return this.set(this.configLoadF().then(Optional.some));
    }

    public onLoadNofity(callback: (config: Optional<T>) => Promise<void>): void {
        this.listeners.push(callback);
    }
}

export class LockedConfigLoader<T> extends DefaultConfigLoader<T> {
    private static logger = Logger.get(this);

    protected readonly reloader = new LockedRunner();

    @Measured(LockedConfigLoader.logger.debug)
    public async syncLoad(): Promise<Result<void, unknown>> {
        return this.reloader.sync(this.load.bind(this)).then(filled =>
            filled.mapResult(Ok.of, e => {
                LockedConfigLoader.logger.except("Unable to load config", e);
                return Err.of(e);
            })
        );
    }

    @Measured(LockedConfigLoader.logger.debug)
    public notify(t: Optional<T>): Promise<void> {
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
        return Promise.all([this.config.syncLoad(), this.symbols.syncLoad(), this.replacer.syncLoad()]).then();
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
