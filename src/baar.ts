import Bar from "./components/bar";
import CalendarWindow from "./components/calendar";
import { Logger } from "./core/log";
import { MonitorManager } from "./core/monitor";
import { ConfigSetup, ThemeManager } from "./core/theme";
import { Timer } from "./core/timer";

export class Baar {
    private static logger: Logger = Logger.get(Baar);

    public static async init(): Promise<void> {
        const timer = new Timer();
        Baar.logger.info("Starting Baar");

        try {
            ConfigSetup.run();
            Baar.logger.debug(`ConfigSetup ellapsed ${timer.fmtElapsed()}`);
            const themeManager = ThemeManager.instace();
            const configLoaded = themeManager.syncLoadStyle();
            themeManager.startMonitors();

            await configLoaded;
            Baar.logger.debug(`Theme initialization ellapsed ${timer.fmtElapsed()}`);

            const monitorManager = MonitorManager.instance();
            await monitorManager.applyOnAllMononitor(Bar);
            Baar.logger.debug(`Bars registration ellapsed ${timer.fmtElapsed()}`);

            monitorManager.registerEvents(Bar);
            Baar.logger.debug(`Bar event monitoring registration ellapsed ${timer.fmtElapsed()}`);

            await (async () => await CalendarWindow())();
        } catch (err: unknown) {
            Baar.logger.error("I have no clue what happened", err);
        } finally {
            Baar.logger.info(`Baar initialization ellapsed ${timer.fmtElapsed()}`);
        }
    }
}
