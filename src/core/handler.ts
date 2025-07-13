import { GLib } from "astal";
import System from "system";
import { Logger } from "./lang/log";

export class HandlerResponse {
    constructor(
        public readonly status: number,
        public readonly message: string
    ) {}

    public encode(): string {
        return JSON.stringify(this);
    }
}

export class IPCHandler {
    private static logger = Logger.get(IPCHandler);

    public static restartApp(response: (response: unknown) => void): void {
        IPCHandler.logger.info("Restarting Baar...");
        // this is currently only working if initial PID was running in a dev env
        const result = GLib.spawn_command_line_async(`ags run --gtk 3 app.ts &; disown`);
        if (result) {
            response(new HandlerResponse(0, "Restart ok").encode());
            System.exit(0);
        } else {
            response(new HandlerResponse(-1, "Restart failed").encode());
        }
    }

    public static requestHandler(request: string, response: (response: unknown) => void): void {
        IPCHandler.logger.info(request, response);

        switch (request) {
            case "reload":
                IPCHandler.restartApp(response);
                break;
            default:
                response("I dont do anything yet :)");
        }
    }
}
