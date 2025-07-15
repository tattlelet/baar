import { Gio, Variable } from "astal";
import GTop from "gi://GTop?version=2.0";
import { Logger } from "src/core/lang/log";
import { EagerPoll } from "../common/variable";
import { Poller } from "./poller";
import { Optional } from "src/core/matcher/optional";
import { gobbler, tryLoadFileTrimmedSafe as readContent } from "src/core/files";

export interface CpuStats {
    readonly usage?: number;
    readonly temp?: number;
}

export class CpuPoller implements Poller<CpuStats> {
    private static readonly logger: Logger = Logger.get(this);
    private static readonly HWMON_PATH = "/sys/class/hwmon";
    private static readonly MATCH_LABELS = ["tctl", "package", "cpu", "core", "die"];

    private previousCpuData = new GTop.glibtop_cpu();
    private currentCpuData = new GTop.glibtop_cpu();
    private cachedTempInputPath: Optional<string> = Optional.none();

    constructor() {
        GTop.glibtop_get_cpu(this.previousCpuData);
        GTop.glibtop_get_cpu(this.currentCpuData);
    }

    public pollerVariable(frequency: number): Variable<CpuStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
    }

    private async usage(): Promise<number> {
        this.currentCpuData = new GTop.glibtop_cpu();
        GTop.glibtop_get_cpu(this.currentCpuData);

        const totalDiff = this.currentCpuData.total - this.previousCpuData.total;
        const idleDiff = this.currentCpuData.idle - this.previousCpuData.idle;

        const usage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;

        this.previousCpuData = this.currentCpuData;

        return usage;
    }

    private findTempInputPath(cached: boolean = true): Optional<string> {
        if (cached && this.cachedTempInputPath.isSome()) {
            return this.cachedTempInputPath;
        }

        for (const hwmon of gobbler(Gio.File.new_for_path(CpuPoller.HWMON_PATH))) {
            const chipNameOpt = readContent(Optional.from(hwmon.get_child("name")));
            if (chipNameOpt.isNone()) {
                continue;
            }

            for (const child of gobbler(hwmon)) {
                const fname = child.get_basename();
                if (!fname || !fname.startsWith("temp") || !fname.endsWith("_label")) {
                    continue;
                }

                const labelOpt = readContent(Optional.from(child));
                if (labelOpt.isNone()) {
                    continue;
                }

                const labelText = labelOpt.unwrap().toLowerCase();

                if (CpuPoller.MATCH_LABELS.some(l => labelText.includes(l))) {
                    const inputFileName = fname.replace("_label", "_input");
                    const inputFile = hwmon.get_child(inputFileName);
                    if (inputFile.query_exists(null)) {
                        const pathOpt = Optional.from(inputFile.get_path());
                        if (pathOpt.isSome()) {
                            this.cachedTempInputPath = pathOpt;
                            return pathOpt; // found valid input file path
                        }
                    }
                }
            }
        }

        return Optional.none();
    }

    private readCpuTempFromFile(path: string): Optional<number> {
        const file = Gio.File.new_for_path(path);
        return readContent(Optional.from(file)).flatMap(raw => {
            const val = parseInt(raw, 10);

            if (Number.isNaN(val)) {
                return Optional.none();
            } else {
                return Optional.some(val / 1000);
            }
        });
    }

    private async temp(): Promise<Optional<number>> {
        const foundPathOpt = this.findTempInputPath();
        if (foundPathOpt.isSome()) {
            return this.readCpuTempFromFile(foundPathOpt.unwrap());
        }

        return Optional.none();
    }

    public async stats(): Promise<CpuStats> {
        return Promise.all([this.usage(), this.temp()]).then(([usage, temp]) => {
            return {
                usage: usage,
                temp: temp.get(),
            };
        });
    }
}
