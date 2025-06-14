import "./src/types";
import { App } from "astal/gtk3"
import { Baar } from "src/baar";

function request_handler(request: string, response: (response: unknown) => void): void {
    console.log(request, response);
    response("I dont do anything yet :)");
}

App.start({
    instanceName: 'baar',
    requestHandler: request_handler,
    main: Baar.init,
});