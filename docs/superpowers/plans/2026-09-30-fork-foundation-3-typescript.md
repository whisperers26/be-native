# Fork Foundation, Plan 3 of 3: TypeScript Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all 141 JavaScript files in `src/` (plus the Vite and Tailwind configs) to strict TypeScript without changing runtime behaviour, and prove it.

**Architecture:** One PR per layer, bottom-up (toolchain → utils/hooks → services → windows → entry points). Each layer is a pure rename commit followed by typing commits. Three proofs per PR: `pnpm check:transpile` (each migrated file's esbuild output is identical to the JavaScript original's), the unchanged Plan 2 test suite (snapshot files byte-identical), and, for UI layers, the real-app smoke test compared with the JavaScript baseline screenshots.

**Tech Stack:** TypeScript 5.6 (`strict`, `verbatimModuleSyntax`), Vite 5 `transformWithEsbuild`, Vitest 3, tsx, the Plan 2 smoke test.

**Spec:** `docs/superpowers/specs/2026-09-30-fork-foundation-design.md`, section 3 (TypeScript migration) and section 4's final docs pass. Plans 1 and 2 are merged.

## Global Constraints

- `strict: true`; `verbatimModuleSyntax: true`; `allowJs` only while migrating, removed in the last layer.
- Types only: no new default values, guards, or enums; no reformatting; no behaviour change. `any` only for untyped external data (HTTP JSON, `eval`-loaded plugins) and third-party gaps; `@ts-expect-error` needs a reason comment. Type-only escape hatches (`as`, `!`, `satisfies`) are allowed because they emit nothing.
- Bugs TypeScript exposes go into `docs/agents/known-issues.md` (own commit), not into a fix.
- Migration PRs may make only type-level edits to test files; snapshot files stay byte-identical.
- One PR per layer; per PR: a pure rename commit (`git mv`), then typing commits per module; `pnpm typecheck` green at the end of the PR.
- Out of scope, stays JavaScript: `postcss.config.js`, `updater/*.mjs`, `public/*.js`, external `.potext` plugins.
- Workflow as in AGENTS.md (branch per PR, small commits, `--merge`, delete the local branch, docs updated in the same PR).

## Review Focus

1. A "types only" edit that changes runtime behaviour: a default value added to satisfy the compiler, `?.` instead of `.`, `??` instead of `||`, a new guard, an import TypeScript elides. Expected: `pnpm check:transpile` reports the file as different. Pinned in Task 1 (the check, with `verbatimModuleSyntax` so imports are kept verbatim) and every layer's verification.
2. Class fields emitted differently in `.ts` than in `.js` (TypeScript's `useDefineForClassFields` default depends on the target). Expected: identical output. Pinned in Task 1 (`useDefineForClassFields: true` in `tsconfig.json` and in the check's esbuild options).
3. A snapshot regenerated to make a migration pass. Expected: `pnpm check:transpile` fails when any `__snapshots__` file differs from the base. Pinned in Task 1.
4. A window that renders blank or broken after the conversion although the unit tests pass (for example a lost CSS import). Expected: the smoke screenshots match the JavaScript baseline. Pinned in Tasks 5–8 (smoke on the branch before merging).
5. Tailwind generating different CSS after `tailwind.config` becomes TypeScript. Expected: the built CSS file is byte-identical. Pinned in Task 8.

---

### Task 1: TypeScript toolchain and the transpile check (inline)

Branch `refactor/ts-toolchain`.

**Files:**
- Create: `tsconfig.json`, `tsconfig.node.json`, `src/vite-env.d.ts`, `scripts/check-transpile.ts`, `docs/agents/typescript.md`, `.run/Typecheck.run.xml`
- Modify: `package.json` (devDependencies `@types/react`, `@types/react-dom`, `@types/crypto-js`, `@types/md5`, `@types/react-beautiful-dnd`, `@types/node@22`; scripts `typecheck`, `check:transpile`), `.github/workflows/ci.yml` (typecheck step), `AGENTS.md`, `docs/agents/ci.md`, `docs/agents/setup-and-run.md`

**Interfaces:**
- Produces: `pnpm typecheck` (= `tsc -p tsconfig.json && tsc -p tsconfig.node.json`); `pnpm check:transpile [--base <ref>] [--allow <path>]...` — exit 0 when every renamed/modified source file under `src/` transpiles to identical JavaScript (or is allowed) and no snapshot file changed; exit 1 otherwise, printing a diff per differing file.

