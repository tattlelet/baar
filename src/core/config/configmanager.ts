import { GLib, Gio } from "astal";
import { LockedRunner } from "../async/base";
import { FileManager } from "../files";
import { allOf, toIterator } from "../lang/iter";
import { Logger } from "../lang/log";
import { Measured } from "../lang/timer";
import { Err, Ok, Result } from "../matcher/base";
import { Resultify } from "../matcher/helpers";
import { Optional } from "../matcher/optional";
import { readConfigFile } from "./base";
import { ConfigHelper } from "./common";
import { KVConfig, KVConfigParser } from "./kvconfig";
import { Replacer, ReplacerConfig, ReplacerConfigParser } from "./replacer";
import { SymbolConfig, SymbolConfigParser, SymbolTranslator } from "./symbolconfig";

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

    constructor(
        private readonly path: string,
        configLoadF: () => Promise<T>
    ) {
        super(configLoadF);
    }

    @Measured(LockedConfigLoader.logger.debug)
    public async syncLoad(): Promise<Result<void, unknown>> {
        return this.reloader.sync(this.load.bind(this)).then(filled =>
            filled.mapResult(
                () => {
                    LockedConfigLoader.logger.info(`Loaded config: ${this.path}`);
                    return Ok.of(undefined);
                },
                e => {
                    LockedConfigLoader.logger.error(`Unable to load config: ${this.path}`, e);
                    return Err.of(e);
                }
            )
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

    private readonly fileManager: FileManager;

    public static instace(): ConfigManager {
        return this.INSTANCE;
    }

    private constructor(
        private readonly configPath = CONFIG_FILE,
        private readonly symbolsPath = `${GLib.get_user_config_dir()}/baar/symbols`,
        private readonly replacerPath = `${GLib.get_user_config_dir()}/baar/replacer`,
        private monitors: Optional<Record<string, Gio.FileMonitor>> = Optional.none()
    ) {
        this.config = new LockedConfigLoader(
            this.configPath,
            (readConfigFile<KVConfig, Readonly<Record<string, string>>>).bind(
                null,
                KVConfig,
                new KVConfigParser(),
                this.configPath
            )
        );

        this.symbols = new LockedConfigLoader(
            this.symbolsPath,
            (readConfigFile<SymbolConfig, SymbolTranslator[]>).bind(
                null,
                SymbolConfig,
                new SymbolConfigParser(),
                this.symbolsPath
            )
        );

        this.replacer = new LockedConfigLoader(
            this.replacerPath,
            (readConfigFile<ReplacerConfig, Replacer[]>).bind(
                null,
                ReplacerConfig,
                new ReplacerConfigParser(),
                this.replacerPath
            )
        );

        this.fileManager = new FileManager([
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
        ]);
    }

    public async startMonitors(): Promise<boolean> {
        return this.fileManager.startMonitors().then(monitors => {
            Object.keys(monitors)
                .filter(key => monitors[key].isNone())
                .forEach(key => ConfigManager.logger.warn(`Monitor for [${key}] failed to setup`));

            this.monitors = Optional.some(
                Object.fromEntries(Object.entries(monitors).map(([path, monitor]) => [path, monitor.unwrap()]))
            );

            ConfigManager.logger.info("Config monitors started");
            return true;
        });
    }

    @Measured(ConfigManager.logger.debug)
    public async load(): Promise<boolean> {
        return Promise.all([this.config.syncLoad(), this.symbols.syncLoad(), this.replacer.syncLoad()]).then(filled =>
            allOf(
                toIterator(
                    filled.map(result =>
                        result.match(
                            () => true,
                            () => false
                        )
                    )
                ),
                predicate => predicate
            )
        );
    }
}

export class ConfigSetup {
    private static logger = Logger.get(ConfigSetup);

    @Measured(ConfigSetup.logger.debug)
    public static async run(): Promise<boolean> {
        return Resultify.from(() => this.ensureDirectory(TMP))().match(
            () => {
                ConfigSetup.logger.info("Config setup done");
                return true;
            },
            err => {
                ConfigSetup.logger.error("Unable to setup base paths", err);
                return false;
            }
        );
    }

    private static ensureDirectory(path: string): void {
        ConfigSetup.logger.debug(`CONFIG_DIR - ${CONFIG_DIR}`);
        ConfigSetup.logger.debug(`CONFIG_FILE - ${CONFIG_FILE}`);
        ConfigSetup.logger.debug(`TMP - ${TMP}`);
        ConfigSetup.logger.debug(`USER - ${USER}`);
        ConfigSetup.logger.debug(`SRC_DIR - ${SRC_DIR}`);

        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            if (Gio.File.new_for_path(path).make_directory_with_parents(null)) {
                ConfigSetup.logger.debug(`Path ${path} created`);
            }
        }
    }
}
