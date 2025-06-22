import "./src/types";
import { App } from "astal/gtk3"
import { Baar } from "src/baar";
import { Handler } from "src/core/handler";


App.start({
    instanceName: 'baar',
    requestHandler: Handler.requestHandler,
    main: Baar.init,
});
