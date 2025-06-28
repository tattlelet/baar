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
