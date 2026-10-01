# Fork Foundation, Plan 1 of 3: Workflow, Agent Wiki, README, CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main` the fork's working branch and give every agent the rules, a wiki, a CI gate, and READMEs that describe the fork.

**Architecture:** Repository changes are made with `gh` against `whisperers26/be-native` only. Documentation is a short root `AGENTS.md` that indexes one-topic pages in `docs/agents/`. `pnpm check:docs`, a small TypeScript script run with `tsx`, keeps links, the README fork sections, the index, and `gh pr` commands honest. CI is a new GitHub Actions workflow on PRs to `main`; upstream's release workflow becomes manual-only.

**Tech Stack:** git 2.45, GitHub CLI 2.96, GitHub Actions (`ubuntu-latest`), pnpm 10.14.0, Node per `.node-version`, tsx, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-30-fork-foundation-design.md`. This plan covers spec section 1 (repository and workflow), section 4 (agent wiki and README) as far as it describes the current JavaScript code, and steps 1–4 of section 5. Plan 2 (tests) and Plan 3 (TypeScript) are written when their phases start; each adds its own pages and README bullets.

## Global Constraints

- Every push, PR, and `gh` call targets `whisperers26/be-native`. Never `pot-app/pot-desktop`. No `upstream` remote.
- Main branch: `main`. Branch names: `<type>/<slug>`, type one of `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`.
- Merge only after local checks and CI pass: `gh pr merge <n> --repo whisperers26/be-native --merge --delete-branch`. Never squash.
- The owner's commit rules: small commits, one topic each; mechanical changes (moves, renames, extractions) in their own commits; commit at each working step; only stage the files the commit is about.
- Every README change touches all three: `README.md` (Chinese), `README_EN.md`, `README_KR.md`.
- `AGENTS.md`: about 80 lines; it indexes one-topic pages in `docs/agents/`.
- `"packageManager": "pnpm@10.14.0"`.

## Review Focus

1. A PR opened from the fork lands on archived upstream `pot-app/pot-desktop`, because `gh pr create` in a fork can default to the parent repository. Expected: every PR is on `whisperers26/be-native`. Pinned in Task 1 (`gh repo set-default`), Task 3 (`check:docs` rejects `gh pr` commands without `--repo whisperers26/be-native`), and every PR step (assert the PR URL).
2. A tag push fires upstream's release workflow, which then attempts a signed multi-platform release without its secrets. Expected: nothing runs on tags. Pinned in Task 6 (assert `package.yml`'s only trigger is `workflow_dispatch`).
3. The local clone, and RustRover's Git widget, keep tracking the deleted `master`, so `git pull` fails. Expected: `main` tracks `origin/main`, and `origin/HEAD` points at it. Pinned in Task 1.
4. A wiki or README link breaks, most likely when Plan 3 renames `.jsx` files to `.tsx`, and agents silently lose context. Expected: `pnpm check:docs` fails on it, locally and in CI. Pinned in Task 4 (negative test) and Task 6 (CI step).
5. One README gets a new fork bullet and the other two do not. Expected: `pnpm check:docs` fails until all three match. Pinned in Task 4 (negative test).

---

### Task 1: Switch the fork to `main`

No files change: this is repository and clone configuration. Do it before opening any PR so every PR targets `main`.

**Files:** none.

**Interfaces:**
- Produces: default branch `main` on `whisperers26/be-native`; local `main` tracking `origin/main`; `gh` default repository `whisperers26/be-native`; "automatically delete head branches" turned on.

- [ ] **Step 1: Check the starting state**

```bash
gh repo view whisperers26/be-native --json defaultBranchRef,isFork --jq '"\(.defaultBranchRef.name) \(.isFork)"'
git status --short
git branch --show-current
```

Expected: `master true`; no status output; `docs/fork-foundation-spec`.

- [ ] **Step 2: Rename the branch on GitHub**

```bash
gh api -X POST repos/whisperers26/be-native/branches/master/rename -f new_name=main --jq .name
```

Expected: `main`. The rename also makes `main` the default branch.

- [ ] **Step 3: Update the local clone**

```bash
git branch -m master main
git fetch origin --prune
git branch -u origin/main main
git remote set-head origin -a
```

Expected: the last command prints `origin/HEAD set to main`.

- [ ] **Step 4: Pin gh to the fork and turn on branch cleanup**

```bash
gh repo set-default whisperers26/be-native
gh api -X PATCH repos/whisperers26/be-native -F delete_branch_on_merge=true --jq .delete_branch_on_merge
```

Expected: the second command prints `true`.

- [ ] **Step 5: Verify (Review Focus 1 and 3)**

```bash
gh repo view whisperers26/be-native --json defaultBranchRef --jq .defaultBranchRef.name
git ls-remote --heads origin master
git ls-remote --heads origin main
git rev-parse --abbrev-ref main@{upstream}
git symbolic-ref refs/remotes/origin/HEAD
gh repo set-default --view
git remote -v
```

Expected, line by line: `main`; no output; one line ending in `refs/heads/main`; `origin/main`; `refs/remotes/origin/main`; `whisperers26/be-native`; only `origin` pointing at `https://github.com/whisperers26/be-native`. If RustRover's Git widget still shows `master`, run Git > Fetch in the IDE.

---

### Task 2: Land the spec and this plan

**Files:** both already committed on `docs/fork-foundation-spec`:
- `docs/superpowers/specs/2026-09-30-fork-foundation-design.md`
- `docs/superpowers/plans/2026-09-30-fork-foundation-1-workflow-docs-ci.md`

**Interfaces:**
- Consumes: Task 1's `main`.
- Produces: the first merged PR on `main`, which exercises the PR flow end to end.

- [ ] **Step 1: Confirm the branch holds only the two documents**

```bash
git switch docs/fork-foundation-spec
git diff --stat main...HEAD
```

Expected: exactly the spec and this plan.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --repo whisperers26/be-native --base main --head docs/fork-foundation-spec \
  --title "Add the fork foundation spec and plan 1" \
  --body "Design spec for the fork foundation work (workflow rules, agent wiki, tests, TypeScript migration) and the implementation plan for its first phase (main branch, agent docs, README fork section, CI). Docs only."
```

- [ ] **Step 3: Verify the PR is on the fork (Review Focus 1)**

```bash
gh pr view docs/fork-foundation-spec --repo whisperers26/be-native --json url,baseRefName --jq '"\(.url) \(.baseRefName)"'
```

Expected: `https://github.com/whisperers26/be-native/pull/<n> main`.

- [ ] **Step 4: Merge with a merge commit and sync**

There is no CI yet (Task 6 adds it) and the change is docs-only, so merge now.

```bash
gh pr merge docs/fork-foundation-spec --repo whisperers26/be-native --merge --delete-branch
git switch main
git pull --ff-only
git log --oneline -1
```

Expected: `Merge pull request #<n> from whisperers26/docs/fork-foundation-spec`.

---

### Task 3: The docs check

Branch `docs/agents-wiki`, which Tasks 3, 4 and 5 share and Task 5 ships as one PR.

**Files:**
- Create: `scripts/check-docs.ts`
- Modify: `package.json` (add `tsx` to devDependencies and a `check:docs` script)
- Modify: `pnpm-lock.yaml` (through `pnpm add`)

**Interfaces:**
- Produces: `pnpm check:docs`. Exit 0 means the docs are consistent. Exit 1 prints one `path[:line]: problem` per line, then a count. Its rules, which Tasks 4–6 and later plans must satisfy:
  - Relative links (markdown `[]()` and HTML `src=`/`href=`) in `AGENTS.md`, the three READMEs, and `docs/agents/**/*.md` resolve to an existing file or directory. Code blocks and inline code are not checked for links.
  - Each README has exactly one `<!-- fork:start -->` … `<!-- fork:end -->` section, and all three sections have the same number of bullet lines.
  - `AGENTS.md` exists, has at most 120 lines, and links every page in `docs/agents/`.
  - In `AGENTS.md` and `docs/agents/`, every line with `gh pr <subcommand>` contains `--repo whisperers26/be-native`.

- [ ] **Step 1: Branch from an up-to-date main**

```bash
git switch main && git pull --ff-only
git switch -c docs/agents-wiki
```

- [ ] **Step 2: Add tsx**

```bash
pnpm add -D tsx
```

Expected: `tsx` appears under `devDependencies` in `package.json`, and `pnpm-lock.yaml` changes.

- [ ] **Step 3: Write `scripts/check-docs.ts`**

```ts
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
```

- [ ] **Step 4: Add the script to `package.json`**

In `"scripts"`, after `"updater:fixRuntime"`, add:

```json
        "check:docs": "tsx scripts/check-docs.ts"
```

(Add a comma after the `"updater:fixRuntime"` line.)

- [ ] **Step 5: Run it and watch it fail for the right reasons**

Run: `pnpm check:docs`

