import { execAsync, Gio, GLib, monitorFile, readFileAsync, writeFileAsync } from "astal";
import { App } from "astal/gtk3";
import { Logger } from "./log";
import { Timer } from "./timer";

export class ThemeManager {
    private static logger = Logger.get(ThemeManager);
    private static INSTANCE = new ThemeManager();

    private readonly reloader = new LockedRunner();

    private constructor(
        private readonly configPath = CONFIG_FILE,
        private readonly scssPaths: Array<string> = Array.of(`${SRC_DIR}/src/style/modules.scss`),
        private readonly variablesPath: string = `${TMP}/variables.scss`,
        private readonly combinedSCSSPath: string = `${TMP}/combined.scss`,
        private readonly endCSSPath: string = `${TMP}/baar.css`,
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
        ThemeManager.logger.info("Starting config load");
        const config = Config.readConfigFile(this.configPath);
        const savedVariables = this.saveVariables(config);

        // // Probably dont have to do this all the time 😊
        const combinedFiles = this.writeCombineSCSS();

        await savedVariables;
        await combinedFiles;

        (await this.rebuildCss()).match(
            _ => {
                App.apply_css(this.endCSSPath, true);
                ThemeManager.logger.info("Config loaded successfully");
            },
            _ => _
        );
    }

    public async syncLoadStyle(): Promise<void> {
        const timer = new Timer();
        try {
            await this.reloader.sync(this.loadStyle.bind(this));
        } finally {
            timer.log((ellapsed, unit) => ThemeManager.logger.info(`Config loading ellapsed ${ellapsed}${unit}`));
        }
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

export type Readonly<T> = {
    readonly [K in keyof T]: T[K];
};

export class ConfigParser {
    private static logger = Logger.get(ConfigParser);
    private static configLine: RegExp = new RegExp(
        [
            "^(",
            [
                "(?<emptyLine>\\s*)",
                "(?<paramKey>[a-zA-Z][a-zA-Z0-9-.]+[a-zA-Z0-9]) +(?<paramValue>[# a-zA-Z0-9-.]+[a-zA-Z0-9])",
                "(?<comment>#.+)",
            ].join("|"),
            ")$",
        ].join("")
    );

    public async parse(content: String): Promise<Readonly<Partial<Config>>> {
        const configMap: { [key: string]: string } = {};
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(ConfigParser.configLine);
            if (match === null || match.groups === undefined) {
                ConfigParser.logger.warn(
                    `Skipping line ${i + 1}: '[${lines[i]}]' for config doesnt match pattern ${ConfigParser.configLine}.`
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

    public backgroundColor: string = "#000000";
    public backgroundOpacity: string = "10";
    public foregroundColor: string = "#000000";
    public borderRadius: string = "0px";
    public borderMargin: string = "1px";
    public fontFamily: string = "DejaVuSansM Nerd Font";
    public fontSize: string = "14px";

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

export class ConfigSetup {
    private static logger = Logger.get(ConfigSetup);

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
