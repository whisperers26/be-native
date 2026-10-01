/**
 * Lists the paths `git status --porcelain` reports, as git prints them (a rename as `old -> new`).
 *
 * check:transpile compares commits, so it cannot see changes that are not committed yet; it refuses
 * to run while this list is not empty for src/, instead of reporting OK for work it never read.
 */
export function uncommittedPaths(porcelain: string): string[] {
    return porcelain
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.slice(3));
}
