import { App, Astal, Gdk, Gtk } from "astal/gtk3";
import { Revealer } from "astal/gtk3/widget";
import { MouseEvents } from "./common/events";
import { bind, Binding, execAsync, Gio, GLib, GObject, Variable } from "astal";
import AstalWp from "gi://AstalWp"
import { Separator } from "./common/astalified";
import Wp from 'gi://Wp?version=0.5';
import GtkLayerShell from "gi://GtkLayerShell?version=0.1";
import { runAsyncCommand } from "external/HyprPanel/src/components/bar/utils/input/commandExecutor";
import { WirePlumberClient } from "./wireplumber/client";
import { Logger } from "src/core/log";
import { wrapIO } from "src/core/matcher/base";

const wireplumb = AstalWp.get_default();

const deviceIcons: Record<string, string> = {
    "output+normal": " 󰋋",
    "output+low": " 󰋋",
    "output+muted": "󰟎",
    "input+normal": "    ",
    "input+low": "    ",
    "input+muted": "",
}

export enum ActiveMenu {
    PLAYBACK,
    RECORDING,
    OUTPUT,
    INPUT,
    CONFIG
}

export default async function MixerWindow(): Promise<JSX.Element> {
    const server = WirePlumberClient.instance();
    await server.start().catch(rejection => {
        Logger.get().except("Failed royally", rejection);
        App.quit(1);
    });
    Logger.get().info("Server loaded");

    const activeMenu = new Variable<ActiveMenu>(ActiveMenu.PLAYBACK);

    const playbackMenu = <revealer
        transitionType={Gtk.RevealerTransitionType.CROSSFADE}
        transition_duration={100}
        revealChild={bind(activeMenu).as(menu => menu === ActiveMenu.PLAYBACK)}
    >
        <box
            vertical
            vexpand
            valign={Gtk.Align.START}
            className={"mixer-box"}
        >
            {bind(Variable.derive(
                [
                    bind(wireplumb!.audio, "streams"),
                    bind(wireplumb!, "audio")
                ],
                (streams, ...args: any[]) => {
                    const deviceStreams = streams.sort((a, b) => a.description.localeCompare(b.description)).map(stream => {
                        return [
                            <box
                                hexpand={false}
                                vertical
                                vexpand
                                halign={Gtk.Align.START}
                                className={"stream-name-box"}
                            >
                                <label
                                    className={"stream-name"}
                                    setup={(self) => {
                                        self.label = `${stream.description}: ${stream.name}`;
                                        self.hook(stream, "notify::description", () => {
                                            self.label = `${stream.description}: ${stream.name}`;
                                        });

                                        self.hook(stream, "notify::name", () => {
                                            self.label = `${stream.description}: ${stream.name}`;
                                        });
                                    }}
                                />
                            </box>,
                            <box
                                hexpand={false}
                                vertical
                                vexpand
                                className={"stream-mixer-box"}
                            >
                                <slider
                                    className={"mixer-slider"}
                                    widthRequest={200}
                                    min={0}
                                    max={100}
                                    step={1}
                                    digits={0}
                                    drawValue
                                    setup={(self) => {
                                        self.value = stream.volume * 100
                                        self.hook(stream, "notify::volume", () => {
                                            stream.set_volume
                                            self.value = stream.volume * 100;
                                        });
                                    }}
                                >
                                </slider>
                            </box>
                        ]
                    });

                    return deviceStreams.slice(0, -1).map(stream => <box
                            hexpand
                            vertical
                            vexpand
                            className={"bar-item stream-box"}
                        >
                            {stream}
                            <Separator 
                                className={"stream-separator"}
                            />
                        </box>
                    ).concat([
                        <box
                            hexpand
                            vertical
                            vexpand
                            className={"bar-item stream-box"}
                        >
                            {deviceStreams[deviceStreams.length - 1]}
                        </box>
                    ]);
                }
            ))}
        </box>
    </revealer>

    return <box
        className={"bar-item mixer-window-box"}
        hexpand
        vexpand
    >
        {playbackMenu}
        <revealer
            transitionType={Gtk.RevealerTransitionType.CROSSFADE}
            transition_duration={100}
            visible={false}
            revealChild={bind(activeMenu).as(menu => menu === ActiveMenu.PLAYBACK)}
        >
            <box
                className={"bar-item mixer-box"}
            >
                <label label={"hel2lo"}></label>
                <slider
                    className={"mixer-slider"}
                    width_request={200}
                    min={0}
                    max={100}
                    step={1}
                >
                </slider>
            </box>
        </revealer>
        <revealer
            transitionType={Gtk.RevealerTransitionType.CROSSFADE}
            transition_duration={100}
            visible={false}
            revealChild={bind(activeMenu).as(menu => menu === ActiveMenu.PLAYBACK)}
        >
            <box
                className={"bar-item mixer-box"}
            >
                <label label={"hel3o"}></label>
                <slider
                    className={"mixer-slider"}
                    width_request={200}
                    min={0}
                    max={100}
                    step={1}
                >
                </slider>
            </box>
        </revealer>
    </box>
}


