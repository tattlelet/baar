import { execAsync, Gio, readFileAsync, writeFileAsync } from "astal";
import { App } from "astal/gtk3";
import { createDeferred, LockedRunner } from "./async/base";
import { ConfigHelper } from "./config/common";
import { ConfigManager } from "./config/configmanager";
import { toCss } from "./config/kvconfig";
import { FileManager } from "./files";
import { Logger } from "./lang/log";
import { Measured } from "./lang/timer";
import { Err, Ok, Result } from "./matcher/base";
import { Resultify } from "./matcher/helpers";
import { Optional } from "./matcher/optional";

export class ThemeManager {
    private static logger = Logger.get(this);
    private static INSTANCE = new ThemeManager();

    private readonly reloader = new LockedRunner();

    private onCssLoadStack: (() => Promise<void>)[] = [];
    private readonly fileManager: FileManager;

    public static instace(): ThemeManager {
        return this.INSTANCE;
    }

    private constructor(
        private readonly scssPaths: Array<string> = Array.of(`${SRC_DIR}/src/style/modules.scss`),
        private readonly variablesPath: string = `${TMP}/variables.scss`,
        private readonly combinedSCSSPath: string = `${TMP}/combined.scss`,
        private readonly endCSSPath: string = `${TMP}/baar.css`,
        private monitors: Optional<Record<string, Gio.FileMonitor>> = Optional.none()
    ) {
        this.fileManager = new FileManager(
            this.scssPaths.map(path => {
                return {
                    path: path,
                    callback: (file, event) => ConfigHelper.defaultHandler(this.syncLoadStyle.bind(this), file, event),
                };
            })
        );
    }

    private async allSCSS(): Promise<string[]> {
        return Promise.all(
            this.scssPaths
                .map(path => readFileAsync(path))
                .map(promise =>
                    Resultify.promise(promise).then(fileReadResult =>
                        fileReadResult
                            .or(err => {
                                ThemeManager.logger.error("Could not read scss file", err);
                                return new Err("");
                            })
                            .collect()
                    )
                )
        );
    }

    private async finalSCSS(): Promise<string> {
        const scssImports = [`@import '${this.variablesPath}';`];
        return this.allSCSS().then(filled => [`${scssImports.join("\n")}`, ...filled].join("\n"));
    }

    private async writeCombineSCSS(): Promise<void> {
        return this.finalSCSS().then(finalSCSSContent =>
            Resultify.promise(writeFileAsync(this.combinedSCSSPath, finalSCSSContent)).then(fileWriteResult =>
                fileWriteResult.match(
                    () => undefined,
                    err => {
                        ThemeManager.logger.error("Could not write combined scss", err);
                        return undefined;
                    }
                )
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
                            ThemeManager.logger.error("Could not write variables scss", err);
                            return Err.of(undefined);
                        })
                        .collect()
                )
            );
    }

    private async rebuildCss(): Promise<void> {
        return Resultify.promise(execAsync(`sass --no-source-map ${this.combinedSCSSPath} ${this.endCSSPath}`)).then(
            filled =>
                filled.match(
                    () => undefined,
                    err => {
                        ThemeManager.logger.error("Unable to rebuild final css", err);
                        return undefined;
                    }
                )
        );
    }

    private async loadStyle(): Promise<void> {
        ThemeManager.logger.info("Starting css load");
        return this.saveVariables()
            .then(() => this.writeCombineSCSS())
            .then(() => this.rebuildCss())
            .then(() => {
                App.apply_css(this.endCSSPath, true);
                ThemeManager.logger.info("CSS loaded successfully");
                this.notify();
            });
    }

    public async notify(): Promise<void> {
        this.onCssLoadStack.forEach(callback => callback());
    }

    public async loaded(timeout: number): Promise<Result<void, unknown>> {
        const deferredResult = createDeferred<void>();
        if (deferredResult.isErr()) {
            return Err.of("Unable to setup Theme onLoad notification", deferredResult.unwrapErr());
        }

        const deferredPromise = deferredResult.unwrap();
        const resolver = async () => deferredPromise.resolve(undefined);

        const cssLoaded = deferredPromise.withTimeout(timeout).then(filled => {
            this.removeOnLoad(resolver);
            return filled.apply(() => {
                ThemeManager.logger.info("Theme onLoad notification received");
                return Ok.of(undefined);
            });
        });
        this.onLoad(resolver);
        return cssLoaded;
    }

    @Measured(ThemeManager.logger.debug)
    public async syncLoadStyle(): Promise<Result<void, unknown>> {
        return this.reloader.sync(this.loadStyle.bind(this)).then(filled =>
            filled.mapResult(
                () => {
                    ThemeManager.logger.info("Theme finished loading");
                    return Ok.of(undefined);
                },
                e => {
                    ThemeManager.logger.error("Unable to load theme", e);
                    return new Err(e);
                }
            )
        );
    }

    public async registerListener(): Promise<boolean> {
        ConfigManager.instace().config.onLoadNofity(async () => {
            this.syncLoadStyle();
        });
        ThemeManager.logger.debug("Registered config notification for theme reload");
        return true;
    }

    public onLoad(callback: () => Promise<void>): void {
        this.onCssLoadStack.push(callback);
    }

    public removeOnLoad(callback: () => Promise<void>): void {
        this.onCssLoadStack = this.onCssLoadStack.filter(registeredCallback => registeredCallback !== callback);
    }

    public async startMonitors(): Promise<boolean> {
        return this.fileManager.startMonitors().then(monitors => {
            Object.keys(monitors)
                .filter(key => monitors[key].isNone())
                .forEach(key => ThemeManager.logger.warn(`Monitor for [${key}] failed to setup`));

            this.monitors = Optional.some(
                Object.fromEntries(Object.entries(monitors).map(([path, monitor]) => [path, monitor.unwrap()]))
            );

            ThemeManager.logger.info("Theme monitors started");
            return true;
        });
    }
}
