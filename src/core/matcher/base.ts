import { Logger } from "../log";

export abstract class Result<V, E> {
    public abstract isOk(): this is Ok<V>;
    public abstract isErr(): this is Err<E>;
    public abstract match<R>(okHandler: (v: V) => R, errHandler: (e: E) => R): R;
    public abstract mapResult<R, ER>(
        okHandler: (v: V) => Result<R, ER>,
        errHandler: (e: E) => Result<R, ER>
    ): Result<R, ER>;

    // Unsafe methods
    public abstract expect(message?: string): V;
    public abstract unwrap(): V;
    public abstract unwrapErr(): E;

    public apply<U>(fn: (value: V) => Result<U, E>): Result<U, E> {
        return this.match(ok => fn(ok), Err.of<E>);
    }

    public or<U>(fn: (err: E) => Result<V, U>): Result<V, U> {
        return this.match(Ok.of, err => fn(err));
    }

    public collect(): V | E {
        return this.match(
            value => value as V | E,
            error => error as V | E
        );
    }
}

export class Ok<V> extends Result<V, never> {
    constructor(public readonly value: V) {
        super();
    }

    public static of<V>(value: V): Ok<V> {
        return new Ok(value);
    }

    isOk(): this is Ok<V> {
        return true;
    }

    isErr(): this is Err<never> {
        return false;
    }

    public match<R>(okHandler: (v: V) => R, errHandler: (e: never) => R): R {
        return okHandler(this.value);
    }

    public mapResult<R, ER>(
        okHandler: (v: V) => Result<R, ER>,
        errHandler: (e: never) => Result<R, ER>
    ): Result<R, ER> {
        return okHandler(this.value);
    }

    public expect(): V {
        return this.value;
    }

    public unwrap(): V {
        return this.value;
    }

    public unwrapErr(): never {
        throw new Error("Tried to unwrapErr() an Ok");
    }
}

export class Err<E> extends Result<never, E> {
    private static logger: Logger = Logger.get(Err);

    constructor(public readonly value: E) {
        super();
    }

    public static of(message: string): Err<Error>;
    public static of(message: string, cause: unknown): Err<Error>;
    public static of<E extends unknown>(error: E): Err<E>;
    public static of<E extends unknown>(errorOrMessage: string | E, cause?: unknown): Err<E> {
        if (typeof errorOrMessage === "string") {
            return new Err<E>(new Error(errorOrMessage, cause !== undefined ? { cause } : undefined) as E);
        } else {
            return new Err(errorOrMessage);
        }
    }

    isOk(): this is Ok<never> {
        return false;
    }

    isErr(): this is Err<E> {
        return true;
    }

    public match<R>(okHandler: (v: never) => R, errHandler: (e: E) => R): R {
        return errHandler(this.value);
    }

    public mapResult<R, ER>(
        okHandler: (v: never) => Result<R, ER>,
        errHandler: (e: E) => Result<R, ER>
    ): Result<R, ER> {
        return errHandler(this.value);
    }

    public expect(message?: string): never {
        Err.logger.except(message || "Expected Ok but got Err", this.value);
        throw this.value;
    }

    public unwrap(): never {
        throw new Error(`Tried to unwrap() an Err: ${this.value}`);
    }

    public unwrapErr(): E {
        return this.value;
    }
}

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

export const Resultify = {
    from: wrapFToResult,
    promise: wrapPromise,
};

export function wrapPromise<T>(promise: Promise<T>): Promise<Result<T, unknown>> {
    return promise.then(Ok.of).catch(Err.of);
}

export async function wrapIO<T>(logger: Logger, promise: Promise<T>, message: string): Promise<Result<T, unknown>> {
    return promise.then(Ok.of).catch(err => {
        logger.warn(message, err);
        return Err.of(err);
    });
}
