import GLib from 'gi://GLib';

export class Timer {
    private readonly startTime: number;
    private readonly label: string;
    private readonly now: () => number;

    constructor(label: string, now: () => number = GLib.get_monotonic_time) {
        this.label = label;
        this.now = now;
        this.startTime = this.now();
    }

    /**
     * Stops the timer and logs the elapsed time with the configured label
     * Returns the elapsed time in milliseconds for further processing
     */
    public end(): number {
        const elapsed = (this.now() - this.startTime);
        console.log(`${this.label} ellpased ${elapsed.toFixed(1)}µs`);
        return elapsed;
    }
    
    /**
     * Retrieves the current elapsed time without stopping the timer
     * Useful for intermediate measurements during long-running operations
     */
    public elapsed(): number {
        return (this.now() - this.startTime);
    }

    /**
     * Wraps an async function with automatic performance timing
     * Logs execution time regardless of success or failure
     *
     * @param label - Description of the operation being measured
     * @param fn - Async function to measure
     */
    public static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        const timer = new Timer(label);
        try {
            return await fn();
        }
        finally {
            timer.end();
        }
    }

    /**
     * Wraps a synchronous function with automatic performance timing
     * Logs execution time regardless of success or failure
     *
     * @param label - Description of the operation being measured
     * @param fn - Synchronous function to measure
     */
    public static measureSync<T>(label: string, fn: () => T): T {
        const timer = new Timer(label);
        try {
            return fn();
        }
        finally {
            timer.end();
        }
    }
}
