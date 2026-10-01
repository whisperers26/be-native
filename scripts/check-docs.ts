/**
 * Checks the agent docs and the READMEs. Run with `pnpm check:docs`.
 *
 * 1. Relative links (markdown and HTML src/href) point at files or folders that exist.
 * 2. README.md, README_EN.md and README_KR.md each have one fork section
 *    (<!-- fork:start --> ... <!-- fork:end -->) with the same number of bullets.
 * 3. AGENTS.md stays short and links every page in docs/agents/.
 * 4. Every `gh pr <subcommand>` in the agent docs targets the fork with --repo.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const READMES = ['README.md', 'README_EN.md', 'README_KR.md'];
const WIKI_DIR = 'docs/agents';
const AGENTS_MAX_LINES = 120;
const FORK_REPO = 'whisperers26/be-native';

const MD_LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_LINK = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
const NOT_A_PATH = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;
const BULLET = /^\s*(?:>\s*)*[-*+]\s+\S/;
const GH_PR =
    /\bgh pr (?:create|merge|checks|view|edit|close|reopen|ready|review|comment|diff|status|list)\b/;

const problems: string[] = [];

function readLines(file: string): string[] {
    return readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);
}

function listWikiPages(): string[] {
    const dir = join(ROOT, WIKI_DIR);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((name) => name.endsWith('.md'))
        .map((name) => `${WIKI_DIR}/${name.replaceAll('\\', '/')}`)
        .sort();
}

// Blank out fenced code blocks and inline code: example snippets are not links.
// Line count is kept so reported line numbers stay right.
function withoutCode(lines: string[]): string[] {
    let inFence = false;
    return lines.map((line) => {
        if (/^\s*(?:```|~~~)/.test(line)) {
            inFence = !inFence;
            return '';
        }
        return inFence ? '' : line.replace(/`[^`]*`/g, '');
    });
}

function resolveTarget(file: string, target: string): string {
    const path = decodeURIComponent(target.split(/[?#]/)[0]);
    return path.startsWith('/') ? join(ROOT, path) : resolve(ROOT, dirname(file), path);
}

function checkLinks(file: string, lines: string[]): number {
    let count = 0;
    withoutCode(lines).forEach((line, index) => {
        for (const regex of [MD_LINK, HTML_LINK]) {
            for (const match of line.matchAll(regex)) {
                const target = match[1];
                if (NOT_A_PATH.test(target)) continue;
                count++;
                if (!existsSync(resolveTarget(file, target))) {
                    problems.push(`${file}:${index + 1}: broken link "${target}"`);
                }
            }
        }
    });
    return count;
}

function checkGhCommands(file: string, lines: string[]): void {
    lines.forEach((line, index) => {
        if (GH_PR.test(line) && !line.includes(`--repo ${FORK_REPO}`)) {
            problems.push(`${file}:${index + 1}: gh pr command without --repo ${FORK_REPO}`);
        }
    });
}

function checkAgentsIndex(lines: string[], wikiPages: string[]): void {
    const length = lines.join('\n').trimEnd().split('\n').length;
    if (length > AGENTS_MAX_LINES) {
        problems.push(`AGENTS.md: ${length} lines; keep it at ${AGENTS_MAX_LINES} or fewer and move detail into ${WIKI_DIR}/`);
    }
    const linked = new Set<string>();
    for (const line of withoutCode(lines)) {
        for (const match of line.matchAll(MD_LINK)) {
            if (!NOT_A_PATH.test(match[1])) linked.add(resolveTarget('AGENTS.md', match[1]));
        }
    }
    for (const page of wikiPages) {
        if (!linked.has(resolve(ROOT, page))) {
            problems.push(`AGENTS.md: ${page} is not linked from the wiki index`);
        }
    }
}

function checkForkSections(): void {
    const counts = new Map<string, number>();
    for (const readme of READMES) {
        if (!existsSync(join(ROOT, readme))) continue;
        const lines = readLines(readme);
        const starts = lines.flatMap((line, i) => (line.trim() === '<!-- fork:start -->' ? [i] : []));
        const ends = lines.flatMap((line, i) => (line.trim() === '<!-- fork:end -->' ? [i] : []));
        if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
            problems.push(`${readme}: needs exactly one <!-- fork:start --> ... <!-- fork:end --> section`);
            continue;
        }
        counts.set(readme, lines.slice(starts[0] + 1, ends[0]).filter((line) => BULLET.test(line)).length);
    }
    if (new Set(counts.values()).size > 1) {
        const summary = [...counts].map(([readme, n]) => `${readme}=${n}`).join(', ');
        problems.push(`fork sections have different bullet counts (${summary}); update all three READMEs together`);
    }
}

const wikiPages = listWikiPages();
const files = ['AGENTS.md', ...READMES, ...wikiPages];
let linkCount = 0;
for (const file of files) {
    if (!existsSync(join(ROOT, file))) {
        problems.push(`${file}: missing`);
        continue;
    }
    const lines = readLines(file);
    linkCount += checkLinks(file, lines);
    if (file === 'AGENTS.md' || file.startsWith(`${WIKI_DIR}/`)) checkGhCommands(file, lines);
    if (file === 'AGENTS.md') checkAgentsIndex(lines, wikiPages);
}
checkForkSections();

if (problems.length > 0) {
    console.error(problems.join('\n'));
    console.error(`\ncheck:docs: ${problems.length} problem(s)`);
    process.exit(1);
}
console.log(`check:docs: OK (${files.length} files, ${linkCount} relative links)`);
