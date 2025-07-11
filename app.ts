import "./src/core/constants.ts"
import { App, Gtk } from "astal/gtk3";
import { Baar } from "src/baar";
import MixerWindow from "src/components/mixer";
import { promiseWithTimout } from "src/core/async/base.ts";
import { ConfigSetup, ConfigManager } from "src/core/configmanager";
import { Handler } from "src/core/handler";
import { ThemeManager } from "src/core/theme";

// Move mixer away from here
if (ARGV[0] === "mixer") {
    App.start({
        instanceName: 'mixer',
        requestHandler: (request: string, response: (response: unknown) => void) => {
            print(request);
        },
        main: async () => {
            ConfigSetup.run();
            const configManager = ConfigManager.instace();
            configManager.startMonitors();
    
            const themeManager = ThemeManager.instace();
            themeManager.startMonitors();
            themeManager.registerListener();
    
            const configLoad = configManager.load();
            await promiseWithTimout(1000 * 60 * 5, themeManager.notifyOnceOnLoad.bind(themeManager));
            await configLoad;

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
        requestHandler: Handler.requestHandler,
        main: Baar.init,
    });
}

