export function* delimiterSplit(str: string, delimiter: string): Generator<string> {
    let start = 0;

    for (let i = 0; i < str.length; i++) {
        if (str[i] === delimiter) {
            yield str.slice(start, i);
            start = i + 1;
        }
    }

    yield str.slice(start);
}