export function getDeviceIcon(device: AstalWp.Endpoint, volume: number, isMuted: boolean): string {
    const iconKeyBuilder: string[] = [];

    switch (device.mediaClass as number) {
        case(1):
            iconKeyBuilder.push("input");
            break;
        case(2):
            iconKeyBuilder.push("output");
            break;
        default:
            iconKeyBuilder.push("default");
            break;
    }

    if (isMuted) {
        iconKeyBuilder.push("muted");
    }
    else if (volume === 0) {
        iconKeyBuilder.push("low");
    }
    else {
        iconKeyBuilder.push("normal");
    }

    const icon = deviceIcons[iconKeyBuilder.join("+")];
    if (icon === undefined) {
        return "💥";
    }

    return icon;
}

export const MixerBadge = (): JSX.Element => {
    const v = Variable.derive(
        [
            bind(wireplumb!, "defaultSpeaker"),
            bind(wireplumb!, "defaultMicrophone")
        ],
        (...devices: AstalWp.Endpoint[]) => {
            return devices.map(device => Variable.derive(
                [
                    bind(device, 'volume'),
                    bind(device, 'mute')
                ],
                (volume, isMuted) => {
                    return getDeviceIcon(device, volume, isMuted);
                })
            )
        }
    )

    // Todo change focus method
    return (
        <box
            className={"bar-item bar-mixer-badge"}
        >
            <button
            cursor={"pointer"}
            className={"bar-mixer-item bar-mixer-output"}
            tooltipText="Output"
            label={bind(v.get()[0])}
            onButtonPressEvent={MouseEvents.onSecondaryHandler(async () => {
                GLib.spawn_command_line_async(`ags run app.ts -a "mixer" &; disown`);
                (await wrapIO(Logger.get(MixerWindow), execAsync(`sh -x -c 'hyprctl dispatch focuswindow address:$(hyprctl clients -j | jq -r ".[] | select(.initialTitle == \\"BaarMixer\\") | .address")'`), "failed running")).match(
                    v => Logger.get(MixerWindow).info(v),
                    e => Logger.get(MixerWindow).except("Unable to open mixer", e),
                )
            })}
            />
            <button
                cursor={"pointer"}
                className={"bar-mixer-item bar-mixer-input"}
                tooltipText="Input"
                label={bind(v.get()[1])}
                onButtonPressEvent={MouseEvents.onSecondaryHandler(async () => {
                    GLib.spawn_command_line_async(`ags run app.ts -a "mixer" &; disown`);
                    (await wrapIO(Logger.get(MixerWindow), execAsync(`sh -x -c 'hyprctl dispatch focuswindow address:$(hyprctl clients -j | jq -r ".[] | select(.initialTitle == \\"BaarMixer\\") | .address")'`), "failed running")).match(
                        v => Logger.get(MixerWindow).info(v),
                        e => Logger.get(MixerWindow).except("Unable to open mixer", e),
                    )
                })}
            />
        </box>
    );
}

