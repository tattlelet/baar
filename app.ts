import "./src/types";
import { App, Gtk } from "astal/gtk3";
import { Baar } from "src/baar";
import MixerWindow from "src/components/mixer";
import { ConfigManager, ConfigSetup } from "src/core/config/configmanager";
import { IPCHandler } from "src/core/handler";
import { ThemeManager } from "src/core/theme";

const origThen = Promise.prototype.then;

Promise.prototype.then = function(onFulfilled, onRejected): any {
    return origThen.call(this, onFulfilled, function (error) {
        logError(error, "⚠️ Unhandled rejection caught via global then()");
        if (onRejected) {
            return onRejected(error);
        } else {
            throw error;
        }
    });
};

// Todo: Handle - Fontconfig warning: using without calling FcInit()
// Todo: Move mixer away from here
if (ARGV[0] === "mixer") {
    App.start({
        instanceName: 'mixer',
        requestHandler: (request: string, response: (response: unknown) => void) => {
            print(request);
        },
        main: async () => {
            ConfigSetup.run().then(filled => Baar.handleExit(filled, "Failed setting up config environment"));

            const configManager = ConfigManager.instace();
            configManager.startMonitors().then(filled => Baar.handleExit(filled, "Failed starting config monitors"));
            configManager.load().then(filled => Baar.handleExit(filled, "Failed to load config files or defaults"));

            const themeManager = ThemeManager.instace();
            themeManager.startMonitors();
            themeManager
                .registerListener()
                .then(filled => Baar.handleExit(filled, "Failed to register theme notification"));

            await themeManager.loaded(1000 * 60 * 5).then(filled => {
                if (filled.isErr()) {
                    Baar.handleExit(false, "Timeout waiting for CSS loaded signal", filled.unwrapErr());
                }
            });

            const w = new Gtk.Window({
                name: "mixer",
                title: "BaarMixer",
                application: App,
                decorated: true,
            });
            w.get_style_context().add_class("mixer");
            w.add(((await MixerWindow()) as Gtk.Box));

            w.show();
            App.get_window("mixer")!.connect("destroy", () => {
                App.quit();
            })
        }
    });
}
else {
    App.start({
        instanceName: 'baar',
        requestHandler: IPCHandler.requestHandler,
        main: Baar.init,
    });
}

