import { readFileAsync, Variable } from "astal";
import { delimiterSplit } from "src/core/string";
import { Poller } from "./poller";
import { Measured } from "src/core/timer";
import { RegexBuilder } from "src/core/regex";
import { EagerPoll } from "../common/variable";
import { Logger } from "src/core/log";
import { wrapIO } from "src/core/matcher/base";

export interface RamStats {
    readonly usage?: number;
}

export class RamPoller implements Poller<RamStats> {
    private static logger: Logger = Logger.get(RamPoller);
    private static MEM_INFO_PATH = "/proc/meminfo";
    private static MEM_INFO_REGEX = RegexBuilder.new()
        .orRegexes(/MemTotal:\s+(?<total>\d+)\skB/, /MemAvailable:\s+(?<available>\d+)\skB/)
        .anchor()
        .build();

    public pollerVariable(frequency: number): Variable<RamStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
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
