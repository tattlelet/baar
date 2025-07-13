import { Gio, GLib, GObject } from "astal";
import Wp from "gi://Wp?version=0.5";
import { createDeferred, DeferredPromise, withTimeout } from "src/core/async/base";
import { allOf } from "src/core/lang/iter";

import { Logger } from "src/core/lang/log";
import { Measured } from "src/core/lang/timer";
import { Err, Ok, Result } from "src/core/matcher/base";
import { Resultify } from "src/core/matcher/helpers";

// const mixer = Wp.Plugin.find(core, "mixer-api");
// mixer?.connect("changed", (node, id) => {
// print(node, id);
// });

// const iterator = om.new_filtered_iterator_full(interest).foreach((node: Wp.Node) => {
// media.name:The Youtube Rapper Turned Mass Killer - YouTube
// application.name:LibreWolf
// media.class:Stream/Output/Audio
// port.group:stream.0
// node.loop.name:data-loop.0
// client.id:65
// object.id:109
// node.properties.new_iterator().foreach((property: Wp.PropertiesItem) => {
//     print(`${property.get_key()}:${property.get_value()}`);
// })
// print("--");
// node.globalProperties.new_iterator().foreach((property: Wp.PropertiesItem) => {
//     print(`${property.get_key()}:${property.get_value()}`);
// })
// print("--");

// node.new_ports_iterator().foreach((port: Wp.Port) => {
//     port.properties.new_iterator().foreach((property: Wp.PropertiesItem) => {
//         print(`${property.get_key()}:${property.get_value()}`);
//     });
// });

// node.connect("params-changed", () => {
//     print("dongs");
// })

// node.connect("notify::global_properties", (self) => {
//     print("penor");
// });

// node.connect("notify::properties", (self) => {
//     print("penor");
// });

// const builderRequest = Wp.SpaPodBuilder.new_object("Spa:Pod:Object:Param:Props", "Props");
// builderRequest.add_int(0);
// builderRequest.add_property("volume");
// const volume = builderRequest.end();

// node.enum_params("Props", null, null, async (self, data) => {
// print("volume: ", data);
// });

// props = spa_pod_builder_add_object(&b,
// 0x1000d,    // SPA_TYPE_OBJECT_Props
// 0,          // SPA_PARAM_Props
// 67,         // SPA_PROP_volume
// SPA_POD_Float(volume));

// Wp.spa_id_table_new_iterator().foreach(() => {

// })

// "Spa:Pod:Object:Param:Format" and "Spa:Enum:ParamId"
// const table = Wp.spa_id_table_from_name("ParamId");
// Wp.spa_id_table_new_iterator(table).foreach((v: Wp.SpaIdValue) => {
//     print(v)
// });

// const arr = Wp.SpaPodBuilder.new_array();
// arr.add_float(0.9 ** 3);
// arr.add_float(0.9 ** 3);

// const builder = Wp.SpaPodBuilder.new_object("Spa:Pod:Object:Param:Props", "Props");
// builder.add_property("channelVolumes");
// builder.add_pod(arr.end());
// builder.add_property("volume");
// builder.add_float(0.9 ** 3);

// const spa = builder.end();
// const b = node.set_param("Props", 0, spa);

// print(b);
// });

export class WirePlumberClient {
    private static logger: Logger = Logger.get(this);
    private static OBJECT_MANAGER_TIMEOUT = 1000 * 60;

    private static INSTANCE: WirePlumberClient = new WirePlumberClient();
    private core?: Wp.Core;
    private metadataManager?: Wp.ObjectManager;
    private objectManager?: Wp.ObjectManager;

    public static instance(): WirePlumberClient {
        return this.INSTANCE;
    }

    @Measured(WirePlumberClient.logger.debug)
    public async start(): Promise<Result<void, unknown>> {
        const core = new Wp.Core();

        if (!core.connect()) {
            return new Err(new Error("Unable to connect to wireplumber"));
        }
        WirePlumberClient.logger.debug("Wp.Core connection successful");

        (await this.registerComponents(core)).expect("Failed registering components");

        return new Ok(undefined);
    }

    private async registerMetadataManager(): Promise<Wp.ObjectManager> {
        const metadataManager = new Wp.ObjectManager();

        metadataManager.request_object_features(Wp.GlobalProxy.$gtype, Wp.OBJECT_FEATURES_ALL);
        const metadata = Wp.ObjectInterest.new_type(Wp.Metadata.$gtype);
        metadata.add_constraint(
            Wp.ConstraintType.PW_GLOBAL_PROPERTY,
            "metadata.name",
            Wp.ConstraintVerb.EQUALS,
            GLib.Variant.new_string("default")
        );
        metadataManager.add_interest_full(metadata);
        metadataManager.connect("object-added", (self: this, metadata: Wp.Metadata, userData: any): void => {
            WirePlumberClient.logger.info("Metadata registered", self, metadata, userData);
        });

        return metadataManager;
    }

