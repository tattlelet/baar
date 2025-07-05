import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { wrapAsync } from "./async";
import { execAsync } from "astal";

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
    private static INSTANCE: HyprCtl = new HyprCtl();

    private constructor() {}

    public static instance(): HyprCtl {
        return this.INSTANCE;
    }

    public async devices(): Promise<Result<HyprctlDeviceLayout, unknown>> {
        return wrapIO(
            HyprCtl.logger,
            wrapAsync(this.requestDevices.bind(this))(),
            "Failed getting devices info from hyprctl"
        );
    }

    public async mainKeyboard(): Promise<Result<HyprctlKeyboard, unknown>> {
        const result = await this.devices();

        if (result.isErr()) {
            return new Err<unknown>(result.value);
        }

        const main = (result as Ok<HyprctlDeviceLayout>).value.keyboards.find(kb => kb.main);

        if (main === undefined) {
            return new Err<unknown>(Error("Failed to find layout"));
        }

        return new Ok(main);
    }

    private requestDevices(): HyprctlDeviceLayout {
        return JSON.parse(this.hyprlandService.message("j/devices")) as HyprctlDeviceLayout;
    }

    public async switchKbLayout(direction: SwitchKeyboardOptions): Promise<void> {
        (await this.mainKeyboard()).match(
            main => {
                const cmd = `hyprctl switchxkblayout ${main.name} ${direction}`;
                wrapIO(HyprCtl.logger, execAsync(cmd), `Failed executing ${cmd}`);
            },
            e => {
                HyprCtl.logger.warn("Failed to switch kb layout", e);
            }
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
