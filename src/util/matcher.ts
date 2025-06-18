export abstract class Result<V, E> {
    public abstract isOk(): this is Ok<V>;
    public abstract isErr(): this is Err<E>;
    public abstract match<R>(okHandler: (v: V) => R, errHandler: (e: E) => R): R;
}

export class Ok<V> extends Result<V, never> {
    constructor(public readonly value: V) {
        super();
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
}

export class Err<E> extends Result<never, E> {
    constructor(public readonly value: E) {
        super();
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
}

export async function wrapIO<T>(logger: Logger, promise: Promise<T>, message: string): Promise<Result<T, unknown>> {
    try {
        return new Ok<T>(await promise);
    } catch (err: unknown) {
        logger.warn(message, err);
        return new Err<unknown>(err);
    }
}
