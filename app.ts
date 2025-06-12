import { App } from "astal/gtk3"
import style from "./style.scss"
import { Baar } from "src/baar";


function request_handler(request: string, response: (response: unknown) => void): void {
    console.log(request, response);
    response("I dont do anything yet :)");
}

App.start({
    css: style,
    instanceName: 'baar',
    requestHandler: request_handler,
    main: Baar.init,
});