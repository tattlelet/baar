import { execAsync, Variable } from "astal";
import { Poller } from "./poller";
import { Measured } from "src/core/timer";
import { EagerPoll } from "../common/variable";

export interface GpuStats {
    readonly cpuUsage?: number;
    readonly ramUsage?: number;
    readonly temp?: number;
}

export class GpuPoller implements Poller<GpuStats> {
    private static logger: Logger = Logger.get(GpuPoller);

    public pollerVariable(frequency: number): Variable<GpuStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
    }

    // Todo: use a different strategy, gpustart is taking 181ms
    public async stats(): Promise<GpuStats> {
        const cmd = "gpustat --no-process --json";

        const gpuJson = (await wrapIO(GpuPoller.logger, execAsync(cmd), `Unable to run ${cmd}`)).match(
            v => JSON.parse(v),
            _ => undefined
        );

        if (gpuJson === undefined) {
            return {};
        }

        const cpuUsage =
            gpuJson.gpus.reduce((acc: number, gpu: any) => {
                return acc + gpu["utilization.gpu"];
            }, 0) / gpuJson.gpus.length;

        const ramUsage = gpuJson.gpus.reduce((acc: number, gpu: any) => {
            return acc + gpu["memory.used"];
        }, 0);

        const ramTotal = gpuJson.gpus.reduce((acc: number, gpu: any) => {
            return acc + gpu["memory.total"];
        }, 0);

        const temp =
            gpuJson.gpus.reduce((acc: number, gpu: any) => {
                return acc + gpu["temperature.gpu"];
            }, 0) / gpuJson.gpus.length;

        return {
            cpuUsage: cpuUsage,
            ramUsage: (ramUsage / ramTotal) * 100,
            temp: temp,
        };
    }
}
