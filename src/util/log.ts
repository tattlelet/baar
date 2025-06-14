type _LogFunc = typeof console.debug | typeof console.log | typeof console.warn | typeof console.error;
type ClassIdentifier = { name: string };

export class Logger {
    public debug: _LogFunc = console.debug;
    public info: _LogFunc = console.log;
    public warn: _LogFunc = console.warn;
    public error: _LogFunc = console.error;

    private constructor(identifier?: string) {
        if (identifier !== undefined) {
            Object.getOwnPropertyNames(this).forEach(key => {
                const consoleKey = key === 'info' ? 'log' : key;
                if (consoleKey in console) {
                    (this as any)[key] = (...args: any[]): _LogFunc => (console as any)[consoleKey](`[${identifier}]`, ...args);
                }
            });
        }
    }

    public static get(c?: ClassIdentifier): Logger {
        return new Logger(c?.name.substring(1));
    }
}
