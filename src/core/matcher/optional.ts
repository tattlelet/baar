export abstract class Optional<V> {
    public abstract isSome(): this is Some<V>;
    public abstract isNone(): this is None;

    public abstract map<U>(fn: (v: V) => U): Optional<U>;
    public abstract flatMap<U>(fn: (v: V) => Optional<U>): Optional<U>;

    public abstract getOr(defaultValue: V): V;

    public abstract toNullable(): V | null;
    public abstract toUndefined(): V | undefined;

    public static some<V>(value: V): Optional<V> {
        return new Some(value);
    }

    public static none<V = never>(): Optional<V> {
        return new None();
    }

    public static from<V>(value: V | undefined | null): Optional<V> {
        return value !== undefined && value !== null
            ? Optional.some(value)
            : Optional.none();
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
        return new Some(fn(this.value));
    }

    public flatMap<U>(fn: (v: V) => Optional<U>): Optional<U> {
        return fn(this.value);
    }

    public getOr(defaultValue: V): V {
        return this.value;
    }

    public toNullable(): V {
        return this.value;
    }

    public toUndefined(): V {
        return this.value;
    }
}

class None extends Optional<never> {
    public isSome(): this is never {
        return false;
    }

    public isNone(): this is None {
        return true;
    }

    public map<U>(fn: (v: never) => U): Optional<U> {
        return this;
    }

    public flatMap<U>(fn: (v: never) => Optional<U>): Optional<U> {
        return this;
    }

    public getOr<U>(defaultValue: U): U {
        return defaultValue;
    }

    public toNullable(): null {
        return null;
    }

    public toUndefined(): undefined {
        return undefined;
    }
}
