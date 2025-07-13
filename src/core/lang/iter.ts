import { Optional } from "../matcher/optional";

export function allOf<T>(iterator: Iterator<T>, predicate: (item: T) => boolean): boolean {
    let result = iterator.next();
    while (!result.done) {
        if (!predicate(result.value)) return false;
        result = iterator.next();
    }
    return true;
}

export function anyIn<T>(iterator: Iterator<T>, predicate: (item: T) => boolean): Optional<T> {
    let result = iterator.next();
    while (!result.done) {
        if (predicate(result.value)) return Optional.some(result.value);
        result = iterator.next();
    }
    return Optional.none();
}

export function anyOf<T>(iterator: Iterator<T>, predicate: (item: T) => boolean): boolean {
    return anyIn(iterator, predicate)
        .apply(t => true)
        .getOr(false);
}

export function toIterator<T>(input: Iterable<T> | Iterator<T>): Iterator<T> {
    return typeof (input as any)[Symbol.iterator] === "function"
        ? (input as Iterable<T>)[Symbol.iterator]()
        : (input as Iterator<T>);
}
