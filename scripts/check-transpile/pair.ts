/**
 * Pairs a deleted and an added source file whose paths differ only in extension into one rename.
 *
 * check:transpile asks git for renames, but git matches renamed files by content similarity, and adding
 * types to a small file can change most of its lines. Such a file then shows up as deleted plus added,
 * although it was only renamed (`index.js` → `index.ts`).
 */
export interface Change {
    status: string;
    oldPath: string;
    newPath: string;
}

const CODE = /\.(js|jsx|ts|tsx)$/;

function stem(path: string): string {
    return path.replace(CODE, '');
}

export function pairRenames(changes: Change[]): Change[] {
    const addedByStem = new Map<string, Change>();
    for (const change of changes) {
        if (change.status === 'A' && CODE.test(change.newPath)) addedByStem.set(stem(change.newPath), change);
    }
    const paired = new Set<Change>();
    const result: Change[] = [];
    for (const change of changes) {
        if (change.status === 'D' && CODE.test(change.oldPath)) {
            const added = addedByStem.get(stem(change.oldPath));
            if (added && !paired.has(added)) {
                paired.add(added);
                result.push({ status: 'R', oldPath: change.oldPath, newPath: added.newPath });
                continue;
            }
        }
        result.push(change);
    }
    return result.filter((change) => !paired.has(change));
}
