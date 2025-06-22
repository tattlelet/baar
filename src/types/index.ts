import { GLib } from "astal/gobject";
import * as LoggerModule from "src/core/log";
import * as AsyncModule from "src/core/async";
import * as MatcherModule from "src/core/matcher";

declare global {
    type Nullable<T> = T | null;
    type Undefinable<T> = T | undefined;
    type Void = Nullable<void>;

    var Logger: typeof LoggerModule.Logger;
    type Logger = LoggerModule.Logger;

    var LockedRunner: typeof AsyncModule.LockedRunner;
    type LockedRunner = AsyncModule.LockedRunner;

    // polyin for AbortController and AbortSignal since those arent provided by gjs
    var AbortController: typeof AsyncModule.AbortController;
    type AbortController = AsyncModule.AbortController;
    var AbortSignal: typeof AsyncModule.AbortSignal;
    type AbortSignal = AsyncModule.AbortSignal;
    var Atomic: typeof AsyncModule.Atomic;
    type Atomic<T> = AsyncModule.Atomic<T>;

    var wrapIO: typeof MatcherModule.wrapIO;

    var Result: typeof MatcherModule.Result;
    type Result<R, E> = MatcherModule.Result<R, E>;

    var Ok: typeof MatcherModule.Ok;
    type Ok<R> = MatcherModule.Ok<R>;

    var Err: typeof MatcherModule.Err;
    type Err<E> = MatcherModule.Err<E>;
}

Object.assign(globalThis, {
    CONFIG_DIR: `${GLib.get_user_config_dir()}/baar`,
    CONFIG_FILE: `${GLib.get_user_config_dir()}/baar/config`,
    TMP: `${GLib.get_tmp_dir()}/baar`,
    USER: GLib.get_user_name(),
    SRC_DIR: typeof DATADIR !== "undefined" ? DATADIR : SRC,
    wrapIO: MatcherModule.wrapIO,
    Result: MatcherModule.Result,
    Ok: MatcherModule.Ok,
    Err: MatcherModule.Err,
    LockedRunner: AsyncModule.LockedRunner,
    AbortController: AsyncModule.AbortController,
    AbortSignal: AsyncModule.AbortSignal,
    Logger: LoggerModule.Logger,
    Atomic: AsyncModule.Atomic,
});
