export type ErrorWithCause = Error & { cause: object };

export function errorHasCause(reason: unknown): reason is ErrorWithCause {
    return (
        reason instanceof Error &&
        reason.cause !== null &&
        reason.cause !== undefined &&
        typeof reason.cause === "object"
    );
}
