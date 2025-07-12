import { Logger } from "../log";
import { Result, Ok, Err } from "../matcher/base";

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

    public async sync<T extends any[], R extends any>(
        f: (...args: T) => Promise<R>,
        ...args: T
    ): Promise<Result<R, unknown>> {
        const fToRun = this.timeout > 0 ? withTimeout(this.timeout, f) : wrapAsyncFToResult(f);
        const result = this.lock.then(async () => await fToRun(...args));
        this.lock = result.catch(LockedRunner.logger.except.bind(null, "LockedRunned failed")).finally(this.newLock);
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

export function wrapAsyncFToResult<T extends any[], R extends any>(
    f: (...args: T) => Promise<R>
): (...args: T) => Promise<Result<R, unknown>> {
    return async (...args: T): Promise<Result<R, unknown>> => {
        return f(...args)
            .then(Ok.of)
            .catch(Err.of);
    };
}

export function wrapAsyncResult<R extends any>(promise: Promise<R>): Promise<Result<R, unknown>> {
    return promise
        .then(filled => {
            return new Ok(filled);
        })
        .catch(rejected => {
            return new Err(rejected);
        });
}

export async function signalWrapper<T extends any[], R extends any>(
    signal: AbortSignal,
    f: (...args: T) => Promise<R>,
    ...args: T
): Promise<Result<R, unknown>> {
    return new Promise<Result<R, unknown>>((resolve, reject) => {
        if (signal.aborted) {
            print("aborteded");
            reject(new Error("Aborted before start"));
            return;
        }

        f(...args).then(filled => {
            resolve(new Ok(filled));
        });

        signal.addEventListener("abort", () => {
            reject(new Error("Aborted"));
        });
    });
}

export function withTimeout<T extends any[], R extends any>(
    timeout: number,
    f: (...args: T) => Promise<R>
): (...args: T) => Promise<Result<R, unknown>> {
    return function (...args: T): Promise<Result<R, unknown>> {
        if (timeout <= 0) {
            return new Promise(resolve => {
                resolve(new Err(new Error("Invalid timeout input, timeout has to be > 0")));
            });
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const timeoutExec = setTimeout(() => {
            controller.abort();
        }, timeout);

        return signalWrapper(signal, f, ...args)
            .catch(err => {
                if (signal.aborted) {
                    return new Err(new Error("Timeout"));
                }
                return new Err(err);
            })
            .finally(() => clearTimeout(timeoutExec));
    };
}

export const Asyncify = {
    from: wrapAsync,
};

export function wrapAsync<T extends any[], R extends any>(f: (...args: T) => R): (...args: T) => Promise<R> {
    return async (...args: T) => f(...args);
}

export class Atomic<T extends any> {
    constructor(
        private t: T,
        private lockedRunner = new LockedRunner()
    ) {}

    private async _set(t: T): Promise<void> {
        this.t = t;
    }

    public async set(t: T): Promise<void> {
        this.lockedRunner.sync(this._set.bind(this), t);
    }

    public get(): T {
        return this.t;
    }
}

export function promiseWithTimout(
    timeout: number,
    callback: (f: () => Promise<void>) => void
): Promise<Result<void, unknown>> {
    const notifyF = () => {
        return new Promise<void>(resolve => {
            callback(async () => resolve(undefined));
        });
    };

    return withTimeout(timeout, notifyF)();
}

export class DeferredPromise<T extends any | PromiseLike<any>> {
    public constructor(
        public readonly promise: Promise<T>,
        public readonly resolve: (value: T) => void,
        public readonly reject: (value: unknown) => void
    ) {}
}

export function createDeferred<T extends any | PromiseLike<any>>(): Result<DeferredPromise<T>, unknown> {
    let resolve: ((value: T) => void) | undefined;
    let reject: ((value: unknown) => void) | undefined;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    if (resolve === undefined || reject === undefined) {
        return new Err(new Error("Unable to grab resolve and reject handlers from promise"));
    }

    return new Ok(new DeferredPromise(promise, resolve!, reject!));
}
