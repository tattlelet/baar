import Bar from "./components/bar";
import CalendarWindow from "./components/calendar";
import { promiseWithTimout } from "./core/async/base";
import { ConfigManager, ConfigSetup } from "./core/configmanager";
import { Logger } from "./core/log";
import { MonitorManager } from "./core/monitor";
import { ThemeManager } from "./core/theme";
import { Measured } from "./core/timer";
import { App } from "astal/gtk3";

export class Baar {
    private static logger: Logger = Logger.get(Baar);

    @Measured(Baar.logger.debug)
    public static async init(): Promise<void> {
        Baar.logger.info("Starting Baar");

        ConfigSetup.run();
        const configManager = ConfigManager.instace();
        configManager.startMonitors();

        const themeManager = ThemeManager.instace();
        themeManager.startMonitors();
        themeManager.registerListener();

        const configLoad = configManager.load();
        (await promiseWithTimout(1000 * 60 * 5, themeManager.notifyOnceOnLoad.bind(themeManager))).match(
            v => v,
            e => {
                Baar.logger.except("Unable to load theme, quitting", e);
                App.quit(1);
            }
        );
        await configLoad;

        const monitorManager = MonitorManager.instance();
        await monitorManager.applyOnAllMononitor(Bar);

        monitorManager.registerEvents(Bar);

        await (async () => await CalendarWindow())();
    }
}
