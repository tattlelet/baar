import { Gio, readFileAsync, writeFileAsync, execAsync, monitorFile, GLib } from "astal";
import { App } from "astal/gtk3";
import { Timer } from "./timer";
import { ConfigHelper } from "./config/common";
import { KVConfig, KVConfigParser, toCss } from "./config/kvconfig";
import { readConfigFile } from "./config/base";
import { SymbolConfig, SymbolConfigParser } from "./config/symbolconfig";

export class ThemeManager {
    private static logger = Logger.get(ThemeManager);
    private static INSTANCE = new ThemeManager();

    // Todo: remove atomic, we do implace updates
    private currentConfig = new Atomic<Readonly<KVConfig> | undefined>(undefined);
    private currentSymbols: Readonly<SymbolConfig> | undefined;
    private readonly reloader = new LockedRunner();
    private readonly watchPaths: string[];

    // Todo: Add custom title trimmer file
    // Todo: decouple themem and config and send a signal to theme to be reloaded on config change
    private constructor(
        private readonly configPath = CONFIG_FILE,
        private readonly symbolsPath = `${GLib.get_user_config_dir()}/baar/symbols`,
        private readonly scssPaths: Array<string> = Array.of(`${SRC_DIR}/src/style/modules.scss`),
        private readonly variablesPath: string = `${TMP}/variables.scss`,
        private readonly combinedSCSSPath: string = `${TMP}/combined.scss`,
        private readonly endCSSPath: string = `${TMP}/baar.css`,
        private monitors?: Gio.FileMonitor[]
    ) {
        this.watchPaths = [configPath, symbolsPath, ...scssPaths];
    }

    public async getConfig(): Promise<Result<Readonly<KVConfig>, undefined>> {
        const config = this.currentConfig.get();
        if (config === undefined) {
            return new Err(config);
        }
        return new Ok(config);
    }

    public getSymbols(): Readonly<SymbolConfig> | undefined {
        return this.currentSymbols;
    }

    private async setConfig(config: Readonly<KVConfig>): Promise<void> {
        this.currentConfig.set(config);
    }

    private async setSymbols(config: Readonly<SymbolConfig>): Promise<void> {
        this.currentSymbols = config;
    }

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
                v => v,
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

    private async saveVariables(config: Promise<Readonly<KVConfig>>): Promise<Result<Void, unknown>> {
        return wrapIO(
            ThemeManager.logger,
            writeFileAsync(this.variablesPath, toCss(await config)),
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
            _ => new Ok<Void>(undefined),
            e => new Err<unknown>(e)
        );
    }

    public async apply(): Promise<void> {
        App.apply_css(this.endCSSPath, true), ThemeManager.logger.info("Config loaded");
    }

    private async loadStyle(): Promise<void> {
        ThemeManager.logger.info("Starting config load");
        const config = readConfigFile(KVConfig, new KVConfigParser(), this.configPath);
        const symbols = readConfigFile(SymbolConfig, new SymbolConfigParser(), this.symbolsPath);
        const savedVariables = this.saveVariables(config);

        // // Probably dont have to do this all the time 😊
        const combinedFiles = this.writeCombineSCSS();

        await savedVariables;
        await combinedFiles;

        const doneConfig = await config;
        const doneSymbols = await symbols;
        (await this.rebuildCss()).match(
            _ => {
                this.setConfig(doneConfig);
                this.setSymbols(doneSymbols);
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
            ThemeManager.logger.info(`Config loading ellapsed ${timer.fmtElapsed()}`);
        }
    }

    public startMonitors(): void {
        this.monitors =
            this.monitors ??
            this.watchPaths.map(path =>
                monitorFile(path, (file: string, event: Gio.FileMonitorEvent): void =>
                    ConfigHelper.defaultHandler(this.syncLoadStyle.bind(this), file, event)
                )
            );
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
