import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { boundCall } from "./functions";
import { Measured } from "./timer";
import { Logger } from "./log";
import { Result, Resultify, Err, Ok } from "./matcher/base";
import { Optional } from "./matcher/optional";
import { Asyncify } from "./async/base";

export type HyprctlKeyboard = {
    address: string;
    name: string;
    rules: string;
    model: string;
    layout: string;
    variant: string;
    options: string;
    active_keymap: string;
    main: boolean;
};

type HyprctlMouse = {
    address: string;
    name: string;
    defaultSpeed: number;
};

export type HyprctlDeviceLayout = {
    mice: HyprctlMouse[];
    keyboards: HyprctlKeyboard[];
    tablets: unknown[];
    touch: unknown[];
    switches: unknown[];
};

export type SwitchKeyboardOptions = "next" | "prev";

export class HyprCtl {
    private static logger: Logger = Logger.get(HyprCtl);
    private readonly hyprlandService = AstalHyprland.get_default();
    private readonly hyprlandDispatcher = boundCall(this.hyprlandService, "message");
    private static INSTANCE: HyprCtl = new HyprCtl();

    private constructor() {}

    public static instance(): HyprCtl {
        return this.INSTANCE;
    }

    public async devices(): Promise<Result<HyprctlDeviceLayout, unknown>> {
        return Resultify.promise(Asyncify.from(this.requestDevices.bind(this))()).then(filled =>
            filled.or(err => {
                HyprCtl.logger.except("Failed getting devices info from hyprctl", err);
                return Err.of(err);
            })
        );
    }

    public async mainKeyboard(): Promise<Result<HyprctlKeyboard, unknown>> {
        return this.devices().then(filled =>
            filled.apply(result =>
                Optional.from(result.keyboards.find(kb => kb.main))
                    .map<Result<HyprctlKeyboard, unknown>>(Ok.of)
                    .getOr(Err.of("Failed to find layout"))
            )
        );
    }

    requestDevices(): HyprctlDeviceLayout {
        return JSON.parse(this.hyprlandService.message("j/devices")) as HyprctlDeviceLayout;
    }

    @Measured(HyprCtl.logger.debug)
    public async switchKbLayout(direction: SwitchKeyboardOptions): Promise<void> {
        return this.mainKeyboard().then(filled =>
            filled
                .apply(main => Resultify.from(this.hyprlandDispatcher)(`switchxkblayout ${main.name} ${direction} 2`))
                .match(
                    () => HyprCtl.logger.debug("Switched kb layout successfully"),
                    e => HyprCtl.logger.except("Failed to switch keyboard layout", e)
                )
        );
    }
}

export enum ClientInfoType {
    CLASS = "class",
    INITIAL_TITLE = "initial-title",
    TITLE = "title",
}

export function getClientInfo(client: AstalHyprland.Client, infoType: ClientInfoType): string | undefined {
    switch (infoType) {
        case ClientInfoType.CLASS:
            return client.class;
        case ClientInfoType.TITLE:
            return client.title;
        case ClientInfoType.INITIAL_TITLE:
            return client.initialTitle;
        default:
            return undefined;
    }
}
