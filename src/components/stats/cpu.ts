import { bind, execAsync, Variable } from "astal";
import { delimiterSplit } from "src/core/string";
import { fmt, Poller } from "./poller";
import GTop from "gi://GTop?version=2.0";

export interface CpuStats {
    readonly usage?: number;
    readonly temp?: number;
}

export class CpuPoller implements Poller<CpuStats> {
    private static logger: Logger = Logger.get(CpuPoller);

    private static TEMP_REGEX = /^(?:Core 0|Tctl|Package id 0):\s+\+(?<temp>\d+\.\d+)/;

    private previousCpuData = new GTop.glibtop_cpu();
    private currentCpuData = new GTop.glibtop_cpu();

    constructor() {
        GTop.glibtop_get_cpu(this.previousCpuData);
        GTop.glibtop_get_cpu(this.currentCpuData);
    }

    public pollerVariable(frequency: number): Variable<CpuStats> {
        const f = this.stats.bind(this);
        return new Variable({} as CpuStats).poll(frequency, f);
    }

    private async usage(): Promise<number> {
        const totalDiff = this.currentCpuData.total - this.previousCpuData.total;
        const idleDiff = this.currentCpuData.idle - this.previousCpuData.idle;

        const usage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;

        this.previousCpuData = this.currentCpuData;

        return usage;
    }

    private async temp(): Promise<number | undefined> {
        const cmd = "sensors";
        const content = (await wrapIO(CpuPoller.logger, execAsync(cmd), `Problem running ${cmd}`)).match(
            v => v || undefined,
            e => undefined
        );

        if (content === undefined) {
            return undefined;
        }

        for (const line of delimiterSplit(content, "\n")) {
            const match = line.match(CpuPoller.TEMP_REGEX);
            if (match !== null && match.groups !== undefined) {
                return Number(match.groups.temp);
            }
        }
    }

    public async stats(): Promise<CpuStats> {
        this.currentCpuData = new GTop.glibtop_cpu();
        GTop.glibtop_get_cpu(this.currentCpuData);

        return {
            usage: await this.usage(),
            temp: await this.temp(),
        };
    }
}

export const CPU_POLLER = bind(new CpuPoller().pollerVariable(1000)).as(
    cpuStats => `${fmt(cpuStats.usage)}% ${fmt(cpuStats.temp)}󰔄`
);
