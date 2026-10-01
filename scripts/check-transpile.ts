/**
 * Proves a TypeScript migration changed types only. Run with `pnpm check:transpile`.
 *
 * For every source file under src/ that this branch renamed or modified (compared with --base,
 * default origin/main), it transpiles the base version and the HEAD version with the esbuild that
 * Vite uses and compares the JavaScript. Added files must transpile to nothing but `export {}`
 * (types only). Snapshot files must be byte-identical to the base. It compares commits, so it refuses
 * to run while src/ has uncommitted changes, which it could not see.
 *
 * Usage: pnpm check:transpile [--base <ref>] [--allow <path>]...
 * --allow names a HEAD path whose difference was reviewed and is explained in the PR.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { uncommittedPaths } from './check-transpile/dirty';
import { pairRenames } from './check-transpile/pair';

const argv = process.argv.slice(2);
const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'origin/main';
const allowed = new Set(argv.flatMap((arg, i) => (arg === '--allow' ? [argv[i + 1]] : [])));
const CODE = /\.(js|jsx|ts|tsx)$/;

function git(...args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

async function transpile(path: string, code: string): Promise<string> {
    const result = await transformWithEsbuild(code, path, {
        jsx: 'automatic',
        format: 'esm',
        target: 'esnext',
        sourcemap: false,
        tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true, useDefineForClassFields: true } },
    });
    return result.code;
}

function diff(oldText: string, newText: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'transpile-'));
    writeFileSync(join(dir, 'before.js'), oldText);
    writeFileSync(join(dir, 'after.js'), newText);
    try {
        git('diff', '--no-index', '--no-color', '-U2', join(dir, 'before.js'), join(dir, 'after.js'));
        return '';
    } catch (error) {
        return String((error as { stdout?: string }).stdout ?? error);
    }
}

const uncommitted = uncommittedPaths(git('status', '--porcelain', '--', 'src'));
if (uncommitted.length > 0) {
    console.error('check:transpile compares commits and cannot see uncommitted changes under src/:');
    for (const path of uncommitted) console.error(`  ${path}`);
    console.error('Commit them (or stash them) and run it again.');
    process.exit(1);
}

const problems: string[] = [];
let identical = 0;
let allowedCount = 0;

const changes = pairRenames(
    git('diff', '--name-status', '--find-renames=30%', `${base}...HEAD`, '--', 'src')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const [status, first, second] = line.split('\t');
            return { status, oldPath: first, newPath: status.startsWith('R') ? second : first };
        })
);

for (const { status, oldPath, newPath } of changes) {
    if (newPath.includes('__snapshots__/') || oldPath.includes('__snapshots__/')) {
        problems.push(`${newPath}: snapshot file changed`);
        continue;
    }
    if (!CODE.test(newPath)) continue;
    if (status === 'D') {
        problems.push(`${oldPath}: deleted without a renamed counterpart`);
        continue;
    }
    const after = await transpile(newPath, git('show', `HEAD:${newPath}`));
    if (status === 'A') {
        if (after.trim() === '' || after.trim() === 'export {};') identical++;
        else if (allowed.has(newPath)) allowedCount++;
        else problems.push(`${newPath}: added file emits runtime code\n${after}`);
        continue;
    }
    const before = await transpile(oldPath, git('show', `${base}:${oldPath}`));
    if (before === after) identical++;
    else if (allowed.has(newPath)) allowedCount++;
    else problems.push(`${newPath} (was ${oldPath}): JavaScript output differs\n${diff(before, after)}`);
}

if (problems.length > 0) {
    console.error(problems.join('\n\n'));
    console.error(`\ncheck:transpile: ${problems.length} problem(s); ${identical} identical, ${allowedCount} allowed`);
    process.exit(1);
}
console.log(`check:transpile: OK (${identical} identical, ${allowedCount} allowed, against ${base})`);
