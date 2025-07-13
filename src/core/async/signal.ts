export class AbortedBySignalError extends Error {}

export class AbortController {
    constructor(public signal = new AbortSignal()) {}

    public abort() {
        this.signal.aborted = true;
        for (const cb of this.signal.listeners) {
            cb();
        }
    }
}

export class AbortSignal {
    constructor(
        public aborted = false,
        public listeners = Array.of<() => void>()
    ) {}

    public addEventListener(event: string, cb: () => void): void {
        if (event === "abort") {
            this.listeners.push(cb);
        }
    }
}
