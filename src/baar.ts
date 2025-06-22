import Bar from "./components/bar";
import Calendar from "./components/calendar";
import { ConfigSetup, ThemeManager } from "./core/config";
import { Logger } from "./core/log";
import { MonitorManager } from "./core/monitor";
import { Timer } from "./core/timer";

export class Baar {
    private static logger: Logger = Logger.get(Baar);

    public static async init(): Promise<void> {
        const initTimer = new Timer();
        Baar.logger.info("Starting Baar");

        try {
            ConfigSetup.run();
            initTimer.log((ellapsed, unit) => Baar.logger.debug(`ConfigSetup ellapsed ${ellapsed}${unit}`));
            const themeManager = ThemeManager.instace();
            const configLoaded = themeManager.syncLoadStyle();
            themeManager.startMonitors();

            await configLoaded;
            initTimer.log((ellapsed, unit) => Baar.logger.debug(`Theme initialization ellapsed ${ellapsed}${unit}`));

            const monitorManager = MonitorManager.instance();
            await monitorManager.applyOnAllMononitor(Bar);
            initTimer.log((ellapsed, unit) => Baar.logger.debug(`Bars registration ellapsed ${ellapsed}${unit}`));

            monitorManager.registerEvents(Bar);
            initTimer.log((ellapsed, unit) =>
                Baar.logger.debug(`Bar event monitoring registration ellapsed ${ellapsed}${unit}`)
            );

            await (async () => await Calendar())();
        } catch (err: unknown) {
            Baar.logger.error("I have no clue what happened", err);
        } finally {
            initTimer.log((ellapsed, unit) => Baar.logger.info(`Baar initialization ellapsed ${ellapsed}${unit}`));
        }
    }
}
