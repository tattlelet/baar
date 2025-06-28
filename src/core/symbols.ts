export function toSubscript(num: number): string {
    const subscriptMap: { [key: string]: string } = {
        "0": "₀",
        "1": "₁",
        "2": "₂",
        "3": "₃",
        "4": "₄",
        "5": "₅",
        "6": "₆",
        "7": "₇",
        "8": "₈",
        "9": "₉",
        "-": "₋", // handle negative sign if needed
    };

    return num
        .toString()
        .split("")
        .map(ch => subscriptMap[ch] ?? ch)
        .join("");
}

export function isAtoZ(charCode: number) {
    return charCode < 65 || charCode > 90;
}
