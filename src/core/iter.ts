export function all<T>(iterator: Iterator<T>, predicate: (item: T) => boolean): boolean {
    let result = iterator.next();
    while (!result.done) {
        if (!predicate(result.value)) return false;
        result = iterator.next();
    }
    return true;
}

export function anyOf<T>(iterator: Iterator<T>, predicate: (item: T) => boolean): boolean {
    let result = iterator.next();
    while (!result.done) {
        if (predicate(result.value)) return true;
        result = iterator.next();
    }
    return false;
}

export function toIterator<T>(input: Iterable<T> | Iterator<T>): Iterator<T> {
    return typeof (input as any)[Symbol.iterator] === "function"
        ? (input as Iterable<T>)[Symbol.iterator]()
        : (input as Iterator<T>);
}
