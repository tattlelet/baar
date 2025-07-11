import { execAsync, Variable } from "astal";
import { delimiterSplit } from "src/core/string";
import { Poller } from "./poller";
import GTop from "gi://GTop?version=2.0";
import { EagerPoll } from "../common/variable";
import { Measured } from "src/core/timer";
import { Logger } from "src/core/log";
import { wrapIO } from "src/core/matcher/base";

export interface CpuStats {
    readonly usage?: number;
    readonly temp?: number;
}

export class CpuPoller implements Poller<CpuStats> {
    private static logger: Logger = Logger.get(this);

    private static TEMP_REGEX = /^(?:Core 0|Tctl|Package id 0):\s+\+(?<temp>\d+\.\d+)/;

    private previousCpuData = new GTop.glibtop_cpu();
    private currentCpuData = new GTop.glibtop_cpu();

    constructor() {
        GTop.glibtop_get_cpu(this.previousCpuData);
        GTop.glibtop_get_cpu(this.currentCpuData);
    }

    public pollerVariable(frequency: number): Variable<CpuStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
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
