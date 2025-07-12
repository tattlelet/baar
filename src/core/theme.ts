import { Gio, readFileAsync, writeFileAsync, execAsync, monitorFile } from "astal";
import { App } from "astal/gtk3";
import { Measured } from "./timer";
import { ConfigHelper } from "./config/common";
import { ConfigManager } from "./configmanager";
import { toCss } from "./config/kvconfig";

import { Logger } from "./log";
import { wrapIO, Result, Ok, Err, Resultify } from "./matcher/base";
import { LockedRunner } from "./async/base";
import { Optional } from "./matcher/optional";

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
        return Promise.all(
            this.scssPaths
                .map(path => readFileAsync(path))
                .map(promise =>
                    Resultify.promise(promise).then(filled =>
                        Optional.from(
                            filled
                                .or(err => {
                                    ThemeManager.logger.except("Could not read scss file", err);
                                    return new Err("");
                                })
                                .collect()
                        )
                    )
                )
        ).then(filled => filled.map(optionalS => optionalS.getOr("")));
    }

    private async finalSCSS(): Promise<string> {
        const scssImports = [`@import '${this.variablesPath}';`];
        return this.allSCSS().then(filled => [`${scssImports.join("\n")}`, ...filled].join("\n"));
    }

    private async writeCombineSCSS(): Promise<void> {
        return this.finalSCSS().then(filled =>
            Resultify.promise(writeFileAsync(this.combinedSCSSPath, filled)).then(filled =>
                filled
                    .or(err => {
                        ThemeManager.logger.except("Could not write combined scss", err);
                        return Err.of(undefined);
                    })
                    .apply(() => Ok.of(undefined))
                    .collect()
            )
        );
    }

    private async saveVariables(): Promise<void> {
        return ConfigManager.instace()
            .config.getOrLoad()
            .then(filled =>
                Resultify.promise(writeFileAsync(this.variablesPath, toCss(filled))).then(fileWritten =>
                    fileWritten
                        .or(err => {
                            ThemeManager.logger.except("Could not write variables scss", err);
                            return Err.of(undefined);
                        })
                        .collect()
                )
            );
    }

    private async rebuildCss(): Promise<void> {
        return Resultify.promise(execAsync(`sass --no-source-map ${this.combinedSCSSPath} ${this.endCSSPath}`)).then(
            filled =>
                filled
                    .or(err => {
                        ThemeManager.logger.except("Unable to rebuild final css", err);
                        return Err.of(undefined);
                    })
                    .apply(() => Ok.of(undefined))
                    .collect()
        );
    }

    private async loadStyle(): Promise<void> {
        ThemeManager.logger.info("Starting css load");
        return this.saveVariables()
            .then(() => this.writeCombineSCSS())
            .then(() => this.rebuildCss())
            .then(() => {
                App.apply_css(this.endCSSPath, true);
                ThemeManager.logger.info("Config loaded successfully");
                this.notify();
            });
    }

    public async notify(): Promise<void> {
        while (this.onCssLoadOnceStack.length > 0) {
            this.onCssLoadOnceStack.pop()!();
        }
    }

    @Measured(ThemeManager.logger.debug)
    public async syncLoadStyle(): Promise<Result<void, unknown>> {
        return this.reloader.sync(this.loadStyle.bind(this)).then(filled =>
            filled.mapResult(Ok.of, e => {
                ThemeManager.logger.except("Unable to load theme", e);
                return new Err(e);
            })
        );
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
