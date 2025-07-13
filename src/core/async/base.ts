import { Logger } from "../lang/log";
import { Err, Ok, Result } from "../matcher/base";
import { Resultify } from "../matcher/helpers";
import { AbortController, AbortedBySignalError, AbortSignal } from "./signal";

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
        const fToRun = this.timeout > 0 ? withTimeout(this.timeout, f) : Resultify.fromAsync(f);
        const result = this.lock.then(() => fToRun(...args));
        this.lock = result.finally(this.newLock);
        return result;
    }
}

export class AsyncTimeoutError extends Error {}

export async function signalWrapper<T extends any[], R extends any>(
    signal: AbortSignal,
    f: (...args: T) => Promise<R>,
    ...args: T
): Promise<Result<R, unknown>> {
    return new Promise<Result<R, unknown>>((resolve, reject) => {
        if (signal.aborted) {
            reject(Err.of("Aborted before start"));
            return;
        }

        f(...args).then(filled => {
            resolve(Ok.of(filled));
        });

        signal.addEventListener("abort", () => {
            reject(Err.of(new AbortedBySignalError("Signal abort sent")));
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
                resolve(Err.of("Invalid timeout input, timeout has to be > 0"));
            });
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const timeoutExec = setTimeout(() => {
            controller.abort();
        }, timeout);

        return signalWrapper(signal, f, ...args)
            .catch((err: Err<unknown>) =>
                err.or(e => {
                    if (e instanceof AbortedBySignalError) {
                        return Err.of(new AsyncTimeoutError("Timedout by signal handler", { cause: e }));
                    }
                    return Err.of(e);
                })
            )
            .finally(() => clearTimeout(timeoutExec));
    };
}

export class DeferredPromise<T extends any | PromiseLike<any>> {
    public constructor(
        public readonly promise: Promise<T>,
        public readonly resolve: (value: T) => void,
        public readonly reject: (value: unknown) => void
    ) {}

    public async withTimeout(timeout: number): Promise<Result<T, unknown>> {
        let timeoutId: ReturnType<typeof setTimeout>;

        const timeoutPromise = new Promise<Result<T, unknown>>(resolve => {
            timeoutId = setTimeout(() => resolve(Err.of("Timeout")), timeout);
        });

        const wrapped = this.promise
            .then(value => {
                return Ok.of(value);
            })
            .catch(error => {
                return Err.of(error);
            })
            .finally(() => {
                clearTimeout(timeoutId);
            });

        return Promise.race([timeoutPromise, wrapped]);
    }
}

export function createDeferred<T extends any | PromiseLike<any>>(): Result<DeferredPromise<T>, unknown> {
    let resolve: ((value: T) => void) | undefined;
    let reject: ((value: unknown) => void) | undefined;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    if (resolve === undefined || reject === undefined) {
        return Err.of("Unable to grab resolve and reject handlers from promise");
    }

    return Ok.of(new DeferredPromise(promise, resolve, reject));
}
