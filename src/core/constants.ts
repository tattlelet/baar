import { GLib } from "astal/gobject";

Object.assign(globalThis, {
    CONFIG_DIR: `${GLib.get_user_config_dir()}/baar`,
    CONFIG_FILE: `${GLib.get_user_config_dir()}/baar/config`,
    TMP: `${GLib.get_tmp_dir()}/baar`,
    USER: GLib.get_user_name(),
    SRC_DIR: typeof DATADIR !== "undefined" ? DATADIR : SRC,
});