import Bar from "./components/Bar";
import { ConfigSetup, ThemeManager } from "./util/config";
import { Logger } from "./util/log";
import { forMonitors } from "./util/monitor";
import { Timer } from "./util/timer";

export class Baar {
    private static logger: Logger = Logger.get(Baar);

    public static async init(): Promise<void> {
        const initTimer = new Timer();
        Baar.logger.info("Starting Baar");

        try {
            ConfigSetup.run();
            initTimer.log((ellapsed, unit) => Baar.logger.debug(`ConfigWatchdog ellapsed ${ellapsed}${unit}`));
            const themeManager = ThemeManager.instace();
            const configLoaded = themeManager.syncLoadStyle();
            themeManager.startMonitors();

            await configLoaded;
            initTimer.log((ellapsed, unit) => Baar.logger.debug(`Theme initialization ellapsed ${ellapsed}${unit}`));
            await forMonitors(Bar);

            // todo: monitor connect disconnect
            // https://aylur.github.io/astal/guide/typescript/faq
        } catch (err: unknown) {
            Baar.logger.error("I have no clue what happened", err);
        } finally {
            initTimer.log((ellapsed, unit) => Baar.logger.info(`Baar initialization ellapsed ${ellapsed}${unit}`));
        }
    }
}
