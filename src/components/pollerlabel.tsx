import { bind, Binding } from "astal";
import { CpuPoller } from "./stats/cpu";
import { GpuPoller } from "./stats/gpu";
import { RamPoller } from "./stats/ram";

interface PollerLabelProps {
    readonly symbol: string;
    readonly className: string;
    readonly poller: Binding<string>;
    readonly tooltip: string;
}

export const PollerLabel = (props: PollerLabelProps): JSX.Element => {
    return (
        <box className="bar-item poller-item" tooltipText={props.tooltip}>
            <label className={props.className} label={`${props.symbol}┃`} />
            <label label={props.poller} />
        </box>
    );
};

export function fmt(v?: number, floatPoint: number = 1, pad: number = 5): string {
    if (v === undefined) {
        return "";
    }
    return v.toFixed(floatPoint).padStart(pad, " ");
}

export const CPU_POLLER = bind(new CpuPoller().pollerVariable(1000)).as(cpuStats =>
    cpuStats ? `${fmt(cpuStats.usage)}%  ${fmt(cpuStats.temp, 0, 3)}󰔄` : ""
);

export const GPU_POLLER = bind(new GpuPoller().pollerVariable(1000)).as(gpuStats =>
    gpuStats !== null ? `${fmt(gpuStats.cpuUsage)}% ${fmt(gpuStats.ramUsage)}%  ${fmt(gpuStats.temp, 0, 3)}󰔄` : ""
);

export const RAM_POLLER = bind(new RamPoller().pollerVariable(1000)).as(ramStats =>
    ramStats !== null ? `${fmt(ramStats.usage)}%` : ""
);
