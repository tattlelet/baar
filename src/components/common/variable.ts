import { Variable } from "astal";

export class EagerPoll {
    public static create<T>(frequency: number, f: () => Promise<T>): Variable<T | null> {
        const v = new Variable<T | null>(null);

        (async () => {
            v.set(await f());
        })();

        return v.poll(frequency, f);
    }
}
