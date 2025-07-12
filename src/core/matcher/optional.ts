export abstract class Optional<V> {
    public abstract isSome(): this is Some<V>;
    public abstract isNone(): this is None<V>;

    public abstract map<U>(fn: (v: V) => U): Optional<U>;
    public abstract onNone(fn: () => void): this;

    public abstract flatMap<U>(fn: (v: V) => Optional<U>): Optional<U>;

    public abstract unwrap(): V;
    public abstract get(): V | undefined;

    public abstract getOr(defaultValue: V): V;
    public abstract getOr(defaultProvider: () => V): V;
    public abstract getOr(defaultProvider: V | (() => V)): V;

    public abstract toNullable(): V | null;
    public abstract toUndefined(): V | undefined;

    public static some<V>(value: V): Optional<V> {
        return new Some(value);
    }

    public static none<V = never>(): Optional<V> {
        return new None<V>();
    }

    public static from<V>(value: V | undefined | null): Optional<V> {
        return value !== undefined && value !== null ? Optional.some(value) : Optional.none();
    }
}

class Some<V> extends Optional<V> {
    constructor(private readonly value: V) {
        super();
    }

    public isSome(): this is Some<V> {
        return true;
    }

    public isNone(): this is never {
        return false;
    }

    public map<U>(fn: (v: V) => U): Optional<U> {
        return Optional.from(fn(this.value));
    }

    public onNone(fn: () => void): this {
        return this;
    }

    public flatMap<U>(fn: (v: V) => Optional<U>): Optional<U> {
        return fn(this.value);
    }

    public unwrap(): V {
        return this.value;
    }

    public get(): V {
        return this.value;
    }

    public getOr(defaultValue: V): V;
    public getOr(defaultProvider: () => V): V;
    public getOr(defaultProvider: V | (() => V)): V {
        return this.value;
    }

    public toNullable(): V {
        return this.value;
    }

    public toUndefined(): V {
        return this.value;
    }
}

class None<V> extends Optional<V> {
    public isSome(): this is never {
        return false;
    }

    public isNone(): this is None<V> {
        return true;
    }

    public map<U>(fn: (v: V) => U): Optional<U> {
        return Optional.none();
    }

    public onNone(fn: () => void): this {
        fn();
        return this;
    }

    public flatMap<U>(fn: (v: V) => Optional<U>): Optional<U> {
        return Optional.none();
    }

    public unwrap(): never {
        throw new Error("Tried to unwrap a None");
    }

    public get(): undefined {
        return undefined;
    }

    public getOr(defaultValue: V): V;
    public getOr(defaultProvider: () => V): V;
    public getOr(defaultProvider: V | (() => V)): V {
        if (typeof defaultProvider === "function") {
            return (defaultProvider as () => V)();
        }
        return defaultProvider;
    }

    public toNullable(): null {
        return null;
    }

    public toUndefined(): undefined {
        return undefined;
    }
}
