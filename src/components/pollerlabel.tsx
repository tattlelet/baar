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

export function fmt(v?: number): string {
    if (v === undefined) {
        return "";
    }
    return v.toFixed(1).padStart(5, " ");
}

export const CPU_POLLER = bind(new CpuPoller().pollerVariable(1000)).as(
    cpuStats => `${fmt(cpuStats.usage)}% ${fmt(cpuStats.temp)}󰔄`
);

export const GPU_POLLER = bind(new GpuPoller().pollerVariable(1000)).as(
    gpuStats => `${fmt(gpuStats.cpuUsage)}% ${fmt(gpuStats.ramUsage)}%  ${gpuStats.temp}󰔄`
);

export const RAM_POLLER = bind(new RamPoller().pollerVariable(1000)).as(ramStats => `${fmt(ramStats.usage)}%`);
