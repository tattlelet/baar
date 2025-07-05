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
    private static logger = Logger.get(RegexMatcher);

    private static REGEX_TYPE_MATCHER = /^\/(?<pattern>.*)\/(?<flags>[gimsuy]+)?$/;

    public static matchString(s: string, r: RegExp, ...ensureAll: string[]): Result<RegExpMatchArray, undefined> {
        const match = s.match(r);
        if (match === null || match.groups === undefined) {
            return new Err(undefined);
        }

        if (anyOf(toIterator(ensureAll), item => !(item in match.groups!) || match.groups![item] === undefined)) {
            return new Err(undefined);
        }

        return new Ok(match);
    }

    public static parse(matcher: string): Result<RegExp, undefined> {
        try {
            return new Ok(
                RegexMatcher.matchString(matcher, RegexMatcher.REGEX_TYPE_MATCHER, "pattern").match(
                    matcher => new RegExp(matcher.groups!.pattern, matcher.groups!.flags),
                    noMatch => {
                        RegexMatcher.logger.warn(`Provided regex ${matcher} will be treated as a string match`);
                        return new RegExp(`${escapeRegExp(matcher)}`);
                    }
                )
            );
        } catch (e) {
            RegexMatcher.logger.warn(`Bad regex provided: ${matcher}`);
            return new Err(undefined);
        }
    }
}
