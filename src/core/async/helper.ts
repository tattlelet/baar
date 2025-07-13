export const Asyncify = {
    from: wrapAsync,
};

export function wrapAsync<T extends any[], R extends any>(f: (...args: T) => R): (...args: T) => Promise<R> {
    return async (...args: T) => f(...args);
}
