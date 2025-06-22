import { Variable } from "astal";

export interface Poller<T> {
    pollerVariable(frequency: number): Variable<T>;
    stats(): Promise<T>;
}
