import { execAsync, Gio, monitorFile, readFileAsync, writeFileAsync } from "astal";
import { App } from "astal/gtk3";
import { Logger } from "./log";

export class ThemeManager {
    private static logger = Logger.get(ThemeManager);
    private static INSTANCE = new ThemeManager();

    private constructor(
        private readonly configPath = `${CONFIG_DIR}/config.json`,
        private readonly scssPaths: Array<string> = Array.of(`${SRC_DIR}/src/style/modules.scss`),
        private readonly variablesPath: string = `${TMP}/variables.scss`,
        private readonly combinedSCSSPath: string = `${TMP}/_main.scss`,
        private readonly endCSSPath: string = `${TMP}/baar.css`,
        private lastPromise: Promise<void> = Promise.resolve(),
        private monitors?: Gio.FileMonitor[]
    ) {}

    public static instace(): ThemeManager {
        return this.INSTANCE;
    }

    private async allSCSS(): Promise<string[]> {
        const results = Promise.all(
            this.scssPaths
                .map(path => readFileAsync(path))
                .map(promise => wrapIO(ThemeManager.logger, promise, "Could not read scss file"))
        );

        return (await results).map(result =>
            result.match(
                v => v!,
                e => ""
            )
        );
    }

    private async finalSCSS(): Promise<string> {
        const scssImports = [`@import '${this.variablesPath}';`];
        return [`${scssImports.join("\n")}`, ...(await this.allSCSS())].join("\n");
    }

    private async writeCombineSCSS(): Promise<Result<Void, unknown>> {
        return wrapIO(
            ThemeManager.logger,
            writeFileAsync(this.combinedSCSSPath, await this.finalSCSS()),
            "Could not write combined scss"
        );
    }

    private async saveVariables(config: Promise<Readonly<Config>>): Promise<Result<Void, unknown>> {
        return wrapIO(
            ThemeManager.logger,
            writeFileAsync(this.variablesPath, (await config).toCSS()),
            "Could not write variables scss"
        );
    }

    private async rebuildCss(): Promise<Result<Void, unknown>> {
        return (
            await wrapIO(
                ThemeManager.logger,
                execAsync(`sass --no-source-map ${this.combinedSCSSPath} ${this.endCSSPath}`),
                "Unable to rebuild final css"
            )
        ).match<Result<Void, unknown>>(
            _ => new Ok<Void>(),
            e => new Err<unknown>(e)
        );
    }

    public async apply(): Promise<void> {
        App.apply_css(this.endCSSPath, true), ThemeManager.logger.info("Config loaded");
    }

    private async loadStyle(): Promise<void> {
        const config = Config.readConfigFile(this.configPath);
        const savedVariables = this.saveVariables(config);

        // // Probably dont have to do this all the time 😊
        const combinedFiles = this.writeCombineSCSS();

        await savedVariables;
        await combinedFiles;

        (await this.rebuildCss()).match(
            _ => {
                App.apply_css(this.endCSSPath, true);
                ThemeManager.logger.info("Config loaded");
            },
            _ => _
        );
    }

    public async syncLoadStyle(): Promise<void> {
        ThemeManager.logger.info("Starting config load");
        const result = this.lastPromise.then(_ => this.loadStyle());
        this.lastPromise = result.catch(ThemeManager.logger.info);
        return result;
    }

    public startMonitors(): void {
        this.monitors =
            this.monitors ??
            [this.configPath].map(path =>
                monitorFile(path, (file: string, event: Gio.FileMonitorEvent): void =>
                    Config.defaultHandler(this.syncLoadStyle.bind(this), file, event)
                )
            );
    }
}

type Readonly<T> = {
    readonly [K in keyof T]: T[K];
};

export class Config {
    private static logger = Logger.get(Config);

    public backgroundColor: string = "#000000";
    public foregroundColor: string = "#000000";

    private constructor(data: Partial<Config>) {
        Object.keys(data).forEach(key => {
            if (key in this) {
                (this as any)[key] = data[key as keyof Config];
            }
        });
        Object.freeze(this);
    }

    public toCSS(): string {
        return Object.getOwnPropertyNames(this)
            .map(key => `\$${key}: ${(this as any)[key]};`)
            .join("\n");
    }

    private static create(data?: Partial<Config>): Readonly<Config> {
        const config = new Config(data ?? {}) as Readonly<Config>;
        Config.logger.debug("Loaded config", config);
        return config;
    }

    public static async readConfigFile(path: string): Promise<Readonly<Config>> {
        try {
            const configContent = (
                await wrapIO(Config.logger, readFileAsync(path), "Failed to read config file")
            ).match(
                v => v!,
                e => {
                    throw e;
                }
            );

            const partialConfig = JSON.parse(configContent) as Partial<Config>;
            Config.logger.debug("Loaded+parsed", partialConfig);
            const config = this.create(partialConfig);
            return config;
        } catch (err: unknown) {
            Config.logger.warn("No config was loaded: ", err);
            return this.create();
        }
    }

    public static defaultHandler(
        handler: (...args: any) => Promise<any>,
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