- [ ] **Step 1: `tsconfig.json`** (app and tests)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "noEmit": true,
        "allowJs": true,
        "checkJs": false,
        "resolveJsonModule": true,
        "verbatimModuleSyntax": true,
        "esModuleInterop": true,
        "useDefineForClassFields": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "types": ["vite/client"]
    },
    "include": ["src"]
}
```

- [ ] **Step 2: `tsconfig.node.json`** (scripts and tool configs)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["ES2022"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noEmit": true,
        "verbatimModuleSyntax": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "types": ["node"]
    },
    "include": ["scripts", "vitest.config.ts"]
}
```

- [ ] **Step 3: `src/vite-env.d.ts`**: `/// <reference types="vite/client" />`.

- [ ] **Step 4: type packages and scripts.** `pnpm add -D @types/react@^18 @types/react-dom@^18 @types/crypto-js @types/md5 @types/react-beautiful-dnd @types/node@^22`; scripts `"typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.node.json"`, `"check:transpile": "tsx scripts/check-transpile.ts"`.

- [ ] **Step 5: run `pnpm typecheck` and fix what it finds in already-TypeScript files** (`src/test/*.ts`, `src/**/*.test.ts(x)`, `scripts/*.ts`, `vitest.config.ts`, the 41 existing `.ts` files). Types only, per the Global Constraints. Expected end state: exit 0.

- [ ] **Step 6: `scripts/check-transpile.ts`**

```ts
/**
 * Proves a TypeScript migration changed types only. Run with `pnpm check:transpile`.
 *
 * For every source file under src/ that this branch renamed or modified (compared with --base,
 * default origin/main), it transpiles the base version and the HEAD version with the esbuild that
 * Vite uses and compares the JavaScript. Added files must transpile to nothing but `export {}`
 * (types only). Snapshot files must be byte-identical to the base.
 *
 * Usage: pnpm check:transpile [--base <ref>] [--allow <path>]...
 * --allow names a HEAD path whose difference was reviewed and is explained in the PR.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformWithEsbuild } from 'vite';

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

const problems: string[] = [];
let identical = 0;
let allowedCount = 0;

const changes = git('diff', '--name-status', '--find-renames=30%', `${base}...HEAD`, '--', 'src')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));

for (const [status, first, second] of changes) {
    const oldPath = first;
    const newPath = status.startsWith('R') ? second : first;
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
```

- [ ] **Step 7: prove the check.** On a scratch branch from this one: rename `src/utils/index.js` → `.ts` and add `(fn: (...args: any[]) => void, delay: number = 500)` types — `pnpm check:transpile --base HEAD~1` → `OK (1 identical …)`; then change `delay = 500` to `delay = 400` in the same commit — → reports `src/utils/index.ts … differs` with the diff and exit 1; edit a snapshot file — → `snapshot file changed`. Delete the scratch branch. Record the three outputs in the PR.

- [ ] **Step 8: CI, IDE, docs.** CI: a `Type-check` step (`pnpm typecheck`) before `Run tests`. `.run/Typecheck.run.xml` (npm, script `typecheck`). `docs/agents/typescript.md` (below). `AGENTS.md`: Commands rows `pnpm typecheck` and `pnpm check:transpile`, the pre-PR line includes `pnpm typecheck`, wiki row `typescript.md` after `testing.md`. `ci.md` and `setup-and-run.md` (run configurations table) updated. Ship the PR.

`docs/agents/typescript.md` content: the two tsconfig files and what each covers; the type policy (the Global Constraints above, in prose, with the escape hatches and examples: `options: TranslateOptions = {} as TranslateOptions`, `res.data as DeepLResponse`, `document.getElementById('root')!`); where shared types live (`src/types/`, from Task 2); how to migrate a file (rename commit, typing commits, the three proofs); a "Migration status" table with one row per layer (pending/done + PR link), updated by every layer PR.

---

### Task 2: L1 — utils, hooks, i18n, shared types (subagent)

Branch `refactor/ts-utils-hooks`. Files: the 12 JavaScript files in `src/utils`, `src/hooks`, `src/i18n` (`.jsx` without JSX → `.ts`), plus new `src/types/service.ts`:

```ts
/** What every built-in service module provides. See docs/agents/services.md. */
import type { ComponentType } from 'react';

export interface ServiceInfo {
    name: string;
    icon: string;
}

/** A service's settings as stored under its instance key. */
export type ServiceConfig = Record<string, any>;

export interface DictionaryResult {
    pronunciations: { region?: string; symbol: string; voice: string | number[] }[];
    explanations: { trait: string; explains: string[] }[];
    associations: string[];
    sentence: { source: string; target?: string }[];
}

export type TranslateResult = string | DictionaryResult;

export interface TranslateOptions {
    config: ServiceConfig;
    detect?: string;
    setResult?: (partial: string) => void;
}

export interface RecognizeOptions {
    config: ServiceConfig;
}

export interface TtsOptions {
    config: ServiceConfig;
}

export interface CollectionOptions {
    config: ServiceConfig;
}

export interface ServiceConfigProps {
    name?: string;
    instanceKey: string;
    pluginType?: string;
    pluginList?: Record<string, unknown>;
    updateServiceList: (instanceKey: string) => void;
    onClose: () => void;
}

export type ServiceConfigComponent = ComponentType<ServiceConfigProps>;
```