    private async registerObjectManager(): Promise<Wp.ObjectManager> {
        const objectManager = new Wp.ObjectManager();

        objectManager.request_object_features(Wp.Node.$gtype, Wp.OBJECT_FEATURES_ALL);
        objectManager.request_object_features(Wp.GlobalProxy.$gtype, Wp.OBJECT_FEATURES_ALL);

        // Audio
        const audioNodeInterest = Wp.ObjectInterest.new_type(Wp.Node.$gtype);
        const audioClasses = new GLib.Variant("as", [
            "Audio/Sink",
            "Audio/Source",
            "Stream/Output/Audio",
            "Stream/Input/Audio",
        ]);
        audioNodeInterest.add_constraint(
            Wp.ConstraintType.PW_PROPERTY,
            "media.class",
            Wp.ConstraintVerb.IN_LIST,
            audioClasses
        );
        const audioDeviceInterest = Wp.ObjectInterest.new_type(Wp.Device.$gtype);
        audioDeviceInterest.add_constraint(
            Wp.ConstraintType.PW_GLOBAL_PROPERTY,
            "metadata.name",
            Wp.ConstraintVerb.EQUALS,
            GLib.Variant.new_string("Audio/Device")
        );

        // Video
        const videoNodeInterest = Wp.ObjectInterest.new_type(Wp.Node.$gtype);
        const videoClasses = new GLib.Variant("as", [
            "Video/Sink",
            "Video/Source",
            "Stream/Output/Video",
            "Stream/Input/Video",
        ]);
        videoNodeInterest.add_constraint(
            Wp.ConstraintType.PW_PROPERTY,
            "media.class",
            Wp.ConstraintVerb.IN_LIST,
            videoClasses
        );
        const videoDeviceInterest = Wp.ObjectInterest.new_type(Wp.Device.$gtype);
        videoDeviceInterest.add_constraint(
            Wp.ConstraintType.PW_GLOBAL_PROPERTY,
            "metadata.name",
            Wp.ConstraintVerb.EQUALS,
            GLib.Variant.new_string("Video/Device")
        );

        objectManager.add_interest_full(audioNodeInterest);
        objectManager.add_interest_full(audioDeviceInterest);
        objectManager.add_interest_full(videoNodeInterest);
        objectManager.add_interest_full(videoDeviceInterest);

        objectManager.connect("installed", (self: this) => {
            WirePlumberClient.logger.info("ObjManager installed", self);
        });

        return objectManager;
    }

    private static withTimeout(deferred: DeferredPromise<void>): Promise<boolean> {
        // There are two layers of response (timeout and the actual execution)
        // Todo: rewrite this
        return withTimeout(WirePlumberClient.OBJECT_MANAGER_TIMEOUT, async () => Resultify.promise(deferred.promise))()
            .then(filled => {
                return filled.match(
                    withTimeoutOk =>
                        withTimeoutOk.match(
                            loadOk => {
                                WirePlumberClient.logger.error("Operation executed successfully");
                                return true;
                            },
                            loadError => {
                                WirePlumberClient.logger.error("Failed executing operation", loadError);
                                return false;
                            }
                        ),
                    timeoutError => {
                        WirePlumberClient.logger.error("Timed out connecting object manager", timeoutError);
                        return false;
                    }
                );
            })
            .catch(rejected => {
                WirePlumberClient.logger.error("Deferred promise rejected", rejected);
                return false;
            });
    }

    private static async toLoadedResult<T>(
        promise: Promise<T>,
        successMessage: string,
        failedMessage: string
    ): Promise<[boolean, T | undefined]> {
        return (await Resultify.promise(promise)).match(
            v => {
                WirePlumberClient.logger.debug(successMessage);
                return [true, v];
            },
            e => {
                WirePlumberClient.logger.error(failedMessage, e);
                return [false, undefined] as [boolean, T | undefined];
            }
        );
    }

    private async loadPlugin(
        core: Wp.Core,
        deferred: DeferredPromise<void>,
        component: string,
        type: string,
        provides: string
    ): Promise<void> {
        core.load_component(
            component,
            type,
            null,
            "default-nodes-api",
            null,
            (obj: Wp.Object | null, result: Gio.AsyncResult) => {
                if (!core.load_component_finish(result)) {
                    deferred.reject(new Error(`Failed to load component: ${component}`));
                    return;
                }

                if (obj === null) {
                    deferred.reject(new Error(`Object wasnt sent for activation for ${component}`));
                    return;
                }

                obj.activate(
                    Wp.PluginFeatures.ENABLED,
                    null,
                    (finishedObj: Wp.Object | null, activationResult: Gio.AsyncResult, data: any | null) => {
                        if (finishedObj === null) {
                            deferred.reject(new Error(`Object wasnt sent for activation-finish for ${component}`));
                            return;
                        }

                        if (!finishedObj.activate_finish(activationResult)) {
                            deferred.reject(new Error(`Failed to load component: ${component}`));
                            return;
                        }

                        WirePlumberClient.logger.info(`Activated ${component}`);
                        deferred.resolve(undefined);
                    }
                );
            }
        );
    }

