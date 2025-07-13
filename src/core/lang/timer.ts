import GLib from "gi://GLib";

export class Timer {
    private readonly startTime: number;
    private readonly now: () => number;
    private readonly unit: string = "µs";

    constructor(now: () => number = GLib.get_monotonic_time) {
        this.now = now;
        this.startTime = this.now();
    }

    public elapsed(): number {
        return this.now() - this.startTime;
    }

    public fmtElapsed(): string {
        return `${this.elapsed()}${this.unit}`;
    }
}

export function Measured<T>(logF: (...args: any[]) => void) {
    return function (t: T, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const timer = new Timer();

            // Finally is not used to avoid logging twice for asyncs
            try {
                const result = originalMethod.apply(this, args);

                if (result && typeof result.then === "function" && typeof result.finally === "function") {
                    // Async inference
                    return result.finally(() => {
                        logF(`⏱️  ${propertyKey} elapsed ${timer.fmtElapsed()}`);
                    });
                }

                // Sync inference
                logF(`⏱️  ${propertyKey} elapsed ${timer.fmtElapsed()}`);
                return result;
            } catch (e) {
                logF(`⏱️  ${propertyKey} elapsed ${timer.fmtElapsed()}`);
                throw e;
            }
        };

        return descriptor;
    };
}
