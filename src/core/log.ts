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

    public static get(c?: ClassIdentifier): Logger {
        let name = c?.name;
        if (name !== undefined && name[0] == "_") {
            name = name.substring(1);
        }
        return new Logger(name);
    }
}
