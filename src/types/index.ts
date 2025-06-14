import { Gio } from "astal/file";
import { GLib } from "astal/gobject";
import { Logger } from "src/util/log";

declare global {
    const CONFIG_DIR: string;
    const CONFIG_FILE: string;
    const TMP: string;
    const USER: string;
    const SRC_DIR: string;

    type Nullable<T> = T | null;
    type Undefinable<T> = T | undefined;
    type Void = Nullable<void>;

    async function wrapIO<T>(logger: Logger, promise: Promise<T>, message: string): Promise<Result<T, unknown>>;
    abstract class Result<V, E> {
        public abstract isOk(): this is Ok<V>;
        public abstract isErr(): this is Err<E>;
        public abstract match<R>(okHandler: (v: V | undefined) => R, errHandler: (e: E | undefined) => R): R;
    }

    class Ok<V> extends Result<V, never> {
        constructor(public readonly value?: V) {}
        isOk(): this is Ok<V> {}
        isErr(): this is Err<never> {}
        public match<R>(okHandler: (v: V | undefined) => R, errHandler: (e: never | undefined) => R): R {}
    }

    class Err<E> extends Result<never, E> {
        constructor(public readonly value?: E) {}
        isOk(): this is Ok<never> {}
        isErr(): this is Err<E> {}
        public match<R>(okHandler: (v: never | undefined) => R, errHandler: (e: E | undefined) => R): R {}
    }
}

export function ensureDirectory(path: string): void {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
        Gio.File.new_for_path(path).make_directory_with_parents(null);
    }
}

function ensureJsonFile(path: string): void {
    const file = Gio.File.new_for_path(path);
    const parent = file.get_parent();

    if (parent && !parent.query_exists(null)) {
        parent.make_directory_with_parents(null);
    }

    if (!file.query_exists(null)) {
        const stream = file.create(Gio.FileCreateFlags.NONE, null);
        stream.write_all("{}", null);
    }
}

function ensureFile(path: string): void {
    const file = Gio.File.new_for_path(path);
    const parent = file.get_parent();

    if (parent && !parent.query_exists(null)) {
        parent.make_directory_with_parents(null);
    }

    if (!file.query_exists(null)) {
        file.create(Gio.FileCreateFlags.NONE, null);
    }
}

const dataDir = typeof DATADIR !== "undefined" ? DATADIR : SRC;

async function wrapIO<T>(logger: Logger, promise: Promise<T>, message: string): Promise<Result<T, unknown>> {
    try {
        return new Ok<T>(await promise);
    } catch (err: unknown) {
        logger.warn(message, err);
        return new Err<unknown>(err);
    }
}

abstract class Result<V, E> {
    public abstract isOk(): this is Ok<V>;
    public abstract isErr(): this is Err<E>;
    public abstract match<R>(okHandler: (v?: V) => R, errHandler: (e?: E) => R): R;
}

class Ok<V> extends Result<V, never> {
    constructor(public readonly value?: V) {
        super();
    }

    isOk(): this is Ok<V> {
        return true;
    }

    isErr(): this is Err<never> {
        return false;
    }

    public match<R>(okHandler: (v?: V) => R, errHandler: (e?: never) => R): R {
        return okHandler(this.value);
    }
}

class Err<E> extends Result<never, E> {
    constructor(public readonly value?: E) {
        super();
    }

    isOk(): this is Ok<never> {
        return false;
    }

    isErr(): this is Err<E> {
        return true;
    }

    public match<R>(okHandler: (v?: never) => R, errHandler: (e?: E) => R): R {
        return errHandler(this.value);
    }
}

Object.assign(globalThis, {
    CONFIG_DIR: `${GLib.get_user_config_dir()}/baar`,
    CONFIG_FILE: `${GLib.get_user_config_dir()}/baar/config.json`,
    TMP: `${GLib.get_tmp_dir()}/baar`,
    USER: GLib.get_user_name(),
    SRC_DIR: dataDir,
    wrapIO: wrapIO,
    Result: Result,
    Ok: Ok,
    Err: Err,
});

Logger.get(this).debug(CONFIG_DIR);
Logger.get(this).debug(CONFIG_FILE);
Logger.get(this).debug(TMP);
Logger.get(this).debug(USER);
Logger.get(this).debug(SRC_DIR);
ensureDirectory(TMP);
// ensureFile(CONFIG_FILE);
// ensureJsonFile(`${CONFIG_DIR}/modules.json`);
// ensureFile(`${CONFIG_DIR}/modules.scss`);
