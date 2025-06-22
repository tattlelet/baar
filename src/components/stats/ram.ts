import { bind, readFileAsync, Variable } from "astal";
import { delimiterSplit } from "src/core/string";
import { fmt, Poller } from "./poller";

export interface RamStats {
    readonly usage?: number;
}

export class RamPoller implements Poller<RamStats> {
    private static logger: Logger = Logger.get(RamPoller);
    private static MEM_INFO_PATH = "/proc/meminfo";
    private static MEM_INFO_REGEX = new RegExp(
        ["^(", ["MemTotal:\\s+(?<total>\\d+)\\skB", "MemAvailable:\\s+(?<available>\\d+)\\skB"].join("|"), ")$"].join(
            ""
        )
    );

    public pollerVariable(frequency: number): Variable<RamStats> {
        const f = this.stats.bind(this);
        return new Variable({} as RamStats).poll(frequency, f);
    }

    public async stats(): Promise<RamStats> {
        const content = (
            await wrapIO(RamPoller.logger, readFileAsync(RamPoller.MEM_INFO_PATH), "Failed to read config file")
        ).match(
            v => v,
            _ => undefined
        );

        if (content === undefined) {
            return {};
        }

        let total: number | undefined;
        let available: number | undefined;
        let usage: number | undefined;
        for (const line of delimiterSplit(content, "\n")) {
            const match = line.match(RamPoller.MEM_INFO_REGEX);
            if (match === null || match.groups === undefined) {
                continue;
            }

            if ("total" in match.groups && match.groups.total !== undefined) {
                total = Number(match.groups.total);
            } else if ("available" in match.groups && match.groups.available !== undefined) {
                available = Number(match.groups.available);
            }

            if (total !== undefined && available !== undefined) {
                usage = (Math.abs(available - total) / total) * 100;
                break;
            }
        }

        return {
            usage: usage,
        };
    }
}

export const RAM_POLLER = bind(new RamPoller().pollerVariable(1000)).as(ramStats => `${fmt(ramStats.usage)}%`);
