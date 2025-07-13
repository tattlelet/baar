import { App } from "astal/gtk3";
import Bar from "./components/bar";
import CalendarWindow from "./components/calendar";
import { Asyncify } from "./core/async/helper";
import { ConfigManager, ConfigSetup } from "./core/config/configmanager";
import { Logger } from "./core/lang/log";
import { Measured } from "./core/lang/timer";
import { Resultify } from "./core/matcher/helpers";
import { MonitorManager } from "./core/monitor";
import { ThemeManager } from "./core/theme";

// Todo: add top-level check
// Todo: abstract window management
export class Baar {
    private static logger: Logger = Logger.get(Baar);

    @Measured(Baar.logger.info)
    public static async init(): Promise<void> {
        Baar.logger.info("Starting Baar");

        ConfigSetup.run().then(filled => Baar.handleExit(filled, "Failed setting up config environment"));

        const configManager = ConfigManager.instace();
        configManager.startMonitors().then(filled => Baar.handleExit(filled, "Failed starting config monitors"));
        configManager.load().then(filled => Baar.handleExit(filled, "Failed to load config files or defaults"));

        const themeManager = ThemeManager.instace();
        themeManager.startMonitors();
        themeManager
            .registerListener()
            .then(filled => Baar.handleExit(filled, "Failed to register theme notification"));

        await themeManager.loaded(1000 * 60 * 5).then(filled => {
            if (filled.isErr()) {
                Baar.handleExit(false, "Timeout waiting for CSS loaded signal", filled.unwrapErr());
            }
        });

        const monitorManager = MonitorManager.instance();
        await monitorManager.applyOnAllMononitor(Bar).then(monitorLayerOptional => {
            if (monitorLayerOptional.isNone()) {
                Baar.handleExit(false, "Failed bootstrapping monitors");
            }
        });

        await Resultify.promise(Asyncify.from(CalendarWindow)()).then(filled => {
            if (filled.isErr()) {
                Baar.logger.warn("Failed creating Calendar Window", filled.unwrapErr());
            }
        });
    }

    // Todo: move this elsewhere
    public static async handleExit(
        predicate: boolean,
        message: string = "Failed loading core component, exiting",
        cause?: unknown
    ): Promise<void> {
        if (!predicate) {
            // Logging allows you to log undefined
            if (cause !== undefined) {
                Baar.logger.error(message, cause);
            } else {
                Baar.logger.error(message);
            }
            App.quit(1);
        }
    }
}
