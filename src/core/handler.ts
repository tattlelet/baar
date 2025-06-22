import { GLib } from "astal";
import System from "system";

export class HandlerResponse {
    constructor(
        public readonly status: number,
        public readonly message: string
    ) {}

    public encode(): string {
        return JSON.stringify(this);
    }
}

export class Handler {
    private static logger = Logger.get(Handler);

    public static restartApp(response: (response: unknown) => void): void {
        Handler.logger.info("Restarting Baar...");
        const result = GLib.spawn_command_line_async(`ags run app.ts`);
        if (result) {
            response(new HandlerResponse(0, "Restart ok").encode());
            System.exit(0);
        } else {
            response(new HandlerResponse(-1, "Restart failed").encode());
        }
    }

    public static requestHandler(request: string, response: (response: unknown) => void): void {
        Handler.logger.info(request, response);

        switch (request) {
            case "reload":
                Handler.restartApp(response);
                break;
            default:
                response("I dont do anything yet :)");
        }
    }
}
