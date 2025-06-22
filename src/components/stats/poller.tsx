import { Binding, Variable } from "astal";

export interface Poller<T> {
    pollerVariable(frequency: number): Variable<T>;
    stats(): Promise<T>;
}

interface PollerLabelProps {
    readonly symbol: string;
    readonly className: string;
    readonly poller: Binding<string>;
}

export const PollerLabel = (props: PollerLabelProps): JSX.Element => {
    return (
        <box className="bar-item">
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
