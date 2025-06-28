export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class RegexBuilder {
    readonly orPieces: string[] = [];
    readonly regexFlags = new Set<string>();
    shouldAnchor: boolean = false;

    public static new(): RegexBuilder {
        return new RegexBuilder();
    }

    public orStrings(...pieces: string[]): RegexBuilder {
        this.orPieces.concat(pieces);
        return this;
    }

    public orRegexes(...pieces: RegExp[]): RegexBuilder {
        this.orStrings(...pieces.map(regex => regex.source));
        this.flags(pieces.map(regex => regex.flags).reduce((a, b) => a + b, ''));
        return this;
    }

    public anchor(): RegexBuilder {
        this.shouldAnchor = true;
        return this;
    }

    public flags(flags: string): RegexBuilder {
        flags.split('').forEach(c => this.regexFlags.add(c));
        return this;
    }

    public build(): RegExp {
        let regex = [
            '(',
            this.orPieces.join('|'),
            ')',
        ].join("");

        if (this.shouldAnchor) {
            regex = `^${regex}$`;
        }

        return new RegExp(regex, Array.from(this.regexFlags).join(''));
    }
}