    private async registerComponents(core: Wp.Core): Promise<Result<void, undefined>> {
        // Todo wrap bools
        const deferredNodesApiLoad = createDeferred<void>().expect("Unable to create deferred, this shouldn't happen");
        const deferredMixerApiLoad = createDeferred<void>().expect("Unable to create deferred, this shouldn't happen");
        WirePlumberClient.logger.debug("Deferred promises started");

        const [metadataConfigured, metadataManager] = await WirePlumberClient.toLoadedResult(
            this.registerMetadataManager(),
            "MetadataManager configured",
            "Failed creating MetadataManager"
        );

        if (!metadataConfigured) {
            return new Err(undefined);
        }
        WirePlumberClient.logger.assert(metadataManager !== undefined);

        const [objectManagerConfigured, objectManager] = await WirePlumberClient.toLoadedResult(
            this.registerObjectManager(),
            "ObjectManager configured",
            "Failed creating ObjectManager"
        );

        if (!objectManagerConfigured) {
            return new Err(undefined);
        }
        WirePlumberClient.logger.assert(objectManager !== undefined);

        WirePlumberClient.logger.debug("Starting plugin load");
        this.loadPlugin(
            core,
            deferredNodesApiLoad,
            "libwireplumber-module-default-nodes-api",
            "module",
            "default-nodes-api"
        );
        this.loadPlugin(core, deferredMixerApiLoad, "libwireplumber-module-mixer-api", "module", "mixer-api");

        const allPluginsLoaded = allOf(
            (
                await Promise.all([
                    WirePlumberClient.withTimeout(deferredNodesApiLoad),
                    WirePlumberClient.withTimeout(deferredMixerApiLoad),
                ])
            )[Symbol.iterator](),
            b => b
        );

        if (!allPluginsLoaded) {
            return new Err(undefined);
        }

        const [installObjectManagers, _] = await WirePlumberClient.toLoadedResult(
            (async () => {
                core.install_object_manager(metadataManager);
                this.metadataManager = metadataManager;
                core.install_object_manager(objectManager);
                this.objectManager = objectManager;
            })(),
            "Installed object managers",
            "Failed to install object managers"
        );

        if (!installObjectManagers) {
            return new Err(undefined);
        }

        const mixer = Wp.Plugin.find(core, "mixer-api");
        if (mixer === null) {
            WirePlumberClient.logger.error("Plugin mixer-api not found");
            return new Err(undefined);
        }

        const defaultNode = Wp.Plugin.find(core, "default-nodes-api");
        if (defaultNode === null) {
            WirePlumberClient.logger.error("Plugin default-nodes-api not found");
            return new Err(undefined);
        }

        mixer.connect("changed", (node, id) => {
            print("mixer changed", node, id);
        });

        objectManager.connect("object-added", (self, object) => {
            print("Object added", self, object);
        });
        objectManager.connect("object-removed", (self, object) => {
            print("Object removed", self, object);
        });

        const r = new GLib.Variant("a{sv}", {
            channelVolumes: new GLib.Variant("a{sv}", [
                new GLib.Variant("a{sv}", { channel: new GLib.Variant("s", "FR") }),
                new GLib.Variant("a{sv}", { volume: new GLib.Variant("d", 0.1) }),
                new GLib.Variant("a{sv}", { channel: new GLib.Variant("s", "FR") }),
                new GLib.Variant("a{sv}", { volume: new GLib.Variant("d", 0.9) }),
            ]),
        });

        print(mixer.emit("set-volume", defaultNode.emit("get-default-node", "Audio/Sink"), r));
        const g = new MyObject();
        // GObject.ParamSpec.enum("scale", "scale", "scale", GObject.ParamFlags.CONSTRUCT, GObject. 7, 1)
        // g.bind_property("scale", mixer, "scale", GObject.BindingFlags.BIDIRECTIONAL).connect("notify", () => {
        //     print("haro");
        // })

        mixer.bind_property("scale", g, "scalex", GObject.BindingFlags.DEFAULT);

        // print(.bind_property("scale", g, "scale", GObject.BindingFlags.BIDIRECTIONAL));
        print(g.scale);

        this.core = core;
        this.metadataManager = metadataManager;
        this.objectManager = objectManager;
        return new Ok(undefined);
    }
}

export enum MixerScales {
    LINEAR = "linear",
    CUBIC = "cubic",
}

export class MyObject extends GObject.Object {}

export interface MyObject {
    get scale(): MixerScales;
}

GObject.registerClass(
    {
        GTypeName: "MyObject",
        Properties: {
            scale_: GObject.ParamSpec.string(
                "scale",
                "Scale",
                "Volume scale",
                GObject.ParamFlags.READWRITE,
                MixerScales.CUBIC
            ),
        },
    },
    MyObject
);
