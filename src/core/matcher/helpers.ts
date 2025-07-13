import { Result, Ok, Err } from "./base";

export const Resultify = {
    from: wrapFToResult,
    promise: wrapPromise,
    fromAsync: wrapAsyncFToResult,
};

export function wrapFToResult<T extends any[], R extends any>(
    f: (...args: T) => R
): (...args: T) => Result<R, unknown> {
    return (...args: T): Result<R, unknown> => {
        try {
            return Ok.of(f(...args));
        } catch (e) {
            return Err.of(e);
        }
    };
}

export function wrapAsyncFToResult<T extends any[], R extends any>(
    f: (...args: T) => Promise<R>
): (...args: T) => Promise<Result<R, unknown>> {
    return async (...args: T): Promise<Result<R, unknown>> => Resultify.promise(f(...args));
}

export function wrapPromise<T>(promise: Promise<T>): Promise<Result<T, unknown>> {
    return promise.then(Ok.of).catch(Err.of);
}
