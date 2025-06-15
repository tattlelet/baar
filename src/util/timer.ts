import GLib from "gi://GLib";

export class Timer {
    private readonly startTime: number;
    private readonly now: () => number;

    constructor(now: () => number = GLib.get_monotonic_time) {
        this.now = now;
        this.startTime = this.now();
    }

    public elapsed(): number {
        return this.now() - this.startTime;
    }

    public log(f: (elapsed: number, unit: string) => void): number {
        const elapsed = this.elapsed();
        f(elapsed, "µs");
        return elapsed;
    }
}