Expected: exit code 1 and exactly these four problems (upstream's READMEs have no broken relative links today):

```
AGENTS.md: missing
README.md: needs exactly one <!-- fork:start --> ... <!-- fork:end --> section
README_EN.md: needs exactly one <!-- fork:start --> ... <!-- fork:end --> section
README_KR.md: needs exactly one <!-- fork:start --> ... <!-- fork:end --> section
```

- [ ] **Step 6: Commit**

```bash
git add scripts/check-docs.ts package.json pnpm-lock.yaml
git commit -m "Add a docs check for links, README fork sections and the agent index"
```

---

### Task 4: Rules and the fork notice

Same branch, `docs/agents-wiki`.

**Files:**
- Create: `docs/agents/git-workflow.md`, `AGENTS.md`, `CLAUDE.md`
- Modify: `README.md`, `README_EN.md`, `README_KR.md`

**Interfaces:**
- Consumes: `pnpm check:docs` (Task 3).
- Produces: the `AGENTS.md` wiki index table (columns `Read` | `When you are`), to which Task 5, Task 6 and later plans append rows; the README fork sections with two bullets each, to which later tasks append one bullet per README.

- [ ] **Step 1: Write `docs/agents/git-workflow.md`**

````markdown
# Git workflow

How every change reaches this repository, whichever agent makes it. The owner
can override any of this for a single task by saying so.

## Repositories

- Work happens in the fork `whisperers26/be-native`. Upstream
  `pot-app/pot-desktop` is archived: never push to it, open PRs against it, or
  file issues there.
- `origin` is the fork. Do not add an `upstream` remote.
- `gh` is pinned to the fork (`gh repo set-default whisperers26/be-native`),
  but every `gh pr` command still names it with `--repo`.

## Branches

`main` is the only long-lived branch. Never commit to it directly. Each
feature or fix gets its own branch, cut from an up-to-date `main`:

```bash
git switch main && git pull --ff-only
git switch -c <type>/<slug>
```

`<type>` is one of `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`.
`<slug>` is a few lowercase words joined by `-`, for example
`fix/ocr-empty-result`.

## Commits

Small commits, one topic each. A commit should show its own change and nothing
else, so it reads on its own and can be reverted on its own.

- Keep the topic itself small. "Implement X" is not a topic, it is a pile of
  them — break the work into steps that each stand up alone (the data shape,
  then the behaviour, then what is drawn, then the wiring) and commit each as
  it works. A commit whose message needs "and" in it, or whose diff spans a
  feature's whole surface, should have been several.
- Never bundle two topics because they happened in the same session or touch
  the same file. Two fixes are two commits; a fix and a colour tweak are two
  commits.
- Keep mechanical changes out of behavioural ones. A move, rename or
  extraction is its own commit with no behaviour change in it, and a behaviour
  change carries no drive-by refactor. If a fix needs code moved first, that
  is two commits: move, then fix.
- Commit at each working step as the work goes, not in one batch at the end.
- Split a commit that turned out to hold more than one topic, rather than
  leaving it (reset and recommit while it is unpushed).
- Only stage the files the commit is about. Leave files the owner changed, or
  that tooling rewrote, out of it — say so instead of sweeping them in.

Messages: an imperative subject line under 72 characters; after a blank line,
say why when the diff does not make it obvious.

## Pull requests

1. If `main` moved on, rebase the branch onto it before opening the PR.
2. Run the local checks listed in the Commands table of `AGENTS.md`.
3. Push and open the PR against the fork. The description says what changed,
   why, and how it was verified, and lists any bug found but not fixed.

   ```bash
   git push -u origin HEAD
   gh pr create --repo whisperers26/be-native --base main --fill
   ```

4. Wait for CI to pass:

   ```bash
   gh pr checks <branch> --repo whisperers26/be-native --watch
   ```

5. Merge with a merge commit. Never squash: squashing collapses the small
   commits above into one.

   ```bash
   gh pr merge <branch> --repo whisperers26/be-native --merge --delete-branch
   git switch main && git pull --ff-only
   ```

### When the owner asks to review

If the owner explicitly asks to review a PR themselves, open it, report the
link, and stop. Do not merge it.

## Keeping docs true

Every PR updates the docs its change makes wrong:

- READMEs: when a change affects what a README reader sees — features,
  requirements, install, build or run commands, or the list of changes in this
  fork — update all three: `README.md` (Chinese), `README_EN.md`,
  `README_KR.md`. The fork section sits between `<!-- fork:start -->` and
  `<!-- fork:end -->` and must have the same bullets in all three languages.
- Wiki: update the `docs/agents/` pages that became wrong. A new page gets a
  row in the wiki index in `AGENTS.md`.
- `pnpm check:docs` must pass.
````

- [ ] **Step 2: Write `AGENTS.md`**

```markdown
# AGENTS.md

Entry point for AI agents working in this repository. It stays short on
purpose: the detail lives in one-topic wiki pages under `docs/agents/`, so
read only the pages your task needs.

## What this is

Be Native, the owner's fork of [Pot](https://github.com/pot-app/pot-desktop),
a cross-platform translation and OCR desktop app, continued after upstream was
archived. It is a Tauri 1 app: a Rust backend in `src-tauri/` and a React 18
frontend in `src/`.

## Rules

1. Never commit to `main`. Work on one branch per feature or fix, open a PR to
   the fork, and merge it yourself with a merge commit once the checks pass.
   Procedure: [git-workflow.md](docs/agents/git-workflow.md).
2. If the owner explicitly asks to review a PR, open it and stop. Do not merge.
3. Never push to, open PRs against, or add a remote for upstream
   `pot-app/pot-desktop`. Every `gh pr` command takes
   `--repo whisperers26/be-native`.
4. Small commits, one topic each. Renames and moves get their own commits.
   Stage only the files the commit is about.
5. Keep the docs true in the same PR: all three READMEs (`README.md`,
   `README_EN.md`, `README_KR.md`) when something a reader sees changes, and
   the wiki pages your change makes wrong.
6. A refactor does not change runtime behaviour. If you find a bug on the way,
   note it in the PR description and fix it on its own branch.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install frontend dependencies |
| `pnpm tauri dev` | Run the app: Vite on port 1420 plus a Rust debug build |
| `pnpm build` | Build the frontend into `dist/` |
| `pnpm check:docs` | Check doc links, README fork sections, and this index |

Before opening a PR, run `pnpm check:docs` and `pnpm build`.

## Wiki

| Read | When you are |
| --- | --- |
| [git-workflow.md](docs/agents/git-workflow.md) | Branching, committing, opening or merging a PR |
```

- [ ] **Step 3: Write `CLAUDE.md`**

```markdown
<!-- Claude Code reads this file. The rules for every agent live in AGENTS.md. -->
@AGENTS.md
```

- [ ] **Step 4: Add the fork section to the three READMEs**

In each README, insert the block below between the last badge line
(`![Linux](...)`) and the `<br/>` line that follows it, with one blank line
before and after the block.

`README.md`:

```markdown
<!-- fork:start -->

> [!NOTE]
> **Be Native** 是 Pot 的个人分支（fork）。上游仓库 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) 已归档，开发在 [whisperers26/be-native](https://github.com/whisperers26/be-native) 继续进行。本分支不发布安装包，下文的安装说明安装的是上游的 Pot。
>
> 本分支的改动：
>
> - 主分支为 `main`，所有改动都通过 Pull Request 合并。
> - AI 代理按照 [AGENTS.md](./AGENTS.md) 及 [docs/agents](./docs/agents/) 中的 wiki 工作。

<!-- fork:end -->
```

`README_EN.md`:

```markdown
<!-- fork:start -->

> [!NOTE]
> **Be Native** is a personal fork of Pot. Upstream [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) has been archived; development continues in [whisperers26/be-native](https://github.com/whisperers26/be-native). This fork publishes no releases, so the install instructions below install upstream Pot.
>
> Changes in this fork:
>
> - The main branch is `main`; every change lands through a pull request.
> - AI agents work from [AGENTS.md](./AGENTS.md) and the wiki in [docs/agents](./docs/agents/).

<!-- fork:end -->
```

`README_KR.md`:

```markdown
<!-- fork:start -->

> [!NOTE]
> **Be Native**는 Pot의 개인 포크입니다. 업스트림 저장소 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop)은 보관(archived)되었으며, 개발은 [whisperers26/be-native](https://github.com/whisperers26/be-native)에서 계속됩니다. 이 포크는 릴리스를 배포하지 않으므로, 아래 설치 안내는 업스트림 Pot을 설치합니다.
>
> 이 포크의 변경 사항:
>
> - 기본 브랜치는 `main`이며, 모든 변경은 풀 리퀘스트로 병합됩니다.
> - AI 에이전트는 [AGENTS.md](./AGENTS.md)와 [docs/agents](./docs/agents/)의 위키를 따라 작업합니다.

<!-- fork:end -->
```

- [ ] **Step 5: Run the check**

Run: `pnpm check:docs`
Expected: `check:docs: OK (5 files, <n> relative links)` and exit code 0.

- [ ] **Step 6: Commit, one topic per commit**

```bash
git add docs/agents/git-workflow.md
git commit -m "Add the git workflow page for agents"
git add AGENTS.md
git commit -m "Add AGENTS.md with the rules and the wiki index"
git add CLAUDE.md
git commit -m "Load AGENTS.md from CLAUDE.md for Claude Code"
git add README.md README_EN.md README_KR.md
git commit -m "Describe the fork at the top of all three READMEs"
```

- [ ] **Step 7: Prove the check catches drift (Review Focus 4 and 5)**

A broken wiki link:

```bash
echo '[gone](missing-page.md)' >> docs/agents/git-workflow.md
pnpm check:docs; echo "exit=$?"
git restore docs/agents/git-workflow.md
```

Expected before the restore: `docs/agents/git-workflow.md:<last line>: broken link "missing-page.md"` and `exit=1`.

A README fork bullet added in one language only:

```bash
sed -i 's/^> - AI agents work from/> - Extra bullet.\n> - AI agents work from/' README_EN.md
pnpm check:docs; echo "exit=$?"
git restore README_EN.md
pnpm check:docs; echo "exit=$?"
```

Expected: first run prints `fork sections have different bullet counts (README.md=2, README_EN.md=3, README_KR.md=2); update all three READMEs together` and `exit=1`; second run prints `check:docs: OK ...` and `exit=0`.

A `gh pr` command that does not name the fork (Review Focus 1):

```bash
printf '\n```bash\ngh pr merge 5 --merge\n```\n' >> docs/agents/git-workflow.md
pnpm check:docs; echo "exit=$?"
git restore docs/agents/git-workflow.md
```

Expected before the restore: `docs/agents/git-workflow.md:<line>: gh pr command without --repo whisperers26/be-native` and `exit=1`. `git status --short` is empty afterwards.

(These three cases, plus an orphan wiki page and a link inside a code block, were run against this exact script while writing the plan; all behaved as stated.)

- [ ] **Step 8: Point the build-from-source steps at the fork**

In each of the three READMEs, in the build-from-source section (`## 手动编译`, `## Manual compilation`, `## 사용자 컴파일`), replace:

```bash
git clone https://github.com/pot-app/pot-desktop.git
```

with

```bash
git clone https://github.com/whisperers26/be-native.git
```

and replace `cd pot-desktop` with `cd be-native`. Check nothing else changed:

```bash
git diff --stat   # 3 files, 2 lines changed in each
pnpm check:docs
git add README.md README_EN.md README_KR.md
git commit -m "Point the build-from-source steps at the fork"
```

---

### Task 5: Wiki pages for the current code

Same branch, `docs/agents-wiki`. This task ships Tasks 3–5 as one PR.

The facts below were checked against the code at upstream commit `594d32e` (the fork's starting point) on 2026-09-30, by reading the source. Page content is given in full; write it as given.

**Files:**
- Create: `docs/agents/setup-and-run.md`, `docs/agents/config-keys.md`, `docs/agents/known-issues.md`, `docs/agents/services.md`, `docs/agents/backend.md`, `docs/agents/frontend.md`, `docs/agents/architecture.md`
- Modify: `AGENTS.md` (one wiki row per page; rule 6), `docs/agents/git-workflow.md` (point bug reports at `known-issues.md`)

**Interfaces:**
- Consumes: `pnpm check:docs`; the AGENTS.md wiki table (Task 4).
- Produces: the pages that Plans 2 and 3 update. Plan 2 adds `testing.md`; Plan 3 adds `typescript.md`, appends to `known-issues.md`, and updates paths in these pages when files are renamed.

Conventions for every page:
- One topic per page. Facts, commands and paths; no line numbers (they rot).
- Name source files by directory or extension-less module path in code spans (`src/utils/store`, `src/window/Translate/`). Link only to other wiki pages, so Plan 3's `.jsx` → `.tsx` renames do not break links.
- Pages are written in this order so that every page's links already resolve when it is committed: setup-and-run, config-keys, known-issues, services, backend, frontend, architecture.

The final order of the AGENTS.md wiki table is:

```markdown
| Read | When you are |
| --- | --- |
| [git-workflow.md](docs/agents/git-workflow.md) | Branching, committing, opening or merging a PR |
| [setup-and-run.md](docs/agents/setup-and-run.md) | Installing tools, running or building the app, finding its files |
| [architecture.md](docs/agents/architecture.md) | New here, or unsure whether Rust or React owns something |
| [frontend.md](docs/agents/frontend.md) | Changing windows, pages, hooks, state, i18n or styling |
| [backend.md](docs/agents/backend.md) | Changing Rust: commands, windows, tray, hotkeys, HTTP API, OCR, backup |
| [services.md](docs/agents/services.md) | Adding or changing a translate, OCR, TTS or collection service, or plugins |
| [config-keys.md](docs/agents/config-keys.md) | Reading, adding or changing a setting |
| [known-issues.md](docs/agents/known-issues.md) | Seeing odd behaviour, or about to fix a bug |
```

Each step below adds its own row in this position.

- [ ] **Step 1: Write `docs/agents/setup-and-run.md`**

````markdown
# Setup and run

## Tools

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `.node-version` (21); Node 22 also works | |
| pnpm | 9 or newer | The lockfile is format 9.0 |
| Rust | stable (1.98.1 known to work) | Windows: the MSVC toolchain |
| Windows extras | Visual Studio 2022 or newer with "Desktop development with C++"; WebView2 runtime | WebView2 ships with Windows 10 and 11 |
| Linux extras | `sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3` | |
| macOS extras | Xcode command line tools | |

Install Rust on Windows with `winget install --id Rustlang.Rustup -e`, then open a new terminal so `%USERPROFILE%\.cargo\bin` is on `PATH`.

## Install

```bash
pnpm install
```

pnpm 10 skips the install scripts of esbuild and tesseract.js and prints a warning. The build does not need them.

## Run

```bash
pnpm tauri dev
```

This starts Vite on http://localhost:1420 (`pnpm dev`; the port is fixed and must be free), then builds and starts the Rust app in debug mode. The first Rust build takes one or two minutes; later builds are incremental. Frontend edits hot-reload; Rust edits rebuild and restart the app.

What to expect:

- On first run (no settings file yet) the Config window opens. Otherwise the app starts with only a tray icon.
- Closing a window does not quit. Quit or restart from the tray menu.
- Only one instance runs at a time. The app identifier, `com.pot-app.desktop`, is the same as upstream Pot's, so an installed Pot and the dev build share settings, and whichever starts second exits with an "already running" notification. Quit the other one first.
- Global shortcuts are empty until set in Config → Hotkey. Without them, trigger windows through the local HTTP API (port setting `server_port`, default 60828):

  ```bash
  curl 127.0.0.1:60828/config
  curl -X POST 127.0.0.1:60828/translate -d "hello world"
  curl 127.0.0.1:60828/input_translate
  ```

- With `dev_mode` on (Config → General), F12 opens the devtools of the focused window.
- The updater still checks upstream's release feed; upstream's latest release is 3.0.7, the version in this repository, so it finds nothing.

## Data on disk

| What | Windows | Linux | macOS |
| --- | --- | --- | --- |
| Settings `config.json`, history `history.db`, plugins `plugins/` | `%APPDATA%\com.pot-app.desktop\` | `~/.config/com.pot-app.desktop/` | `~/Library/Application Support/com.pot-app.desktop/` |
| Log `pot.log` (deleted at launch once over 40 KB) | `%APPDATA%\com.pot-app.desktop\logs\` | `~/.config/com.pot-app.desktop/logs/` | `~/Library/Logs/com.pot-app.desktop/` |
| Screenshots `pot_screenshot.png`, `pot_screenshot_cut.png` | `%LOCALAPPDATA%\com.pot-app.desktop\` | `~/.cache/com.pot-app.desktop/` | `~/Library/Caches/com.pot-app.desktop/` |

To start as on first run, quit the app and move `config.json` away.

## Build

| Command | Result |
| --- | --- |
| `pnpm build` | The frontend only, into `dist/`, in about 15 seconds. It warns that the main chunk is over 500 kB; that is expected. |
| `pnpm tauri build` | A release binary plus MSI and NSIS installers in `src-tauri/target/release/bundle/`, in about 2.5 minutes. It then exits with "A public key has been found, but no private key. Make sure to set `TAURI_PRIVATE_KEY` environment variable.": the updater is active with upstream's public key, and only the signing of the updater bundles needs the private key. The installers are already written by then. |

## In RustRover

Open the repository root. RustRover finds the Cargo project at `src-tauri/Cargo.toml` and the Node project at the root, with pnpm as its package manager. Run `pnpm tauri dev` in the IDE terminal, or create an npm run configuration for the `tauri` script with the argument `dev`. There are no shared run configurations yet.
````

Add the AGENTS.md row for `setup-and-run.md` directly after the `git-workflow.md` row, then:

```bash
pnpm check:docs
git add docs/agents/setup-and-run.md AGENTS.md
git commit -m "Add the setup and run page to the agent wiki"
```

- [ ] **Step 2: Write `docs/agents/config-keys.md`**

````markdown
# Config keys

Every setting lives in one JSON file, `config.json` in the app config directory ([paths](setup-and-run.md#data-on-disk)). The frontend reads and writes it with `useConfig(key, default)`; the first read of a missing key writes the default to the file. Rust reads some keys directly and, for the keys marked "Rust", writes the default when the key is missing. Rust reads values with a fixed type and panics on a value of another type, so never change a key's type.

## App

| Key | Default | Notes |
| --- | --- | --- |
| `app_language` | `en` | UI language; also the tray menu language. Rust |
| `app_theme` | `system` | `system`, `light`, `dark` |
| `app_font`, `app_fallback_font` | `default` | Font family names |
| `app_font_size` | `16` | Pixels |
| `transparent` | `true` | Transparent window background (not macOS) |
| `dev_mode` | `false` | F12 opens devtools |
| `check_update` | `true` | Check for updates at launch. Rust |
| `server_port` | `60828` | Local HTTP API port; restart to apply. Rust |
| `tray_click_event` | `config` | Windows tray left click: `config`, `translate`, `ocr_recognize`, `ocr_translate`, `disable`. Rust |
| `proxy_enable` | `false` | Applied at launch only |
| `proxy_host`, `proxy_port` | `''` | Rust builds `http://<host>:<port>`; the port must be a number |
| `proxy_username`, `proxy_password` | `''` | Ignored (the inputs are disabled) |
| `no_proxy` | `localhost,127.0.0.1` | |

## Translate

| Key | Default | Notes |
| --- | --- | --- |
| `translate_source_language` | `auto` | |
| `translate_target_language` | `zh_cn` | |
| `translate_second_language` | `en` | Used as the target when the detected source language equals the target |
| `translate_detect_engine` | `baidu` | `baidu`, `google`, `tencent`, `niutrans`, `yandex`, `bing`, `local` (offline, Rust) |
| `translate_auto_copy` | `disable` | `source`, `target`, `source_target`, `disable`; also set from the tray. Rust |
| `translate_delete_newline` | `false` | |
| `incremental_translate` | `false` | Append new text to the previous text |
| `dynamic_translate` | `false` | Translate one second after typing |
| `translate_remember_language` | `false` | Save languages chosen in the window as the defaults |
| `history_disable` | `false` | |
| `translate_window_position` | `mouse` | `mouse` (at the cursor) or `pre_state` (last position) |
| `translate_window_position_x`, `translate_window_position_y` | `0` | Saved position |
| `translate_remember_window_size` | `false` | |
| `translate_window_width`, `translate_window_height` | `350`, `420` | Saved size. Rust |
| `translate_close_on_blur` | `true` | |
| `translate_always_on_top` | `false` | |
| `translate_hide_window` | `false` | Translate without showing the window |
| `hide_source`, `hide_language` | `false` | Hide the source box or the language bar |
| `clipboard_monitor` | `false` | Toggled from the tray only. Rust |

## Recognize (OCR)

| Key | Default | Notes |
| --- | --- | --- |
| `recognize_language` | `auto` | |
| `recognize_delete_newline` | `false` | |
| `recognize_auto_copy` | `false` | |
| `recognize_hide_window` | `false` | |
| `recognize_close_on_blur` | `false` | |
| `recognize_window_width`, `recognize_window_height` | `800`, `400` | Rust |

## Hotkeys

| Key | Default | Notes |
| --- | --- | --- |
| `hotkey_selection_translate`, `hotkey_input_translate`, `hotkey_ocr_recognize`, `hotkey_ocr_translate` | `''` | Accelerator strings set on the Hotkey page; empty means no shortcut. Rust |

## Services

| Key | Default | Notes |
| --- | --- | --- |
| `translate_service_list` | `['deepl', 'bing', 'lingva', 'yandex', 'google', 'ecdict']` | Instance keys in display order. Rust prunes unknown entries at launch |
| `recognize_service_list` | `['system', 'tesseract']` | Same |
| `tts_service_list` | `['lingva_tts']` | Same; only the first entry is used |
| `collection_service_list` | `[]` | Same |
| `<instance key>` | `{}` | That instance's settings: `instanceName`, the service's own fields, and for translate `enable` |

## Backup

| Key | Default | Notes |
| --- | --- | --- |
| `backup_type` | `webdav` | `webdav`, `aliyun`, `local` |
| `webdav_url`, `webdav_username`, `webdav_password` | `''` | |
| `aliyun_access_token` | `''` | |

## Adding a setting

Pick a `snake_case` key and read it with `useConfig('<key>', <default>)` wherever it is used; give the same default everywhere. If Rust needs it, read it with `get("<key>")` in `src-tauri/src/config.rs` and handle a missing or wrongly typed value without `unwrap()`. Add a row to this page.
````

Add the AGENTS.md row for `config-keys.md` as the last row, then:

```bash
pnpm check:docs
git add docs/agents/config-keys.md AGENTS.md
git commit -m "Add the config keys page to the agent wiki"
```

- [ ] **Step 3: Write `docs/agents/known-issues.md` and point the rules at it**

````markdown
# Known issues

Bugs in code inherited from upstream, not fixed yet. Each one was confirmed by reading the code. To fix one, use its own `fix/` branch and delete its entry in the same PR. When you find a new bug and do not fix it, add it here.

## Frontend

- **The language swap can throw.** In `src/window/Translate/components/LanguageArea`, the second-language branch of the swap calls `setTargetLanguage(secondLanguage)`, but the variable is named `translateSecondLanguage`, so that branch throws a `ReferenceError`.
- **The Translate window never reloads plugins.** `src/window/Translate/` registers its `reload_plugin_list` listener only `if (!unlisten)`, but `unlisten` already holds the blur listener, so installing or removing a plugin does not reach an open Translate window.
- **The result spinner ignores dark mode.** `TargetArea` compares the `useTheme()` object with `'dark'`, so the spinner always uses the light colour.
- **The second-language target is not checked.** `TargetArea` checks the selected target against the service's `Language`, then may switch to `translate_second_language` without checking that one; an unsupported second language reaches the service as `undefined`.
- **Target auto-copy depends on list position.** Only the card at position 0 of `translate_service_list` copies the target text; if that instance is disabled, target auto-copy never happens.
- **Dynamic translate does not debounce.** `SourceArea` keeps its timer in a variable that is re-created on every render, so every keystroke schedules its own translation one second later.
- **Font size classes may not exist.** `SourceArea` and `TargetArea` build Tailwind classes at runtime (`text-[${appFontSize}px]`); Tailwind only generates classes it finds written out in the source.
- **Keydown listeners pile up.** `src/App` adds a global keydown listener on every `dev_mode` change and never removes the previous one.
- **`deleteKey`'s check does nothing.** In `src/hooks/useConfig`, `store.has(key)` is not awaited, so the condition is a promise and always true. Deleting still works.
- **Two UI locales are unused.** `src/i18n/locales/ta_IN.json` and `tk_TM.json` are never imported, so Tamil and Turkmen cannot be selected.
- **Uninstalled plugins leave instances behind.** Uninstalling removes only list entries equal to the plugin's bare name, but instances are stored as `<plugin>@<id>`; they stay in the service lists, and the Translate window then reads info for a plugin that no longer exists.
- **TTS plugin settings look in the wrong list.** The TTS settings dialog passes `pluginType='translate'` to the plugin settings form.
- **Aliyun backup without a login throws.** The Backup page shows "log in first" and then calls `.then` on an undefined result. The `local` backup also ignores the file name it is given.

## Services

- **System OCR has no Portuguese.** The `system` OCR `Language` maps `pt_pt`, but its per-OS language tables use the key `pt`, so Portuguese becomes `undefined`.
- **Some error paths throw `TypeError`s.** caiyun and lingva (translate) call `.trim()` on the response object while building their error message; volcengine OCR (both variants) calls `.trim()` on `undefined` when the response has no `data`. The user sees a `TypeError` instead of the provider's error.
- **The DeepL API check uses a comma operator.** `(result.translations, result.translations[0])` only tests its second operand.
- **Lingva TTS fails silently.** On an HTTP error it returns `undefined` instead of throwing.
- **Anki errors are ignored.** The `error` field of AnkiConnect's replies is never checked.
- **QR code OCR can hang.** The image loader has no `onerror`, so an unreadable image never settles.

## Rust

- **A wrongly typed setting panics.** Rust reads settings with `as_bool()`, `as_i64()` or `as_str()` followed by `unwrap()`; a value of another type panics, at launch if it is read during setup. Example: with the proxy enabled and a host set, an empty or non-numeric `proxy_port` (the settings page's default is `''`) crashes the app at launch.
- **Offline detection never returns Ukrainian.** The `lang_detect` command builds its detector without Ukrainian (only the warm-up includes it), so `uk` is never returned.
- **A cancelled screenshot leaves its listener behind.** The `success` listener on the screenshot window is removed only when it fires, and Tauri 1 keeps a closed window's listeners; after a cancelled capture, a later successful one can also run the stale action.
- **One bad HTTP request stops the API.** A non-UTF-8 request body, or a failed response, panics the server thread; the HTTP API stays down until restart.
- **Deleted settings can come back.** The frontend and Rust each cache `config.json`, and a reload merges into the cache instead of replacing it, so a key deleted by one side is written back by the other side's next save.
- **Two unused imports.** `src-tauri/src/window.rs` imports `std::fs` and `dirs::cache_dir` without using them, which causes two compiler warnings.
````

In `AGENTS.md`, replace rule 6 with:

```markdown
6. A refactor does not change runtime behaviour. If you find a bug on the way,
   add it to [known-issues.md](docs/agents/known-issues.md) and fix it on its
   own branch.
```

In `docs/agents/git-workflow.md`, in Pull requests step 3, replace `and lists any bug found but not fixed.` with `and lists any bug found but not fixed; add those to [known-issues.md](known-issues.md) too.`

Add the AGENTS.md row for `known-issues.md` as the last row, then:

```bash
pnpm check:docs
git add docs/agents/known-issues.md AGENTS.md docs/agents/git-workflow.md
git commit -m "Add the known issues page and point the rules at it"
```

- [ ] **Step 4: Write `docs/agents/services.md`**

````markdown
# Services

Built-in translation, OCR ("recognize"), text-to-speech and collection (word book) services live in `src/services/<kind>/<name>/`. External plugins (`.potext`) add more at runtime. Windows reach both through service instance keys stored in the settings.

## Kinds

| Kind | Registry | Main function | Built-ins |
| --- | --- | --- | --- |
| translate | `src/services/translate/index` | `translate(text, from, to, options)` | 21 |
| recognize | `src/services/recognize/index` | `recognize(base64, language, options)` | 15 |
| tts | `src/services/tts/index` | `tts(text, lang, options)` | 1 |
| collection | `src/services/collection/index` | `collection(source, target, options)` | 2 |

## A service module

`src/services/<kind>/<dir>/` holds three files:

- `index`: the main function, then `export * from './Config'` and `export * from './info'`.
- `info.ts`: `info = { name, icon }` and, except for collection services, a `Language` enum.
- `Config`: `export function Config(props)`, the settings form.

The registry re-exports each module under its service name, which must equal `info.name`. Directory names can differ: `recognize/baidu` is `baidu_ocr`.

`Language` is a TypeScript string enum from the app's language codes (`auto` plus `languageList` in `src/utils/language`) to the provider's codes. Callers test support with `appCode in Language` and pass `Language[appCode]`. Values may repeat (`zh_cn` and `zh_tw` can both map to `ZH`).

## Calling convention

| Kind | Called as | Returns |
| --- | --- | --- |
| translate | `translate(text.trim(), Language[from], Language[to], { config, detect, setResult })` | A string or a dictionary object. Streaming services return `'[STREAM]'` when there is no `setResult` |
| recognize | `recognize(base64Png, Language[lang], { config })` | A string |
| tts | `tts(text, Language[lang], { config })` | Audio bytes (a number array) |
| collection | `collection(sourceText, result, { config })` | Ignored |

- `config` is the instance's settings object from the store, or `{}` if none was ever saved.
- `detect` is the detected source language, as an app code. `setResult(partial)` streams partial text; openai, geminipro, chatglm and ollama use it.
- A dictionary result is `{ pronunciations: [{ region?, symbol, voice }], explanations: [{ trait, explains: string[] }], associations: string[], sentence: [{ source, target? }] }`. google, youdao, bing_dict, cambridge_dict and ecdict can return one; the Translate window renders it specially.
- Services signal errors by throwing, usually a string such as `` `Http Request Error\nHttp Status: ${status}\n...` ``, sometimes an `Error`. Callers show `e.toString()`.
- The Translate window calls every enabled translate instance. TTS, and the OCR step of image translation, use the first instance in their list. The Recognize window lets the user pick.

## Settings forms

`Config` receives `{ name, instanceKey, pluginType, pluginList, updateServiceList, onClose }`; built-ins use `instanceKey`, `updateServiceList` and `onClose`.

The usual form calls `useConfig(instanceKey, { instanceName: t('services.<kind>.<name>.title'), ...defaults }, { sync: false })`. On submit it runs the service once with a canned input (translate: `'hello'` from `auto` to `zh_cn`); only if that succeeds does it save with `setConfig(config, true)`, call `updateServiceList(instanceKey)`, and `onClose()`.

Services with no settings (bing, yandex, bing_dict, cambridge_dict, ecdict and lingva for translate; system, tesseract and qrcode for OCR) call `updateServiceList('<name>')` with the bare name, so each has at most one instance.

## Instances

- An instance key is `<service>@<random base36>` (`createServiceInstanceKey` in `src/utils/service_instance`). Keys without `@` come from older versions and still work. A key whose service part starts with `plugin` is a plugin.
- Each kind's instances are listed, in order, in `translate_service_list`, `recognize_service_list`, `tts_service_list` and `collection_service_list`; each instance's settings are stored under its key. See [config-keys.md](config-keys.md).
- At launch, Rust removes every list entry whose service is neither in its built-in lists (`check_service_available` in `src-tauri/src/config.rs`) nor an installed plugin.

## Adding a built-in service

1. Create `src/services/<kind>/<name>/` with `index`, `info.ts` and `Config`, modelled on a service of the same kind (deepl for a keyed translate API, lingva for a keyless one).
2. Re-export it from `src/services/<kind>/index` under `<name>`, equal to `info.name`.
3. **Add `<name>` to the matching built-in list in `check_service_available` in `src-tauri/src/config.rs`. Without this, the app removes the service from the user's list at the next launch.**
4. Add a logo under `public/logo/` and set `info.icon` to `logo/<file>`.
5. Add `services.<kind>.<name>.title`, and any labels the form uses, to `src/i18n/locales/en_US.json`; other locales fall back to English.
6. Make HTTP requests with `fetch` and `Body` from `@tauri-apps/api/http`: they run in Rust, so CORS does not apply.

## Unusual services

- Not using Tauri's `fetch`: chatglm (global `fetch`), openai and geminipro when streaming (`window.fetch`), ollama (the `ollama/browser` package), tesseract (`tesseract.js`, with its worker and core in `public/`), qrcode (canvas and `jsqr`), system OCR (`invoke('system_ocr')`).
- Reading the cut screenshot from disk instead of using the `base64` argument: baidu_img_ocr, simple_latex_ocr, and system OCR (in Rust).
- Signing requests with the current time or random values: alibaba, baidu and baidu_field, tencent (translate and OCR), volcengine (translate and OCR), the three iflytek OCR services, youdao, chatglm (a JWT signed with `jose`), deepl's free endpoint.

## External plugins

- A plugin is a `.potext` zip whose file name starts with `plugin` and which contains `info.json` and `main.js`. Plugin list and templates: https://pot-app.com/plugin.html.
- Config → Service → add external plugin → install calls `invoke('install_plugin', { pathList })`. Rust extracts the zip to `<app config dir>/plugins/<plugin_type>/<name>/`, taking `plugin_type` from `info.json`. Uninstalling deletes that directory.
- `info.json` fields the app reads: `display`, `icon`, `homepage`, `plugin_type`, `language` (app code → plugin code), and `needs` (`[{ key, display, type?: 'input' | 'select', options? }]`), which the plugin settings form (`src/window/Config/pages/Service/PluginConfig/`) renders.
- `invoke_plugin(kind, name)` (`src/utils/invoke_plugin`) reads `main.js` on every call and runs it with `eval`; the script must define a function named after its kind (`translate`, `recognize`, `tts` or `collection`). It is called like a built-in, with `info.language` codes and with `utils` added to the options: `tauriFetch`, `http`, `readBinaryFile`, `readTextFile`, `Database`, `CryptoJS`, `run` (runs a program in the plugin directory through `run_binary`), `cacheDir`, `pluginDir`, `osType`.
- Plugins run with the app's full Tauri API access.

## Language detection

`src/utils/lang_detect` detects the source language with the engine in `translate_detect_engine` (default `baidu`): the web endpoints of baidu, google, tencent, niutrans, yandex or bing, or `local` (Rust, offline). An unknown engine name falls back to `local`; a failed detection returns `en`.
````

Add the AGENTS.md row for `services.md` directly before the `config-keys.md` row, then:

```bash
pnpm check:docs
git add docs/agents/services.md AGENTS.md
git commit -m "Add the services page to the agent wiki"
```

- [ ] **Step 5: Write `docs/agents/backend.md`**

````markdown
# Backend (Rust)

`src-tauri/` is a Tauri 1.8 app, crate `pot`. `src-tauri/src/main.rs` registers the plugins, runs setup, registers the commands, and keeps the app running when the last window closes.

## Modules

| Module | Does |
| --- | --- |
| `main` | Builder: plugins, setup, commands, tray handler, exit prevention. Globals `APP` (the app handle) and `StringWrapper` (text waiting for the translate window) |
| `window` | `build_window` and every window entry point: config, translate (selection, input, text, image), recognize, screenshot, updater |
| `config` | The settings store handle, `get`, `set`, `is_first_run`, service list pruning, plugin directory cleanup |
| `hotkey` | Global shortcuts |
| `tray` | Tray menu in 11 languages, tray events, `update_tray` |
| `server` | The local HTTP API |
| `clipboard` | The clipboard monitor loop |
| `screenshot` | Captures one monitor to `pot_screenshot.png` |
| `system_ocr` | OS OCR: Windows.Media.Ocr, a bundled macOS helper, or Linux `tesseract` |
| `lang_detect` | Offline language detection (lingua) |
| `backup` | WebDAV, local file and Aliyun Drive backup and restore |
| `cmd` | Other commands: text state, store reload, image cut, base64 and copy, proxy, plugin install and run, fonts, devtools |
| `updater` | Update check at launch |
| `error` | The `Error` type commands return; sent to JavaScript as its message |

## Launch

1. macOS: accessory activation policy and the accessibility permission prompt.
2. Load the settings and prune unknown services from the four service lists.
3. First run (settings empty): open the Config window.
4. Build the tray menu, start the HTTP server, register the global shortcuts (a failure shows a notification), apply the proxy if enabled, check for updates, warm up offline language detection if it is the selected engine, start the clipboard monitor if enabled.

## Commands

| Command | Arguments | Returns | Does |
| --- | --- | --- | --- |
| `get_text` | — | string | The text waiting for the translate window |
| `reload_store` | — | — | Reloads `config.json` into Rust's cache |
| `screenshot` | `x`, `y` | — | Captures the monitor at that position to `pot_screenshot.png` |
| `cut_image` | `left`, `top`, `width`, `height` | — | Crops it to `pot_screenshot_cut.png` |
| `get_base64` | — | string | `pot_screenshot_cut.png` as base64; `""` if missing |
| `copy_img` | `width`, `height` | — | Copies the cut image to the clipboard |
| `system_ocr` | `lang` | string | OS OCR of `pot_screenshot_cut.png` |
| `lang_detect` | `text` | string | Offline language detection; an app language code, `en` if unsure |
| `set_proxy`, `unset_proxy` | — | bool | Set or clear the proxy environment variables. The frontend never calls them; the proxy is applied at launch |
| `install_plugin` | `pathList` | number | Installs `.potext` files |
| `run_binary` | `pluginType`, `pluginName`, `cmdName`, `args` | `{ stdout, stderr, status }` | Runs a program with the plugin's directory as working directory |
| `font_list` | — | string[] | System font families |
| `open_devtools` | — | — | Toggles the devtools |
| `register_shortcut_by_frontend` | `name`, `shortcut` | — | Registers one global shortcut; the Hotkey page unregisters the old one and saves the setting |
| `update_tray` | `language`, `copyMode` | — | Rebuilds the tray menu; empty arguments are read from the settings |
| `updater_window` | — | — | Opens the Updater window |
| `webdav` | `operate`, `url`, `username`, `password`, `name` | string | `put`, `get`, `list` or `delete` backups under `<url>/pot-app/` |
| `local` | `operate`, `path` | string | `put` writes a backup zip, `get` restores one |
| `aliyun` | `operate`, `path`, `url` | string | Uploads to, or downloads from, a presigned Aliyun Drive URL |

JavaScript passes argument names in camelCase (`copyMode`); Tauri maps them to Rust's snake_case. Commands that are not `async` run on the main thread and block the UI while they run.

To add a command, write a `#[tauri::command]` function in the module it belongs to, add it to `generate_handler!` in `main.rs`, and call it from the frontend with `invoke`.

## Windows

`build_window(label, title)` creates a hidden, frameless, transparent window (on macOS, with an overlay title bar) that loads `index.html` on the monitor under the mouse, or focuses the window if it already exists. The frontend shows the window when it is ready. Sizes: Config 800×600; Translate from `translate_window_width` and `translate_window_height` (350×420), at the cursor or at a saved position; Recognize from `recognize_window_width` and `recognize_window_height` (800×400); Updater 600×400; Screenshot full screen.

## Events

| Event | Direction | Payload |
| --- | --- | --- |
| `new_text` | Rust → translate window | The text, `[INPUT_TRANSLATE]` or `[IMAGE_TRANSLATE]` |
| `new_image` | Rust → recognize window | `""`; the window re-reads the image |
| `translate_auto_copy_changed` | Rust → all windows | The auto-copy mode, when changed from the tray |
| `success` | Screenshot window → Rust | None; the region is saved, continue with OCR or image translation |

## Hotkeys

The settings `hotkey_selection_translate`, `hotkey_input_translate`, `hotkey_ocr_recognize` and `hotkey_ocr_translate` are empty by default, so there are no shortcuts until the user sets them. They are registered at launch; if one fails, the ones after it are skipped.

## Tray

Menu: input translate, clipboard monitor (toggle), auto copy (source, target, both, off), OCR recognize, OCR translate, settings, check for updates, view log, restart, quit. On Windows a left click runs `tray_click_event` (default: open settings).

## HTTP API

A server on `127.0.0.1:<server_port>` (default 60828) handles one request at a time, accepts any method, matches the URL exactly including the query string, and replies `ok`:

| URL | Does |
| --- | --- |
| `/`, `/translate` | Translates the request body |
| `/selection_translate`, `/input_translate` | Like the hotkeys |
| `/ocr_recognize`, `/ocr_translate` | Screenshot, then OCR or image translation |
| `/ocr_recognize?screenshot=false`, `/ocr_translate?screenshot=false` | The same, with an existing `pot_screenshot_cut.png` |
| `/config` | Opens the Config window |

Changing the port needs a restart. The API has no authentication.

## OCR

- Windows: Windows.Media.Ocr, with the user's language packs for `auto`; a missing language pack gives "Language package not installed!".
- macOS: the bundled helpers `src-tauri/resources/ocr-<arch>-apple-darwin`.
- Linux: the `tesseract` command; the deb and rpm packages depend on `tesseract-ocr`.

## Plugins

`install_plugin` accepts `.potext` zips whose names start with `plugin` and which contain `info.json` (with `plugin_type`) and `main.js`, and extracts them to `<app config dir>/plugins/<plugin_type>/<name>/`. At launch, directories under `plugins/<type>/` whose names do not start with `plugin` are deleted.

## Backup

A backup is an uncompressed zip of `config.json`, `history.db` if present, and everything under `plugins/`. Restoring extracts it over the app config directory; files not in the archive are kept. `src-tauri/src/backup.rs` hard-codes that directory as `<config dir>/com.pot-app.desktop`.

## Tauri plugins

`single-instance` (a second launch shows a notification and exits), `log` (`pot.log` and stdout), `autostart`, `sql` (the SQLite history), `store` (settings), `fs-watch` (the frontend watches `config.json`).

Rust bugs found so far: [known-issues.md](known-issues.md).
````

Add the AGENTS.md row for `backend.md` directly before the `services.md` row, then:

```bash
pnpm check:docs
git add docs/agents/backend.md AGENTS.md
git commit -m "Add the backend page to the agent wiki"
```

- [ ] **Step 6: Write `docs/agents/frontend.md`**

````markdown
# Frontend

The React 18 app in `src/`. Every window except the hidden `daemon` window runs this one bundle and picks what to render from its window label.

Stack: React 18; Vite 5 (dev server on port 1420); NextUI 2.4 on Tailwind 3.4, with `next-themes` for dark mode; jotai for state inside a window; i18next for UI text; react-router 6 for the Config window's pages; and the Tauri 1 JavaScript API (`@tauri-apps/api`) plus the store, SQL, fs-watch, log and autostart plugin APIs.

## Boot

1. `index.html` loads `src/main`. The `daemon` window loads `daemon.html`, which has no script.
2. `src/main` blocks the context menu in production builds, runs `initStore()` (`src/utils/store`) and `initEnv()` (`src/utils/env`, which sets `osType`, `arch`, `osVersion`, `appVersion`), then renders `App` inside `NextUIProvider` and `NextThemesProvider`.
3. `src/App` renders the component for the window's label:

| Label | Component | Opened by |
| --- | --- | --- |
| `translate` | `src/window/Translate/` | Selection, input and image translation, the HTTP API, the clipboard monitor |
| `recognize` | `src/window/Recognize/` | OCR after a screenshot, the HTTP API |
| `screenshot` | `src/window/Screenshot/` | The OCR and image translation hotkeys (not on macOS) |
| `config` | `src/window/Config/` | The tray, first run, the HTTP API |
| `updater` | `src/window/Updater/` | The update check, the About page |

An unknown label renders nothing. Rust creates the windows: [backend.md](backend.md).

`App` also applies the theme (`app_theme`; `system` follows the OS), the UI language (`app_language`), and the font family and size. Its global keydown handler blocks Ctrl shortcuts except c, v, x, a, z and y, blocks the F-keys, closes the window on Escape, and opens the devtools on F12 when `dev_mode` is on.

`App` imports every window module, so module-level code in any window's files (event listeners, the audio context in `useVoice`) runs in every window.

## Layout

| Path | Holds |
| --- | --- |
| `src/main`, `src/App` | Boot and choosing the window component |
| `src/window/<Name>/` | One directory per window; subcomponents in subdirectories |
| `src/components/WindowControl/` | Minimise, maximise and close buttons for frameless windows (hidden on macOS) |
| `src/hooks/` | `useConfig`, `useGetState`, `useSyncAtom`, `useToastStyle`, `useVoice` |
| `src/utils/` | Store and env setup, `debounce`, language detection, language tables, service instance keys, the plugin loader |
| `src/i18n/` | i18next setup and `locales/*.json` |
| `src/services/` | Built-in services: [services.md](services.md) |

## Translate window

- Text arrives through `invoke('get_text')` when the window mounts, and through the `new_text` event afterwards. Two payloads are special: `[INPUT_TRANSLATE]` opens an empty input, and `[IMAGE_TRANSLATE]` first runs OCR on the cut screenshot (`invoke('get_base64')`) with the first OCR instance.
- New text is trimmed, optionally stripped of newlines (`translate_delete_newline`) or appended to the previous text (`incremental_translate`), and its language is detected with `src/utils/lang_detect`.
- Translation starts when the text is committed to `sourceTextAtom`: on new text, on Enter (without Shift), on the translate button, or one second after typing when `dynamic_translate` is on.
- There is one result card (`components/TargetArea`) per enabled instance in `translate_service_list`, each calling its service as described in [services.md](services.md). If the source is `auto` and the detected language equals the target, a card translates into `translate_second_language` instead.
- Streaming services call `setResult` repeatedly; a per-card request id drops updates from superseded requests.
- A card can speak the result (first TTS instance), copy it, translate it back, retry, and send it to each collection service.
- Each finished card result is saved to SQLite (`sqlite:history.db`, table `history`) unless `history_disable` is on.
- Auto-copy (`translate_auto_copy`) is skipped while the clipboard monitor is on.
- The window closes when it loses focus, unless `translate_close_on_blur` is off or the window is pinned (`translate_always_on_top`). Position and size can be remembered.

## Other windows

- **Recognize**: shows the cut screenshot (`invoke('get_base64')`, refreshed on `new_image`) and runs OCR with the chosen instance and language (defaults: the first in `recognize_service_list`, and `recognize_language`). Its Translate button posts the text to the app's own HTTP API (`/translate`).
- **Screenshot**: shows a full-screen capture of the current monitor (`invoke('screenshot')`, which writes `pot_screenshot.png`). Dragging selects a region; on release it calls `invoke('cut_image')` and emits `success`. macOS uses the system `screencapture` tool instead of this window.
- **Updater**: runs Tauri's `checkUpdate()`, shows the release notes as markdown, downloads with a progress bar, installs, and relaunches.
- **Config**: a sidebar plus react-router pages (`src/window/Config/routes/`); `/` redirects to `/general`.

| Config page | Holds |
| --- | --- |
| General | Autostart, update check, HTTP port, UI language, theme, fonts, tray click (Windows), transparency, dev mode, proxy |
| Translate | Default languages, detection engine, auto-copy, history, incremental and dynamic translation, window behaviour |
| Recognize | Default OCR language and window behaviour |
| Hotkey | The four global shortcuts |
| Service | Instances per kind (translate, OCR, TTS, collection), their settings, external plugins |
| History | Browse, edit and clear the translation history; send entries to collections |
| Backup | Back up settings and history to WebDAV, Aliyun Drive or a local file, and restore them |
| About | Version, links, update check, the log and config folders |

## State

- All settings live in one JSON store; reference: [config-keys.md](config-keys.md).
- `useConfig(key, defaultValue, { sync = true })` returns `[value, setValue, getValue]`. `value` is `null` until the store has been read; a missing key gets the default, which is also written to the store. `setValue(v)` updates state at once and, after 500 ms without another change, saves the store and emits `<key>_changed` (with `.` replaced by `_` and `@` by `:`). Every `useConfig` for that key, in every window, listens to that event; that is how windows stay in sync. With `{ sync: false }`, only `setValue(v, true)` saves.
- `deleteKey(key)` removes a key without emitting an event.
- jotai atoms hold state shared inside one window (source text, detected language, selected languages, the OCR image and text). Each window is a separate JavaScript context, so atoms never cross windows.
- `useGetState` is `useState` plus a getter that reads the latest value. `useSyncAtom` keeps a local copy of an atom and pushes it to the atom when told to.

## Talking to Rust

- Commands: `invoke('<name>', args)` from `@tauri-apps/api/tauri`. What each one does: [backend.md](backend.md).
- Events listened to: `new_text`, `new_image`, `reload_plugin_list`, `<key>_changed`, and Tauri's `tauri://blur`, `tauri://focus`, `tauri://move`, `tauri://resize`, `tauri://update-download-progress`.
- Events emitted: `<key>_changed`, `success` (Screenshot), `reload_plugin_list` (plugin install and uninstall).
- Requests to outside services go through Tauri's HTTP client (`fetch` from `@tauri-apps/api/http`), which runs in Rust, so CORS does not apply.

## i18n

- `src/i18n/` imports 19 locale files and registers each under the app's language code (`en_US.json` as `en`, `zh_CN.json` as `zh_cn`, `pt_BR.json` as `pt_br`, …).
- Fallbacks: `zh_cn` and `zh_tw` to each other, `pt_pt` and `pt_br` to each other, `nb_no` and `nn_no` to each other, everything else to `en`.
- Keys are dotted paths in one namespace: `config.general.app_theme`, `languages.<code>`, `services.translate.<name>.title`, `common.ok`.
- Upstream translated the locales on Weblate; this fork is not connected to it, so edit the JSON files directly. A new UI string needs at least an `en_US.json` entry; missing keys fall back to English.

## Styling

- Tailwind with the NextUI plugin; the light and dark palettes are defined in the Tailwind config (`tailwind.config` at the repository root). Dark mode is the `dark` class that `next-themes` sets.
- CSS files: `src/style.css` (rounded transparent window, thin scrollbars), `src/window/Config/style.css`, `src/components/WindowControl/style.css`.
- Icons come from `react-icons`; flags from `flag-icons` (`fi fi-<country>` classes; codes in `src/utils/language`).
- Draggable lists use `react-beautiful-dnd`; the result card's collapse animation uses `@react-spring/web`.

Frontend bugs found so far: [known-issues.md](known-issues.md).
````

Add the AGENTS.md row for `frontend.md` directly before the `backend.md` row, then:

```bash
pnpm check:docs
git add docs/agents/frontend.md AGENTS.md
git commit -m "Add the frontend page to the agent wiki"
```

- [ ] **Step 7: Write `docs/agents/architecture.md`**

````markdown
# Architecture

Be Native is a fork of Pot, a Tauri 1 desktop app. One Rust process owns the windows, the tray, global shortcuts, a local HTTP API, the clipboard monitor, screenshots and system OCR. Each window is a WebView running the same React bundle, which picks what to render from the window's label.

| Piece | Where | Read |
| --- | --- | --- |
| Rust core | `src-tauri/` | [backend.md](backend.md) |
| React UI, one bundle for every window | `src/` | [frontend.md](frontend.md) |
| Translation, OCR, TTS and collection services, plugins | `src/services/` | [services.md](services.md) |
| Settings, one JSON file read by both sides | `config.json` | [config-keys.md](config-keys.md) |
| Tools, running, files on disk | | [setup-and-run.md](setup-and-run.md) |

## Windows

Rust creates windows on demand (`src-tauri/src/window.rs`), hidden; each shows itself when its React code is ready. All except `daemon` load `index.html`.

| Label | Purpose |
| --- | --- |
| `daemon` | Hidden static page created at launch; Rust uses it to find monitors |
| `translate` | Results from every enabled translate service |
| `recognize` | OCR of a screenshot region |
| `screenshot` | Full-screen region picker (not on macOS, which uses `screencapture`) |
| `config` | Settings |
| `updater` | Update download and install |

Closing a window never quits the app; only Quit or Restart in the tray does. A second launch shows an "already running" notification and exits.

## Main flows

- **Selection translation.** Hotkey → Rust reads the selected text (UI Automation or a simulated copy on Windows) → stores it and opens or focuses the `translate` window → a new window fetches it with `get_text`, an open one receives `new_text` → the window detects the language and calls every enabled translate service.
- **Input translation.** The same, with the text `[INPUT_TRANSLATE]`, which opens an empty input box.
- **OCR.** Hotkey → Rust opens the `screenshot` window → it captures the monitor (`pot_screenshot.png`), the user drags a region, `cut_image` writes `pot_screenshot_cut.png`, and the window emits `success` → Rust opens `recognize` → it reads the image with `get_base64` and runs the chosen OCR service.
- **Image translation.** The same capture, then `[IMAGE_TRANSLATE]` goes to the `translate` window, which runs OCR with the first OCR service and translates the text.
- **Clipboard monitor.** Toggled from the tray. Rust polls the clipboard every 500 ms and sends new text to the `translate` window.
- **Local HTTP API.** `127.0.0.1:60828` lets other programs trigger the same actions; routes in [backend.md](backend.md).

## Settings

`config.json` in the app config directory is cached twice: by the frontend (`tauri-plugin-store`, through `useConfig`, which keeps windows in sync with `<key>_changed` events) and by Rust (`get` and `set` in `src-tauri/src/config.rs`). The frontend watches the file and calls `reload_store` so Rust picks up changes. Reloads merge rather than replace, and whichever side saves last writes its whole cache.

## How the two sides talk

- Frontend → Rust: `invoke('<command>', args)`, 20 commands.
- Rust → frontend: the events `new_text` and `new_image` to one window, and `translate_auto_copy_changed` to every window.
- Frontend → Rust: the event `success` from the screenshot window.
- Requests to outside services go through Tauri's HTTP client, which runs in Rust, so CORS does not apply.

## Inherited risks

- Windows run with `--disable-web-security` and a permissive content security policy.
- Plugins are run with `eval`, with full Tauri API access, and can start programs.
- The HTTP API has no authentication.
- The app identifier (`com.pot-app.desktop`), the updater feed and the update signing key are still upstream's.
````

Add the AGENTS.md row for `architecture.md` directly after the `setup-and-run.md` row, then:

```bash
pnpm check:docs
git add docs/agents/architecture.md AGENTS.md
git commit -m "Add the architecture page to the agent wiki"
```

- [ ] **Step 8: Check the index and sizes**

```bash
pnpm check:docs
wc -l AGENTS.md docs/agents/*.md
sed -n '/^## Wiki/,$p' AGENTS.md
```

Expected: `check:docs: OK (12 files, ...)` (AGENTS.md, three READMEs, eight wiki pages); `AGENTS.md` under 80 lines; every page under 200 lines; the wiki table exactly as listed at the top of this task.

- [ ] **Step 9: Ship the docs PR (Tasks 3–5)**

There is no CI yet; the local checks are the gate.

```bash
pnpm check:docs && pnpm build
git push -u origin HEAD
gh pr create --repo whisperers26/be-native --base main --head docs/agents-wiki \
  --title "Add AGENTS.md, the agent wiki, and the README fork notice" \
  --body "Adds AGENTS.md (rules, commands, wiki index), CLAUDE.md (loads AGENTS.md), the docs/agents wiki (git workflow, setup and run, architecture, frontend, backend, services, config keys, known issues), a fork notice in all three READMEs, and pnpm check:docs (links, README fork sections, the index, gh pr --repo). Docs and tooling only; no app code changes. Verified: pnpm check:docs and pnpm build pass; check:docs fails on a broken link and on README bullets that differ between languages."
gh pr view docs/agents-wiki --repo whisperers26/be-native --json url --jq .url
gh pr merge docs/agents-wiki --repo whisperers26/be-native --merge --delete-branch
git switch main && git pull --ff-only
```

Expected: the URL starts with `https://github.com/whisperers26/be-native/pull/`; after the pull, `git log --oneline -1` shows the merge commit.

---

### Task 6: CI

Branch `ci/pr-checks`, one PR.

**Files:**
- Modify: `.github/workflows/package.yml:2-5` (the `on:` block)
- Modify: `package.json` (add `packageManager`)
- Create: `.github/workflows/ci.yml`
- Create: `docs/agents/ci.md`
- Modify: `AGENTS.md` (Commands note, wiki row)
- Modify: `README.md`, `README_EN.md`, `README_KR.md` (third fork bullet; pnpm requirement)
- Modify: `docs/agents/setup-and-run.md` (pnpm row)

**Interfaces:**
- Consumes: `pnpm check:docs` (Task 3); the AGENTS.md wiki index and README fork sections (Task 4).
- Produces: the `CI` workflow with one job, `frontend` (display name `Frontend`). Plan 2 adds a `pnpm test` step to it and Plan 3 a `pnpm typecheck` step.

- [ ] **Step 1: Branch**

```bash
git switch main && git pull --ff-only
git switch -c ci/pr-checks
```

- [ ] **Step 2: Make upstream's release workflow manual-only**

In `.github/workflows/package.yml`, replace lines 2–5:

```yaml
on:
    push:
        branches: [master]
        tags-ignore: [updater]
```

with:

```yaml
# Upstream's signed release pipeline. Manual-only in this fork: it needs
# pot-app's signing and Apple secrets, and its push trigger also fired on tags.
on:
    workflow_dispatch:
```

- [ ] **Step 3: Verify the trigger (Review Focus 2)**

```bash
sed -n '1,8p' .github/workflows/package.yml
```

Expected, exactly:

```
name: Package
# Upstream's signed release pipeline. Manual-only in this fork: it needs
# pot-app's signing and Apple secrets, and its push trigger also fired on tags.
on:
    workflow_dispatch:
permissions: write-all

jobs:
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/package.yml
git commit -m "Make upstream's release workflow manual-only"
```

- [ ] **Step 5: Pin pnpm**

In `package.json`, after the line `"type": "module",` add:

```json
    "packageManager": "pnpm@10.14.0",
```

Then:

```bash
pnpm install --frozen-lockfile
```

Expected: `Lockfile is up to date` and `Already up to date` (a warning about ignored build scripts for esbuild and tesseract.js is expected and harmless).

```bash
git add package.json
git commit -m "Pin pnpm 10.14.0 with the packageManager field"
```

- [ ] **Step 6: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
    pull_request:
        branches: [main]
    push:
        branches: [main]

permissions:
    contents: read

concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: true

jobs:
    frontend:
        name: Frontend
        runs-on: ubuntu-latest
        steps:
            - name: Checkout
              uses: actions/checkout@v7

            - name: Set up pnpm
              uses: pnpm/action-setup@v6

            - name: Set up Node
              uses: actions/setup-node@v7
              with:
                  node-version-file: .node-version
                  cache: pnpm

            - name: Install dependencies
              run: pnpm install --frozen-lockfile

            - name: Check docs
              run: pnpm check:docs

            - name: Build frontend
              run: pnpm build
```

```bash
git add .github/workflows/ci.yml
git commit -m "Add a CI workflow for pull requests to main"
```

- [ ] **Step 7: Write `docs/agents/ci.md`**

````markdown
# CI

## Workflows

| File | Runs on | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every PR to `main`, every push to `main` | Installs from the lockfile, runs `pnpm check:docs`, builds the frontend with `pnpm build` |
| `.github/workflows/package.yml` | Manual only (`workflow_dispatch`) | Upstream's signed multi-platform release. It needs pot-app's signing and Apple secrets, which this fork does not have. Do not run it. |

CI covers the frontend only. Nothing builds or checks the Rust code in CI:
build it locally with `pnpm tauri dev` when you change `src-tauri/`.

## Waiting for CI

```bash
gh pr checks <branch> --repo whisperers26/be-native --watch
```

A failing check blocks the merge. Read the failing step's log with
`gh run view <run-id> --repo whisperers26/be-native --log-failed`, fix the
cause on the branch, and push again.

## Toolchain pins

- Node: `.node-version`, read by `actions/setup-node`.
- pnpm: `packageManager` in `package.json`, read by `pnpm/action-setup`.

Change a version by editing that file; local runs and CI then agree.

## Adding a check

Add a step to the `frontend` job in `ci.yml`, a row to the Commands table in
`AGENTS.md`, and a row to the Workflows table above.
````

In `AGENTS.md`, replace the line `Before opening a PR, run \`pnpm check:docs\` and \`pnpm build\`.` with:

```markdown
Before opening a PR, run `pnpm check:docs` and `pnpm build`; CI runs the same
checks on every PR.
```

and append this row to the wiki table:

```markdown
| [ci.md](docs/agents/ci.md) | Changing CI, or a check failed on your PR |
```

```bash
pnpm check:docs
git add docs/agents/ci.md AGENTS.md
git commit -m "Add the CI page to the agent wiki"
```

- [ ] **Step 8: Add the CI bullet to all three READMEs**

Append one bullet as the last line inside each fork section's note (directly after the `AGENTS.md` bullet):

- `README.md`: `> - 每个 Pull Request 都会经过 CI 检查（文档检查和前端构建）。`
- `README_EN.md`: `> - CI checks every pull request (docs check and frontend build).`
- `README_KR.md`: `> - 모든 풀 리퀘스트는 CI에서 검사됩니다(문서 검사 및 프런트엔드 빌드).`

```bash
pnpm check:docs
git add README.md README_EN.md README_KR.md
git commit -m "List CI among the fork's changes in all three READMEs"
```

- [ ] **Step 9: State the pinned pnpm version in the READMEs and the setup page**

The lockfile is format 9.0, which pnpm 8 cannot read, so upstream's `pnpm >= 8.5.0` was already wrong. Replace that line in each build-from-source requirements list:

- `README.md`: `pnpm 10.14.0（由 package.json 中的 packageManager 字段固定）`
- `README_EN.md`: `pnpm 10.14.0 (pinned by packageManager in package.json)`
- `README_KR.md`: `pnpm 10.14.0 (package.json의 packageManager로 고정)`

In `docs/agents/setup-and-run.md`, replace the Tools row `| pnpm | 9 or newer | The lockfile is format 9.0 |` with:

```markdown
| pnpm | 10.14.0 | Pinned by `packageManager` in `package.json` |
```

```bash
git diff --stat   # 4 files, 1 line each
pnpm check:docs
git add README.md README_EN.md README_KR.md docs/agents/setup-and-run.md
git commit -m "State the pinned pnpm version in the READMEs and the setup page"
```

- [ ] **Step 10: Check locally, then open the PR**

```bash
pnpm check:docs && pnpm build
git push -u origin HEAD
gh pr create --repo whisperers26/be-native --base main --head ci/pr-checks \
  --title "Add CI for pull requests; make the release workflow manual-only" \
  --body "Adds ci.yml (install, pnpm check:docs, pnpm build) on PRs and pushes to main; makes upstream's package.yml manual-only, since it needs pot-app's secrets and its push trigger fired on tags; pins pnpm 10.14.0; documents CI in docs/agents/ci.md and the READMEs. Verified: pnpm check:docs and pnpm build pass locally; CI runs on this PR."
gh pr view ci/pr-checks --repo whisperers26/be-native --json url --jq .url
```

Expected: the URL starts with `https://github.com/whisperers26/be-native/pull/`.

- [ ] **Step 11: Wait for CI on the PR**

```bash
gh pr checks ci/pr-checks --repo whisperers26/be-native --watch
```

Expected: `Frontend` passes. If it fails, read `gh run view <run-id> --repo whisperers26/be-native --log-failed`, fix on the branch with a new commit, push, and watch again.

- [ ] **Step 12: Merge and check the run on `main`**

```bash
gh pr merge ci/pr-checks --repo whisperers26/be-native --merge --delete-branch
git switch main && git pull --ff-only
run_id=$(gh run list --repo whisperers26/be-native --workflow ci.yml --branch main --event push -L 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --repo whisperers26/be-native --exit-status
gh run list --repo whisperers26/be-native --workflow package.yml --json databaseId --jq length
```

Expected: the push run on `main` succeeds; the last command prints `0` (the release workflow never ran).

---

### Task 7: Verify the phase

No branch; read-only checks on `main`.

- [ ] **Step 1: History and PRs**

```bash
git switch main && git pull --ff-only
git log --merges --oneline -5
gh pr list --repo whisperers26/be-native --state merged --json number,title --jq '.[] | "\(.number) \(.title)"'
git ls-remote --heads origin
```

Expected: three merge commits (spec and plan, agent docs, CI); the same three PRs; only `refs/heads/main` on `origin`.

- [ ] **Step 2: Checks pass on `main`**

```bash
pnpm install --frozen-lockfile
pnpm check:docs
pnpm build
```

Expected: all three succeed.

- [ ] **Step 3: Report to the owner**

Summarize: `main` is the default branch; the PR links; the wiki pages added; what CI checks; anything found but not fixed. Then hand over to Plan 2 (tests).
