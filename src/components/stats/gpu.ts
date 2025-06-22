import { execAsync, Variable } from "astal";
import { Poller } from "./poller";

export interface GpuStats {
    readonly cpuUsage?: number;
    readonly ramUsage?: number;
    readonly temp?: number;
}

export class GpuPoller implements Poller<GpuStats> {
    private static logger: Logger = Logger.get(GpuPoller);

    pollerVariable(frequency: number): Variable<GpuStats> {
        const f = this.stats.bind(this);
        return Variable({}).poll(frequency, f);
    }

    public async stats(): Promise<GpuStats> {
        const cmd = "gpustat --json";

        const gpuJson = (await wrapIO(GpuPoller.logger, execAsync(["bash", "-c", cmd]), `Unable to run ${cmd}`)).match(
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
