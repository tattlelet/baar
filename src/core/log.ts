import { GLib } from "astal";

type _LogFunc = typeof console.debug | typeof console.log | typeof console.warn | typeof console.error;
type ClassIdentifier = { name: string };

export class AssertError extends Error {}

export class Logger {
    public debug: _LogFunc = console.debug;
    public info: _LogFunc = console.log;
    public warn: _LogFunc = console.warn;
    public error: _LogFunc = console.error;

    private constructor(identifier?: string) {
        if (identifier !== undefined) {
            const classField = `[${identifier}]`;
            Object.getOwnPropertyNames(this).forEach(key => {
                const consoleKey = key === "info" ? "log" : key;
                if (consoleKey in console) {
                    (this as any)[key] = (...args: any[]): _LogFunc =>
                        (console as any)[consoleKey](classField, ...args);
                }
            });
        }
    }

    public assert(condition: boolean, message?: string): asserts condition {
        if (!condition) {
            if (message !== undefined) {
                this.error(message);
                throw new AssertError(message);
            }
            throw new AssertError();
        }
    }

    // Todo: rework this
    public except(reason: unknown, depth = 0, seen = new WeakSet()): void {
        const prefix = "  ".repeat(depth); // for indentation

        if (typeof reason === "object" && reason !== null) {
            if (seen.has(reason)) {
                this.error(`${prefix}↪️ (circular reference detected)`);
                return;
            }
            seen.add(reason);

            const ctor = reason.constructor?.name ?? "Object";
            const maybeMsg = (reason as any).message;
            const maybeStack = (reason as any).stack;

            const msg = maybeMsg ? `: ${maybeMsg}` : "";
            this.error(`${prefix}🔴 ${ctor}${msg}`);
            if (maybeStack && typeof maybeStack === "string") {
                this.error(
                    `${prefix}${maybeStack
                        .split("\n")
                        .map(l => prefix + l)
                        .join("\n")}`
                );
            }

            // GJS GLib.Error support
            if (reason instanceof GLib.Error) {
                this.error(
                    `${prefix}🔵 GLib.Error → domain: ${reason.domain}, code: ${reason.code}, message: ${reason.message}`
                );
            }

            // Known nested error keys
            const nestedFields = ["cause", "inner", "originalError", "error"];

            // ES2022 Error.cause support (non-enumerable)
            if (reason instanceof Error && reason.cause && typeof reason.cause === "object") {
                this.error(`${prefix}↪ Nested error via "cause":`);
                this.except(reason.cause, depth + 1, seen);
            }

            // Check for manually attached nested errors
            for (const key of nestedFields) {
                const val: any = (reason as any)[key];
                if (val && typeof val === "object" && val !== reason) {
                    this.error(`${prefix}↪ Nested error via "${key}":`);
                    this.except(val, depth + 1, seen);
                }
            }
        } else if (typeof reason === "string") {
            console.error(`${prefix}🟡 Error string: "${reason}"`);
        } else {
            console.error(`${prefix}⚫️ Unknown error type (${typeof reason}):`, reason);
        }
    }

    public static get(c?: ClassIdentifier): Logger {
        let name = c?.name;
        if (name !== undefined && name[0] == "_") {
            name = name.substring(1);
        }
        return new Logger(name);
    }
}
