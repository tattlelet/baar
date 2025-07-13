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
                    (this as any)[key] = (...args: any[]): void =>
                        this.createLogger(consoleKey as keyof Console, classField)(...args);
                }
            });
        }
    }

    private createLogger(consoleKey: keyof Console, classField: string): _LogFunc {
        return (...args: any[]) => {
            let reason: unknown;
            let finalArgs = args;

            console.info();

            if (args.length && args[args.length - 1] instanceof Error) {
                reason = args[args.length - 1];
                finalArgs = args.slice(0, -1);
            }

            (console as any)[consoleKey](classField, ...finalArgs);

            if (reason) {
                this.exceptStack(reason, (console as any)[consoleKey].bind(console, classField, "(reason):"));
            }
        };
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

    private exceptStack(reason: unknown, log: _LogFunc, depth = 0, seen = new WeakSet()): void {
        const prefix = "  ".repeat(depth); // for indentation

        if (typeof reason === "object" && reason !== null) {
            if (seen.has(reason)) {
                log(`${prefix}↪️ (circular reference detected)`);
                return;
            }
            seen.add(reason);

            const ctor = reason.constructor?.name ?? "Object";
            const maybeMsg = (reason as any).message;
            const maybeStack = (reason as any).stack;

            const msg = maybeMsg ? `: ${maybeMsg}` : "";
            log(`${prefix}🔴 ${ctor}${msg}`);
            if (maybeStack && typeof maybeStack === "string") {
                log(
                    `${prefix}${maybeStack
                        .split("\n")
                        .filter(l => l !== "")
                        .map(l => prefix + l)
                        .join("\n")}`
                );
            }

            // GJS GLib.Error support
            if (reason instanceof GLib.Error) {
                log(
                    `${prefix}🔵 GLib.Error → domain: ${reason.domain}, code: ${reason.code}, message: ${reason.message}`
                );
            }

            // Known nested error keys
            const nestedFields = ["cause", "inner", "originalError", "error"];

            // Check for manually attached nested errors
            for (const key of nestedFields) {
                const val: any = (reason as any)[key];
                if (val !== null && val !== undefined && typeof val === "object" && val !== reason) {
                    log(`${prefix}↪ Nested error via "${key}":`);
                    this.exceptStack(val, log, depth + 1, seen);
                }
            }
        } else if (typeof reason === "string") {
            log(`${prefix}🟡 Error string: "${reason}"`);
        } else {
            log(`${prefix}⚫️ Unknown error type (${typeof reason}):`, reason);
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

export function jsonReplacer(key: string, value: any): any {
    if (value instanceof RegExp) {
        return value.toString();
    }
    return value;
}

export function LogMe(log: (...args: any[]) => void) {
    return function <T extends { new (...args: any[]): {} }>(constructor: T) {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                log(`🔍 ${JSON.stringify(this, jsonReplacer, 2)}`);
            }
        };
    };
}
