import Bar from "./components/Bar";
import { ThemeManager } from "./util/config";
import { Logger } from "./util/log";
import { forMonitors } from "./util/monitor";
import { Timer } from "./util/timer";

export class Baar {
    private static logger: Logger = Logger.get(Baar);

    public static async init(): Promise<void> {
        const initTimer = new Timer("Baar initialization");
        Baar.logger.info("Starting Baar");
        try {
            const themeManager = ThemeManager.instace();
            await themeManager.syncLoadStyle();
            themeManager.startMonitors();

            await forMonitors(Bar);

            // todo: monitor connect disconnect
            // https://aylur.github.io/astal/guide/typescript/faq
        } catch (err: unknown) {
            Baar.logger.error("I have no clue what happened", err);
        } finally {
            initTimer.end();
        }
    }
}
