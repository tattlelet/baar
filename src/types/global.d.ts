declare global {
    type Nullable<T> = T | null;
    type Undefinable<T> = T | undefined;
    // type JSXElement = JSX.Element | null;
}

export {};