`useConfig` becomes `useConfig<T>(key: string, defaultValue: T, options?: { sync?: boolean }): [T | null, (value: T, forceSync?: boolean) => void, () => T | null]`. Proofs: typecheck, tests, `check:transpile` (12 identical, 1 added types-only), no smoke needed (no window code). Update `typescript.md` status.

### Task 3: L2a — translate services (subagent)

Branch `refactor/ts-translate-services`. The 43 files in `src/services/translate` (`index.jsx` → `.ts`, `Config.jsx` → `.tsx`, registry `index.jsx` → `.ts`). Main functions typed with `TranslateOptions`/`TranslateResult`; response payloads as small local interfaces or `any`; `Config` components as `(props: ServiceConfigProps) => JSX.Element`. Proofs: typecheck, tests unchanged (the 21 service test files and snapshots), `check:transpile` (43 identical); smoke on the branch (the translate window lists the services).

### Task 4: L2b + L2c — recognize, TTS and collection services (subagent)

Branch `refactor/ts-other-services`. The 39 files in `src/services/recognize`, `src/services/tts`, `src/services/collection`. Same rules and proofs; smoke on the branch.

### Smoke comparison (Tasks 3–8)

Every smoke run in this plan is compared with `test-results/smoke/baseline-js/`: the same four scenarios pass, the screenshots show the same layout, labels and image, and the set of service names in `report.json`'s `serviceErrors` equals the baseline's (deepl, bing, lingva, ecdict on 2026-10-01). A service that newly fails is investigated before merging, even though it is only a warning.

### Task 5: L3a — `src/components` and the Translate window (subagent)

Branch `refactor/ts-translate-window`. 5 files. Proofs: typecheck, tests, `check:transpile`, smoke on the branch compared with `test-results/smoke/baseline-js/translate.png` and `input.png`.

### Task 6: L3b — Recognize, Screenshot and Updater windows (subagent)

Branch `refactor/ts-small-windows`. 6 files. Proofs as Task 5 (`ocr.png`).

Optional pre-step (own PR, before the rename): a jsdom render test of the Recognize window's `new_image` → `recognize` → result path, because the smoke test only checks that this window opens (the window stays loading in the real app; see known-issues.md). The test pins today's behaviour, including the stuck state if it reproduces in jsdom.

### Task 7: L3c — the Config window (subagent)

Branch `refactor/ts-config-window`. 34 files. Proofs as Task 5 (`config.png`).

### Task 8: L4 — entry points and tool configs; drop `allowJs` (inline)

Branch `refactor/ts-entry`. `src/main.jsx` → `main.tsx`, `src/App.jsx` → `App.tsx`, `index.html` script path, `vite.config.js` → `vite.config.ts`, `tailwind.config.cjs` → `tailwind.config.ts` (ESM `import { nextui } from '@nextui-org/react'`, `export default { … } satisfies Config`), `tsconfig.node.json` includes both configs, `allowJs`/`checkJs` removed from `tsconfig.json`, CI step "No JavaScript in src" (`find src -name '*.js' -o -name '*.jsx'` must print nothing). Proofs: typecheck; tests; `check:transpile` for the two `src` files; `pnpm build` output: the CSS asset is byte-identical to the build on `main` before this PR (Review Focus 5) and the JS bundle differs only in what the entry rename explains; full smoke compared with all four baseline screenshots.

### Task 9: Final docs pass and phase verification (inline)

Branch `docs/typescript-final`. Wiki pages updated for TypeScript (`frontend.md`, `services.md` contract now in `src/types/service.ts`, `architecture.md`, `setup-and-run.md`, `typescript.md` status all done); `AGENTS.md` "What this is" says TypeScript; READMEs ×3: TypeScript badge replaces the JavaScript badge, a fork bullet "the frontend is strict TypeScript"; `known-issues.md` holds every bug found during the migration. Verify: no `.js`/`.jsx` under `src/`; `pnpm typecheck`, `pnpm test` (same count as before Plan 3, snapshots unchanged since Plan 2), `pnpm build`, `pnpm check:docs`; smoke from the IDE matches the baseline; final whole-branch review over Plan 3's range.
