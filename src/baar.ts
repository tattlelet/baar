import Bar from "./components/Bar";
import { forMonitors } from "./util/monitor";
import { Timer } from "./util/timer";

export class Baar {
    public static async init(): Promise<void> {
        const initTimer = new Timer("Baar initialization");

        try {
            await forMonitors(Bar);
        }
        finally {
            initTimer.end()
        }
    }
}