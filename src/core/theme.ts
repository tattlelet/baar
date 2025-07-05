import { Gio, readFileAsync, writeFileAsync, execAsync, monitorFile } from "astal";
import { App } from "astal/gtk3";
import { Measured } from "./timer";
import { ConfigHelper } from "./config/common";
import { ConfigManager } from "./configmanager";
import { toCss } from "./config/kvconfig";

export class ThemeManager {
    private static logger = Logger.get(this);
    private static INSTANCE = new ThemeManager();

    private readonly reloader = new LockedRunner();

    private readonly onCssLoadOnceStack: (() => Promise<void>)[] = [];

    public static instace(): ThemeManager {
        return this.INSTANCE;
    }

    private constructor(
        private readonly scssPaths: Array<string> = Array.of(`${SRC_DIR}/src/style/modules.scss`),
        private readonly variablesPath: string = `${TMP}/variables.scss`,
        private readonly combinedSCSSPath: string = `${TMP}/combined.scss`,
        private readonly endCSSPath: string = `${TMP}/baar.css`,
        private monitors?: Gio.FileMonitor[]
    ) {}

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

    private async saveVariables(): Promise<Result<Void, unknown>> {
        return wrapIO(
            ThemeManager.logger,
            writeFileAsync(this.variablesPath, toCss(await ConfigManager.instace().config.getOrLoad())),
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

    private async loadStyle(): Promise<void> {
        ThemeManager.logger.info("Starting css load");
        const savedVariables = this.saveVariables();
        const combinedFiles = this.writeCombineSCSS();

        await savedVariables;
        await combinedFiles;
        (await this.rebuildCss()).match(
            _ => {
                App.apply_css(this.endCSSPath, true);
                ThemeManager.logger.info("Config loaded successfully");
                this.notify();
            },
            _ => _
        );
    }

    public async notify(): Promise<void> {
        while (this.onCssLoadOnceStack.length > 0) {
            this.onCssLoadOnceStack.pop()!();
        }
    }

    @Measured(ThemeManager.logger.debug)
    public async syncLoadStyle(): Promise<void> {
        return this.reloader.sync(this.loadStyle.bind(this));
    }

    public registerListener(): void {
        ConfigManager.instace().config.onLoadNofity(async () => {
            this.syncLoadStyle();
        });
    }

    public notifyOnceOnLoad(callback: () => Promise<void>): void {
        this.onCssLoadOnceStack.push(callback);
    }

    public startMonitors(): void {
        this.monitors =
            this.monitors ??
            this.scssPaths.map(path =>
                monitorFile(path, (file: string, event: Gio.FileMonitorEvent): void =>
                    ConfigHelper.defaultHandler(this.syncLoadStyle.bind(this), file, event)
                )
            );
    }
}
