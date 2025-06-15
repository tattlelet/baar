import { assert } from "console";
import { Logger } from "./log";

const logger: Logger = Logger.get(this);

/*
 * Provides synchronous executions of this.sync(f) with timeout
 */
export class LockedRunner {
    private static logger = Logger.get(LockedRunner);

    private lock: Promise<any>;

    constructor(private timeout: number = 0) {
        this.lock = this.newLock();
    }

    private newLock(): Promise<any> {
        return Promise.resolve();
    }

    public async sync<T extends any[], R extends any>(f: (...args: T) => Promise<R>, ...args: T): Promise<R> {
        const fToRun = this.timeout > 0 ? withTimeout(this.timeout, f) : f;
        const result = this.lock.then(_ => fToRun(...args));
        this.lock = result.catch(LockedRunner.logger.warn).finally(this.newLock);
        return result;
    }
}

export class AbortController {
    constructor(public signal = new AbortSignal()) {}

    abort() {
        this.signal.aborted = true;
        for (const cb of this.signal.listeners) {
            cb();
        }
    }
}

export class AbortSignal {
    constructor(
        public aborted = false,
        public listeners = Array.of<() => void>()
    ) {}

    addEventListener(event: string, cb: () => void): void {
        if (event === "abort") {
            this.listeners.push(cb);
        }
    }
}

export async function signalWrapper<T extends any[], R extends any>(
    signal: AbortSignal,
    f: (...args: T) => Promise<R>,
    ...args: T
): Promise<R> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            return reject(new Error("Aborted before start"));
        }

        resolve(f(...args));

        signal.addEventListener("abort", () => {
            reject(new Error("Aborted"));
        });
    });
}

export function withTimeout<T extends any[], R extends any>(
    timeout: number,
    f: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
    logger.assert(timeout > 0, `Timeout misconfigured with ${timeout}, it has to be > 0.`);
    return function (...args: T): Promise<R> {
        const controller = new AbortController();
        const signal = controller.signal;

        const timeoutExec = setTimeout(() => {
            controller.abort();
        }, timeout);

        const promise = signalWrapper(signal, f, ...args);

        promise.finally(() => clearTimeout(timeoutExec));

        return promise.catch(err => {
            if (signal.aborted) {
                throw new Error("Timeout");
            }
            throw err;
        });
    };
}
