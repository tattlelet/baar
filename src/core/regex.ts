import { anyOf, toIterator } from "./iter";

export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class RegexBuilder {
    orPieces: string[] = [];
    readonly regexFlags = new Set<string>();
    shouldAnchor: boolean = false;

    public static new(): RegexBuilder {
        return new RegexBuilder();
    }

    public orStrings(...pieces: string[]): RegexBuilder {
        this.orPieces = this.orPieces.concat(pieces);
        return this;
    }

    public orRegexes(...pieces: RegExp[]): RegexBuilder {
        this.orStrings(...pieces.map(regex => regex.source));
        this.flags(pieces.map(regex => regex.flags).reduce((a, b) => a + b, ""));
        return this;
    }

    public anchor(): RegexBuilder {
        this.shouldAnchor = true;
        return this;
    }

    public flags(flags: string): RegexBuilder {
        flags.split("").forEach(c => this.regexFlags.add(c));
        return this;
    }

    public build(): RegExp {
        let regex = ["(", this.orPieces.join("|"), ")"].join("");

        if (this.shouldAnchor) {
            regex = `^${regex}$`;
        }

        return new RegExp(regex, Array.from(this.regexFlags).join(""));
    }
}

export class RegexMatcher {
    public static matchString(s: string, r: RegExp, ...ensureAll: string[]): Result<RegExpMatchArray, undefined> {
        const match = s.match(r);
        if (match === null || match.groups === undefined) {
            return new Err(undefined);
        }

        if (anyOf(toIterator(ensureAll), item => !(item in match.groups!))) {
            return new Err(undefined);
        }

        return new Ok(match);
    }
}
