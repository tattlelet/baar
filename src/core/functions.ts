export function boundCall<
    T extends object,
    K extends keyof T
>(
    ctx: T,
    methodName: K
): T[K] extends (...args: infer Args) => infer R
    ? (...args: Args) => R
    : never {
    return (ctx[methodName] as Function).bind(ctx) as any;
}
