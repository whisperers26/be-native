# Fork Foundation, Plan 2 of 3: Characterization Tests and Real-App Smoke Test — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin today's behaviour of the JavaScript frontend with automated tests, and add a scripted smoke test of the real app run from the IDE, so the TypeScript migration (Plan 3) can prove it changed nothing.

**Architecture:** Vitest 3 in jsdom with a fake Tauri backend: one `mockIPC` handler answers every IPC call the app makes (events, path, window, fs, store, sql, …), and `fetch` from `@tauri-apps/api/http` is replaced by a queue of canned responses. Clock, `Math.random`, nanoid and uuid are frozen, so request snapshots (URLs, bodies, signatures) are stable. Tests sit next to the code (`*.test.ts(x)`), all written and passing against the current JavaScript. The smoke test drives the running app through its local HTTP API and inspects real windows with PowerShell (Win32 + UI Automation).

**Tech Stack:** Vitest 3.2.7 (the last major supporting Vite 5), jsdom 26.1.0, @testing-library/react 16.3.3, @testing-library/dom 10.4, @testing-library/jest-dom 6.10.0, `@tauri-apps/api/mocks`, tsx, PowerShell 5.1 (Windows), JetBrains `.run/` run configurations.

**Spec:** `docs/superpowers/specs/2026-09-30-fork-foundation-design.md`, section 2 (tests) and section 5 step 5. Plan 1 (`docs/superpowers/plans/2026-09-30-fork-foundation-1-workflow-docs-ci.md`) is merged.

## Global Constraints

- Tests are written against the current JavaScript; no app source file under `src/` (outside `src/test/` and `*.test.*`) changes in this plan.
- Test files sit next to the code: `*.test.ts` / `*.test.tsx`; snapshots in `__snapshots__/` beside them.
- Every built-in service (21 translate, 15 recognize, 1 TTS, 2 collection = 39) gets: the outgoing request snapshot with clock, randomness and UUIDs frozen; how a canned response is parsed; the error for a failed response; a snapshot of its exported `info` and `Language`.
- Render tests check "renders without throwing and shows its key labels", not full DOM snapshots.
- Real-app tests: `.run/*.run.xml` run configurations (Tauri dev, unit tests, smoke); `pnpm smoke` (Windows) drives the running app through `127.0.0.1:60828`, checks each window appears, saves screenshots to gitignored `test-results/smoke/`, scans the log for errors and panics.
- Workflow (from AGENTS.md): one branch per PR, small single-topic commits, PRs to `whisperers26/be-native` merged with `--merge` after CI passes, local branch deleted afterwards; all three READMEs and the affected wiki pages updated in the same PR.
- `pnpm check:docs`, `pnpm test` and `pnpm build` pass at the end of every PR.

## Review Focus

1. A test that passes no matter what the code does (for example a snapshot of a request the service never sent, or an expected value copied from the actual output without reading the code). Expected: every service test file is proven able to fail — a deliberate one-character change to the service makes it fail. Pinned in the per-service recipe (Task 5, step "mutation check").
2. Flaky or machine-dependent snapshots (real time, real randomness, OS path separators, locale). Expected: two consecutive full runs produce no snapshot changes, on Windows locally and on Linux in CI. Pinned in Task 1 (frozen clock/random/ids, POSIX fake paths) and every PR's CI run.
3. The fake backend silently answering a command the app never sends, or swallowing one it does, so render tests pass on a broken window. Expected: unhandled IPC calls are recorded, and each render test asserts none occurred. Pinned in Task 1 (`fakeTauri.unhandled`) and Task 9.
4. The smoke test reporting success while the app is not running, or against another Pot instance. Expected: it fails fast when nothing listens on the port, and it only inspects windows of the `pot.exe` process started from `src-tauri/target/debug`. Pinned in Task 10.
5. Snapshots edited later to make a refactor pass. Expected: `docs/agents/testing.md` states that snapshot files change only in PRs that intend a behaviour change, and Plan 3 checks them byte-for-byte. Pinned in Task 1's testing page.

---

### Task 1: Test harness, utility tests, CI step, testing page

Branch `test/vitest-harness`; ships as one PR at the end of Task 3.

**Files:**
- Modify: `.node-version` (`21` → `22`)
- Modify: `package.json` (devDependencies; `test`, `test:watch` scripts), `pnpm-lock.yaml`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`, `src/test/fake-tauri.ts`, `src/test/http.ts`
- Create: `src/utils/index.test.ts`
- Modify: `.github/workflows/ci.yml` (test step)
- Create: `docs/agents/testing.md`
- Modify: `AGENTS.md`, `docs/agents/ci.md`, `docs/agents/setup-and-run.md`, `README.md`, `README_EN.md`, `README_KR.md`

**Interfaces:**
- Produces (used by every later task):
  - `httpMock.queue(...responses: FakeResponse[])`, `httpMock.calls: HttpCall[]`, `httpMock.reset()` from `src/test/http`. `FakeResponse = { status?: number; data?: unknown; headers?: Record<string, string> }`; `HttpCall = { url: string; options?: Record<string, unknown> }`. An un-queued request throws `httpMock: no response queued for <METHOD> <url>`.
  - `fakeTauri` from `src/test/fake-tauri` with: `store: Map<string, unknown>`, `files: Map<string, string | number[]>` (key `<BaseDirectoryName>:<path>` when a base dir is given, else the raw path), `clipboard: string`, `os: { osType, arch, version, platform, locale }`, `sqlRows: unknown[]`, `update: null | Record<string, unknown>` (manifest delivered on `tauri://update`), `calls: { cmd: string; args: Record<string, unknown> }[]`, `emitted: { event: string; windowLabel?: string; payload: unknown }[]`, `unhandled: string[]`, `command(name, handler)`, `emit(event, payload)`, `reset()`, `handle(cmd, args)`.
  - Fixed values: `FIXED_NOW = new Date('2026-01-02T03:04:05.678Z')`, `Math.random()` → `0.123456789`, `nanoid()` → `'nanoid-fixed-id'`, `uuid.v4()` → `'01234567-89ab-4cde-8f01-23456789abcd'`, fake paths `/fake/<BaseDirectoryName>[/<path>]`.
  - `pnpm test` (= `vitest run`), `pnpm test:watch`.

- [ ] **Step 1: Branch and bump Node**

```bash
git switch main && git pull --ff-only
git switch -c test/vitest-harness
printf '22\n' > .node-version
git add .node-version
git commit -m "Bump .node-version to 22 for the test toolchain"
```

Why: Vitest 3 supports Node `^18 || ^20 || >=22`; 21 is outside that range and end-of-life. Local development already runs 22.

- [ ] **Step 2: Watch `pnpm test` fail before the harness exists (RED)**

Run: `pnpm test`
Expected: `ERR_PNPM_NO_SCRIPT  Missing script: test` (exit 1).

- [ ] **Step 3: Add the test toolchain**

```bash
pnpm add -D vitest@3.2.7 jsdom@26.1.0 @testing-library/react@16.3.3 @testing-library/dom@^10.4.0 @testing-library/jest-dom@6.10.0
```

In `package.json` `"scripts"`, after `"check:docs"`, add:

```json
        "test": "vitest run",
        "test:watch": "vitest"
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Unit and component tests. The app's own build config is vite.config.js.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
    },
});
```

- [ ] **Step 5: Write `src/test/http.ts`**

```ts
/**
 * Stand-in for `fetch` from `@tauri-apps/api/http`; src/test/setup.ts swaps it in for every test.
 *
 * Queue the responses a test expects with `httpMock.queue(...)`; each request takes the next one.
 * Requests are recorded in `httpMock.calls` exactly as the code passed them (url, options).
 */
import { vi } from 'vitest';

export interface FakeResponse {
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
}

export interface HttpCall {
    url: string;
    options?: Record<string, unknown>;
}

const queued: FakeResponse[] = [];
const calls: HttpCall[] = [];

export const fetchMock = vi.fn(async (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options });
    const next = queued.shift();
    if (!next) {
        throw new Error(`httpMock: no response queued for ${String(options?.method ?? 'GET')} ${url}`);
    }
    const status = next.status ?? 200;
    return {
        url,
        status,
        ok: status >= 200 && status < 300,
        headers: next.headers ?? {},
        rawHeaders: {},
        data: next.data,
    };
});

export const httpMock = {
    calls,
    queue(...responses: FakeResponse[]): void {
        queued.push(...responses);
    },
    reset(): void {
        queued.length = 0;
        calls.length = 0;
        fetchMock.mockClear();
    },
};
```

- [ ] **Step 6: Write `src/test/fake-tauri.ts`**

```ts
/**
 * An in-memory Tauri backend for tests. src/test/setup.ts installs `fakeTauri.handle` with
 * `mockIPC` once, and calls `fakeTauri.reset()` before every test.
 *
 * It answers the IPC calls the app makes: Tauri core modules (`invoke('tauri', { __tauriModule })`),
 * the store, sql, fs-watch, log and autostart plugins, and the app's own Rust commands.
 * Anything it does not know is recorded in `unhandled` and answered with `null`.
 */
import { BaseDirectory } from '@tauri-apps/api/path';

type Args = Record<string, any>;
type Handler = (args: Args) => unknown;

interface Listener {
    id: number;
    event: string;
    windowLabel: string | null;
    handler: number;
}

const FAKE_ROOT = '/fake';
const MONITOR = { name: 'fake-monitor', size: { width: 1920, height: 1080 }, position: { x: 0, y: 0 }, scaleFactor: 1 };

const DEFAULT_COMMANDS: Record<string, Handler> = {
    get_text: () => '',
    get_base64: () => '',
    reload_store: () => null,
    screenshot: () => null,
    cut_image: () => null,
    copy_img: () => null,
    system_ocr: () => '',
    lang_detect: () => 'en',
    set_proxy: () => true,
    unset_proxy: () => true,
    install_plugin: () => 0,
    run_binary: () => ({ stdout: '', stderr: '', status: 0 }),
    font_list: () => ['Arial', 'Segoe UI'],
    open_devtools: () => null,
    register_shortcut_by_frontend: () => null,
    update_tray: () => null,
    updater_window: () => null,
    webdav: () => '[]',
    local: () => '',
    aliyun: () => '',
};

function dirName(directory: unknown): string {
    return typeof directory === 'number' ? String(BaseDirectory[directory]) : 'Root';
}

function fileKey(path: string, options?: Args): string {
    return options?.dir !== undefined ? `${dirName(options.dir)}:${path}` : path;
}

class FakeTauri {
    store = new Map<string, unknown>();
    files = new Map<string, string | number[]>();
    clipboard = '';
    os = { osType: 'Windows_NT', arch: 'x86_64', version: '10.0.26200', platform: 'win32', locale: 'en-US' };
    sqlRows: unknown[] = [];
    update: null | Record<string, unknown> = null;
    calls: { cmd: string; args: Args }[] = [];
    emitted: { event: string; windowLabel?: string; payload: unknown }[] = [];
    unhandled: string[] = [];
    private commands = new Map<string, Handler>();
    private listeners: Listener[] = [];
    private nextId = 1;

    reset(): void {
        this.store.clear();
        this.files.clear();
        this.clipboard = '';
        this.os = { osType: 'Windows_NT', arch: 'x86_64', version: '10.0.26200', platform: 'win32', locale: 'en-US' };
        this.sqlRows = [];
        this.update = null;
        this.calls = [];
        this.emitted = [];
        this.unhandled = [];
        this.commands = new Map(Object.entries(DEFAULT_COMMANDS));
        this.listeners = [];
    }

    /** Override or add a Rust command. */
    command(name: string, handler: Handler): void {
        this.commands.set(name, handler);
    }

    /** Deliver an event to every listener of it, as Rust's emit_all would. */
    emit(event: string, payload: unknown): void {
        for (const listener of this.listeners.filter((l) => l.event === event)) {
            const deliver = (window as any)[`_${listener.handler}`];
            queueMicrotask(() => deliver?.({ event, windowLabel: listener.windowLabel, id: listener.id, payload }));
        }
    }

    handle = (cmd: string, args: Args): unknown => {
        this.calls.push({ cmd, args });
        if (cmd === 'tauri') return this.core(args.__tauriModule, args.message ?? {});
        if (cmd.startsWith('plugin:')) return this.plugin(cmd, args);
        const command = this.commands.get(cmd);
        if (command) return command(args);
        return this.miss(cmd);
    };

    private miss(name: string): null {
        this.unhandled.push(name);
        return null;
    }

    private core(module: string, message: Args): unknown {
        const cmd: string = message.cmd;
        switch (module) {
            case 'Event':
                return this.event(message);
            case 'Path':
                return this.path(message);
            case 'Os':
                if (cmd === 'osType') return this.os.osType;
                if (cmd === 'arch') return this.os.arch;
                if (cmd === 'version') return this.os.version;
                if (cmd === 'platform') return this.os.platform;
                if (cmd === 'locale') return this.os.locale;
                if (cmd === 'tempdir') return `${FAKE_ROOT}/Temp`;
                break;
            case 'App':
                if (cmd === 'getAppVersion') return '3.0.7';
                if (cmd === 'getAppName') return 'pot';
                if (cmd === 'getTauriVersion') return '1.8.1';
                if (cmd === 'show' || cmd === 'hide') return null;
                break;
            case 'Window':
                if (cmd === 'manage') return this.windowManage(message.data?.cmd?.type);
                if (cmd === 'createWebview') return null;
                break;
            case 'Fs':
                return this.fs(message);
            case 'Clipboard':
                if (cmd === 'writeText') {
                    this.clipboard = String(message.data ?? '');
                    return null;
                }
                if (cmd === 'readText') return this.clipboard;
                break;
            case 'Notification':
                if (cmd === 'isNotificationPermissionGranted') return true;
                return null;
            case 'Shell':
                if (cmd === 'open') return null;
                break;
            case 'GlobalShortcut':
                if (cmd === 'isRegistered') return false;
                return null;
            case 'Dialog':
                if (cmd === 'askDialog' || cmd === 'confirmDialog') return false;
                return null;
            case 'Process':
                return null;
        }
        return this.miss(`${module}.${cmd}`);
    }

    private event(message: Args): unknown {
        if (message.cmd === 'listen') {
            const id = this.nextId++;
            this.listeners.push({ id, event: message.event, windowLabel: message.windowLabel ?? null, handler: message.handler });
            return id;
        }
        if (message.cmd === 'unlisten') {
            this.listeners = this.listeners.filter((l) => l.id !== message.eventId);
            return null;
        }
        if (message.cmd === 'emit') {
            this.emitted.push({ event: message.event, windowLabel: message.windowLabel, payload: message.payload });
            this.emit(message.event, message.payload);
            if (message.event === 'tauri://update') {
                if (this.update) this.emit('tauri://update-available', this.update);
                else this.emit('tauri://update-status', { status: 'UPTODATE' });
            }
            return null;
        }
        return this.miss(`Event.${message.cmd}`);
    }

    private path(message: Args): unknown {
        switch (message.cmd) {
            case 'resolvePath':
                return `${FAKE_ROOT}/${dirName(message.directory)}${message.path ? `/${message.path}` : ''}`;
            case 'join':
                return (message.paths as string[]).join('/').replace(/\/+/g, '/');
            case 'normalize':
            case 'resolve':
                return Array.isArray(message.paths) ? message.paths.join('/') : message.path;
            case 'basename':
                return String(message.path).split('/').pop();
            case 'dirname':
                return String(message.path).split('/').slice(0, -1).join('/');
            case 'extname':
                return String(message.path).split('.').pop();
            case 'isAbsolute':
                return String(message.path).startsWith('/');
        }
        return this.miss(`Path.${message.cmd}`);
    }

    private windowManage(type: string | undefined): unknown {
        switch (type) {
            case 'scaleFactor':
                return 1;
            case 'innerPosition':
            case 'outerPosition':
                return { x: 0, y: 0 };
            case 'innerSize':
            case 'outerSize':
                return { width: 800, height: 600 };
            case 'isFullscreen':
            case 'isMaximized':
            case 'isMinimized':
                return false;
            case 'isDecorated':
            case 'isResizable':
            case 'isVisible':
            case 'isFocused':
                return true;
            case 'theme':
                return 'light';
            case 'title':
                return 'Pot';
            case 'currentMonitor':
            case 'primaryMonitor':
                return MONITOR;
            case 'availableMonitors':
                return [MONITOR];
            default:
                return null;
        }
    }

    private fs(message: Args): unknown {
        const key = fileKey(message.path, message.options);
        switch (message.cmd) {
            case 'readTextFile':
            case 'readFile': {
                const content = this.files.get(key);
                if (content === undefined) throw `fakeTauri: no such file ${key}`;
                return content;
            }
            case 'exists':
                return this.files.has(key);
            case 'readDir':
                return [];
            case 'writeFile':
                this.files.set(key, message.contents);
                return null;
            case 'createDir':
            case 'removeDir':
            case 'copyFile':
            case 'renameFile':
                return null;
            case 'removeFile':
                this.files.delete(key);
                return null;
        }
        return this.miss(`Fs.${message.cmd}`);
    }

    private plugin(cmd: string, args: Args): unknown {
        switch (cmd) {
            case 'plugin:store|get':
                return this.store.has(args.key) ? this.store.get(args.key) : null;
            case 'plugin:store|set':
                this.store.set(args.key, args.value);
                return null;
            case 'plugin:store|has':
                return this.store.has(args.key);
            case 'plugin:store|delete':
                return this.store.delete(args.key);
            case 'plugin:store|keys':
                return [...this.store.keys()];
            case 'plugin:store|values':
                return [...this.store.values()];
            case 'plugin:store|entries':
                return [...this.store.entries()];
            case 'plugin:store|length':
                return this.store.size;
            case 'plugin:store|clear':
            case 'plugin:store|reset':
                this.store.clear();
                return null;
            case 'plugin:store|load':
            case 'plugin:store|save':
                return null;
            case 'plugin:sql|load':
                return args.db;
            case 'plugin:sql|execute':
                return [1, 1];
            case 'plugin:sql|select':
                return this.sqlRows;
            case 'plugin:sql|close':
                return true;
            case 'plugin:fs-watch|watch':
            case 'plugin:fs-watch|unwatch':
            case 'plugin:log|log':
            case 'plugin:autostart|enable':
            case 'plugin:autostart|disable':
                return null;
            case 'plugin:autostart|is_enabled':
                return false;
        }
        return this.miss(cmd);
    }
}

export const fakeTauri = new FakeTauri();
fakeTauri.reset();
```

- [ ] **Step 7: Write `src/test/setup.ts`**

```ts
/**
 * Runs before every test file (vitest.config.ts → setupFiles).
 *
 * - Replaces `fetch` from `@tauri-apps/api/http` with the queue in ./http.
 * - Freezes nanoid and uuid; freezes Date and Math.random in every test.
 * - Installs the fake Tauri backend (./fake-tauri) and the browser APIs jsdom lacks, at load time,
 *   because app modules call Tauri and window APIs while they are imported.
 *
 * A render test that needs a window label other than 'main' sets it in a `vi.hoisted` block:
 * `@tauri-apps/api/window` reads the label once, when it is first imported.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, vi } from 'vitest';
import { fakeTauri } from './fake-tauri';
import { httpMock } from './http';

vi.mock('@tauri-apps/api/http', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tauri-apps/api/http')>();
    const { fetchMock } = await import('./http');
    return { ...actual, fetch: fetchMock };
});
vi.mock('nanoid', () => ({ nanoid: () => 'nanoid-fixed-id' }));
vi.mock('uuid', () => ({ v4: () => '01234567-89ab-4cde-8f01-23456789abcd' }));

export const FIXED_NOW = new Date('2026-01-02T03:04:05.678Z');

const w = window as any;
if (!w.__TAURI_METADATA__) {
    w.__TAURI_METADATA__ = { __windows: [{ label: 'main' }], __currentWindow: { label: 'main' } };
}
w.__TAURI__ = {
    convertFileSrc: (path: string, protocol = 'asset') => `${protocol}://localhost/${encodeURIComponent(path)}`,
};
mockIPC(fakeTauri.handle);

class FakeAudioContext {
    destination = {};
    decodeAudioData(): void {}
    createBufferSource() {
        return { connect() {}, disconnect() {}, start() {}, stop() {}, buffer: null, onended: null };
    }
}
w.AudioContext = FakeAudioContext;
w.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
});
w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
};
w.scrollTo = () => {};
w.Notification = class {
    static permission = 'granted';
    static requestPermission = async () => 'granted';
};
// jsdom has no innerText; the app reads it from parsed HTML (cambridge_dict).
if (!('innerText' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        get(this: HTMLElement) {
            return this.textContent;
        },
        set(this: HTMLElement, value: string) {
            this.textContent = value;
        },
        configurable: true,
    });
}

beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW, toFake: ['Date'] });
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    fakeTauri.reset();
    httpMock.reset();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});
```

- [ ] **Step 8: Write the first test, `src/utils/index.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { debounce } from './index';

describe('debounce', () => {
    it('calls the function once, with the last arguments, after the delay', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 300);

        debounced('first');
        debounced('second');
        vi.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('second');
    });

    it('waits 500 ms by default', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        debounce(fn)('x');

        vi.advanceTimersByTime(499);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledWith('x');
    });
});
```

- [ ] **Step 9: Run it (GREEN), then prove it can fail**

Run: `pnpm test`
Expected: `Test Files  1 passed (1)`, `Tests  2 passed (2)`.

Mutation check: change `delay = 500` to `delay = 400` in `src/utils/index.js`, run `pnpm test`, expect `waits 500 ms by default` to fail; restore with `git checkout -- src/utils/index.js` and re-run: 2 passed.

- [ ] **Step 10: Commit the harness in topic-sized commits**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "Add Vitest with jsdom and Testing Library"
git add src/test/http.ts
git commit -m "Add a queue-based fake for Tauri's HTTP fetch in tests"
git add src/test/fake-tauri.ts
git commit -m "Add an in-memory fake Tauri backend for tests"
git add src/test/setup.ts
git commit -m "Install the test fakes and freeze time and randomness for every test"
git add src/utils/index.test.ts
git commit -m "Test debounce"
```

- [ ] **Step 11: Run tests in CI**

In `.github/workflows/ci.yml`, between the `Check docs` and `Build frontend` steps, add:

```yaml
            - name: Run tests
              run: pnpm test
```

```bash
git add .github/workflows/ci.yml
git commit -m "Run the test suite in CI"
```

- [ ] **Step 12: Write `docs/agents/testing.md` and wire it into the docs**

````markdown
# Testing

## Commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Runs every `*.test.ts(x)` under `src/` once (Vitest, jsdom) |
| `pnpm test:watch` | The same, re-running on change |
| `pnpm test -- src/services/translate/deepl` | Only the tests under one path |

CI runs `pnpm test` on every PR.

## Layout

Tests sit next to the code they test (`src/utils/index.test.ts` tests `src/utils/index`). Snapshots live in `__snapshots__/` beside the test. Test helpers live in `src/test/`:

| File | Provides |
| --- | --- |
| `src/test/setup.ts` | Runs before every test file: installs the fakes below, freezes time and randomness, stubs browser APIs jsdom lacks |
| `src/test/http.ts` | `httpMock`: replaces `fetch` from `@tauri-apps/api/http` |
| `src/test/fake-tauri.ts` | `fakeTauri`: an in-memory Tauri backend answering every IPC call |

## What is frozen

| Thing | Value in tests |
| --- | --- |
| `Date` | `2026-01-02T03:04:05.678Z` (only `Date`; timers stay real unless a test calls `vi.useFakeTimers()`) |
| `Math.random()` | `0.123456789` |
| `nanoid()` | `'nanoid-fixed-id'` |
| `uuid.v4()` | `'01234567-89ab-4cde-8f01-23456789abcd'` |
| Tauri paths | `/fake/<BaseDirectory name>[/<path>]`, for example `/fake/AppConfig/config.json` |
| OS (`initEnv`) | `Windows_NT`, `x86_64`, `10.0.26200`; change `fakeTauri.os` before calling `initEnv()` |

## HTTP

Queue one response per request the code will make, in order, then inspect what it sent:

```ts
import { httpMock } from '../../../test/http';

httpMock.queue({ data: { translation: 'hallo' } });
const result = await translate('hello', 'en', 'de');
expect(result).toBe('hallo');
expect(httpMock.calls).toMatchSnapshot();
```

`queue({ status: 500, data: {...} })` makes a failed response (`ok` is false). A request with nothing queued throws `httpMock: no response queued for <METHOD> <url>`. Code that uses the browser's `fetch` instead (chatglm, streaming openai and geminipro, ollama) needs `vi.stubGlobal('fetch', ...)` in its test.

## The fake Tauri backend

- Rust commands: defaults for every command the app calls (`get_text` → `''`, `lang_detect` → `'en'`, …). Override one with `fakeTauri.command('get_text', () => 'hello')`.
- Settings: `fakeTauri.store` is the settings file (`config.json`); seed it before rendering, read it after.
- Events: `listen`/`emit` work between all code under test; `fakeTauri.emit('new_text', 'hi')` plays Rust emitting an event; `fakeTauri.emitted` records what the app emitted.
- Files: `fakeTauri.files.set('AppCache:pot_screenshot_cut.png', [137, 80])` (base directory name, colon, path) or a plain path.
- `fakeTauri.calls` records every IPC call; `fakeTauri.unhandled` lists calls the fake did not recognise. A render test asserts `unhandled` is empty.
- Window label: `@tauri-apps/api/window` reads it when first imported, so set it at the top of the test file:

  ```ts
  vi.hoisted(() => {
      (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'translate' }], __currentWindow: { label: 'translate' } };
  });
  ```

## Rules

- These are characterization tests: they pin what the code does today, including its bugs (see [known-issues.md](known-issues.md)). A refactor must keep them passing without changing them.
- Snapshot files change only in a PR that means to change behaviour, and that PR says which snapshots changed and why. Never run `vitest -u` to make a refactor pass.
- Prove a new test can fail: break the code under test on purpose (one character), watch the test fail, restore.
````

In `AGENTS.md`, add to the Commands table, after the `pnpm build` row:

```markdown
| `pnpm test` | Run the unit and component tests (Vitest) |
```

replace `Before opening a PR, run \`pnpm check:docs\` and \`pnpm build\`; CI runs the same` / `checks on every PR.` with:

```markdown
Before opening a PR, run `pnpm check:docs`, `pnpm test` and `pnpm build`; CI
runs the same checks on every PR.
```

and add the wiki row directly after the `services.md` row:

```markdown
| [testing.md](docs/agents/testing.md) | Writing or running tests, or a test failed |
```

In `docs/agents/ci.md`, change the `ci.yml` row's "What it does" cell to `Installs from the lockfile, runs \`pnpm check:docs\`, \`pnpm test\`, builds the frontend with \`pnpm build\``.

In `docs/agents/setup-and-run.md`, change the Node row to `| Node.js | \`.node-version\` (22) | |`.

In the three READMEs, append one fork bullet after the CI bullet:

- `README.md`: `> - 前端行为由自动化测试（Vitest）固定，命令为 \`pnpm test\`。`
- `README_EN.md`: `> - Automated tests (Vitest) pin the frontend's behaviour: \`pnpm test\`.`
- `README_KR.md`: `> - 자동화 테스트(Vitest)가 프런트엔드 동작을 고정합니다: \`pnpm test\`.`

and in each build-from-source section, change `Node.js >= 18.0.0` to `Node.js 22`.

```bash
pnpm check:docs
git add docs/agents/testing.md AGENTS.md docs/agents/ci.md
git commit -m "Add the testing page to the agent wiki"
git add docs/agents/setup-and-run.md README.md README_EN.md README_KR.md
git commit -m "Document Node 22 and the test suite in the READMEs and setup page"
```

---

### Task 2: Utility tests

Same branch.

**Files:** Create `src/utils/service_instance.test.ts`, `src/utils/language.test.ts`, `src/utils/env.test.ts`, `src/utils/store.test.ts`, `src/utils/invoke_plugin.test.ts`.

**Interfaces:** Consumes Task 1's `fakeTauri` and `httpMock`.

Each file follows: write it, run `pnpm test -- <file>`, read every assertion's outcome, run the mutation check named below, commit (`git commit -m "Test <module>"`).

- [ ] **Step 1: `src/utils/service_instance.test.ts`** — cover, with explicit expected values: `getServiceSouceType('plugin_x@1')` → `'plugin'`, `('deepl')` → `'buildin'`; `whetherPluginService`; `createServiceInstanceKey('deepl')` → `'deepl@' + (0.123456789).toString(36).substring(2)`; `getServiceName('deepl@abc')` → `'deepl'`, `('deepl')` → `'deepl'`; `getDisplayInstanceName('', () => 'DeepL')` → `'DeepL'` and `('Mine', …)` → `'Mine'`; `whetherAvailableService('deepl@1', { buildin: { deepl: {} }, plugin: {} })` → true, unknown → false, plugin key looked up in `plugin`. Mutation check: change `'@'` to `'#'` in `createServiceInstanceKey`.
- [ ] **Step 2: `src/utils/language.test.ts`** — `expect({ languageList, LanguageFlag }).toMatchSnapshot()`; plus `languageList` has 30 entries and every entry has a `LanguageFlag`. Mutation check: delete `'he'` from `languageList`.
- [ ] **Step 3: `src/utils/env.test.ts`** — `initEnv()` sets `osType`, `arch`, `osVersion`, `appVersion` from the fake (`Windows_NT`, `x86_64`, `10.0.26200`, `3.0.7`); with `fakeTauri.os.osType = 'Linux'` before calling, `osType` is `'Linux'`. Mutation check: swap `arch` and `osVersion` assignments.
- [ ] **Step 4: `src/utils/store.test.ts`** — after `initStore()`, the exported `store` reads and writes `fakeTauri.store` (`await store.set('k', 1)` → `fakeTauri.store.get('k') === 1`); its path is `/fake/AppConfig/config.json` (assert the `plugin:store|set` call's `path` in `fakeTauri.calls`); a `plugin:fs-watch|watch` call was made for that path. Mutation check: change `'config.json'` to `'config2.json'`.
- [ ] **Step 5: `src/utils/invoke_plugin.test.ts`** — seed `fakeTauri.files.set('/fake/AppConfig/plugins/translate/plugin_demo/main.js', 'async function translate(text){ return text.toUpperCase(); }')`; `const [fn, utils] = await invoke_plugin('translate', 'plugin_demo')`; `await fn('abc')` → `'ABC'`; `utils` has exactly the keys `tauriFetch, http, readBinaryFile, readTextFile, Database, CryptoJS, run, cacheDir, pluginDir, osType`; `cacheDir` is `/fake/AppCache`; `pluginDir` is `/fake/AppConfig/plugins/translate/plugin_demo`; `await utils.run('tool.exe', ['-v'])` sends `run_binary` with `{ pluginType: 'translate', pluginName: 'plugin_demo', cmdName: 'tool.exe', args: ['-v'] }`. Mutation check: change `"main.js"` to `"index.js"`.

---

### Task 3: Language detection tests, then ship PR 1 of this plan

Same branch.

**Files:** Create `src/utils/lang_detect.test.ts`.

- [ ] **Step 1: Write the tests.** For each engine (`baidu`, `google`, `tencent`, `niutrans`, `yandex`, `bing`): set `fakeTauri.store.set('translate_detect_engine', engine)`; queue the response the engine expects (bing needs two: the token as text, then `[{ language: 'zh-Hans' }]`); call `detect('你好')`; assert the mapped app code (`zh_cn`); snapshot `httpMock.calls`. Plus: no setting → engine `baidu`; `local` and an unknown engine → `invoke('lang_detect', { text })` with the fake's answer; a failed response (`status: 500`) → `'en'`; an unmapped code → `'en'`. Responses per engine (from the code): baidu `{ lan: 'zh' }`; tencent `{ translate: { source: 'zh' } }`; google `[null, null, 'zh-CN']`; niutrans `{ language: 'zh' }`; yandex `{ lang: 'zh' }`.
- [ ] **Step 2: Run, mutation check** (change `zh: 'zh_cn'` to `zh: 'zh_tw'` in the baidu map → the baidu test fails), restore, commit `Test language detection`.
- [ ] **Step 3: Ship the PR**

```bash
pnpm check:docs && pnpm test && pnpm build
git push -u origin HEAD
gh pr create --repo whisperers26/be-native --base main --head test/vitest-harness --title "Add the Vitest harness, utility tests, and the test step in CI" --body "Adds Vitest 3 (jsdom, Testing Library) with a fake Tauri backend and a fake HTTP fetch, freezes time and randomness, tests debounce, service instance keys, language tables, env and store setup, the plugin loader and language detection, runs pnpm test in CI, bumps .node-version to 22 (Vitest 3 does not support 21), and documents it all in docs/agents/testing.md and the READMEs. Verified: pnpm test (counts in the PR checks), each test file fails under a one-character mutation of the code it tests, pnpm check:docs, pnpm build."
gh pr checks test/vitest-harness --repo whisperers26/be-native --watch
gh pr merge test/vitest-harness --repo whisperers26/be-native --merge --delete-branch
git switch main && git pull --ff-only --prune
git branch -d test/vitest-harness
```

---

### Task 4: Hook tests (PR 2)

Branch `test/hooks`. Files: `src/hooks/useConfig.test.tsx`, `src/hooks/useGetState.test.tsx`, `src/hooks/useSyncAtom.test.tsx`, `src/hooks/useToastStyle.test.tsx`. Use `renderHook` and `act` from `@testing-library/react`.

- [ ] **Step 1: `useConfig`** — cases, each with explicit expectations:
  1. Value is `null` before the store answers, then the default; the default is written to `fakeTauri.store`.
  2. An existing stored value wins over the default and is not overwritten.
  3. `set('x')` updates state at once; nothing is saved until 500 ms pass (`vi.useFakeTimers()`, advance 499 then 1); then `fakeTauri.store.get(key) === 'x'` and `fakeTauri.emitted` has `{ event: '<key>_changed', payload: 'x' }`.
  4. Event naming: key `a.b@c` emits `a_b:c_changed`.
  5. Two hooks with the same key: setting one updates the other (through the event).
  6. `{ sync: false }`: `set('x')` saves nothing; `set('x', true)` saves.
  7. `deleteKey('k')` removes the key from `fakeTauri.store`.
  Mutation check: change the debounce delay used by `useConfig` (pass `debounce(fn, 400)`) → case 3 fails.
- [ ] **Step 2: `useGetState`, `useSyncAtom`, `useToastStyle`** — `getState()` returns the latest value after `setState`; `useSyncAtom` keeps a local copy until `syncAtom()` pushes it (read the atom with a second `useAtom` hook); `useToastStyle` returns the light colours under `next-themes` light and dark ones under dark (wrap in `ThemeProvider` with `forcedTheme`). Mutation check each.
- [ ] **Step 3: Commit per hook (`Test useConfig`, …), ship the PR** as in Task 3 Step 3 (title "Add tests for the hooks").

---

### Task 5: Translate service tests (PR 3)

Branch `test/translate-services`. One test file per service: `src/services/translate/<dir>/index.test.ts`, one commit per service (`Test the <name> translate service`).

**The per-service recipe** (every service, every kind):

1. Read the service's `index` and `info.ts`. List its branches (config variants, success, each error).
2. Write the test file. Always include:
   - `it('exports its info and language table', …)` → `expect({ info, Language }).toMatchSnapshot()` (collection services: `{ info }`).
   - One `it` per branch: queue the response(s) the branch needs, call the main function with fixed inputs, assert the exact return value or the exact thrown value (`await expect(p).rejects.toBe(...)` for thrown strings, `.rejects.toThrow(...)` for `Error`s), and `expect(httpMock.calls).toMatchSnapshot()`.
   - Expected values come from reading the code, written out literally. Bugs are characterized as they are (for example caiyun and lingva throw a `TypeError` on an unexpected payload — assert `.rejects.toThrow(TypeError)`).
3. Run `pnpm test -- src/services/<kind>/<dir>`; on the first run Vitest writes the snapshot. Open the `.snap` file and check every recorded request against the code (URL, method, headers, query, body type and payload). A snapshot you did not read is not a test.
4. Mutation check: change one character in the service's endpoint URL or parsing, re-run, see a failure, `git checkout -- <file>`, re-run green.
5. Commit the test file and its `__snapshots__` directory.

Worked example — `src/services/translate/deepl/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

describe('deepl translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('free: posts JSON-RPC to www2.deepl.com and returns the trimmed text', async () => {
        httpMock.queue({ data: { result: { texts: [{ text: ' Hallo ' }] } } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).resolves.toBe('Hallo');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('free: throws the response as JSON when it has no texts', async () => {
        httpMock.queue({ data: { error: 'x' } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).rejects.toBe('{"error":"x"}');
    });

    it('free: throws status and message on an HTTP error with an error body', async () => {
        httpMock.queue({ status: 429, data: { error: { message: 'Too many requests' } } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).rejects.toBe(
            'Status Code: 429\nToo many requests'
        );
    });

    it('api: uses api-free.deepl.com for :fx keys and sends the auth header', async () => {
        httpMock.queue({ data: { translations: [{ text: ' Hallo ' }] } });
        await expect(translate('hello', 'auto', 'DE', { config: { type: 'api', authKey: 'k:fx' } })).resolves.toBe('Hallo');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('api: uses api.deepl-pro.com for :dp keys and api.deepl.com otherwise', async () => {
        httpMock.queue({ data: { translations: [{ text: 'a' }] } }, { data: { translations: [{ text: 'b' }] } });
        await translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k:dp' } });
        await translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } });
        expect(httpMock.calls.map((c) => c.url)).toEqual([
            'https://api.deepl-pro.com/v2/translate',
            'https://api.deepl.com/v2/translate',
        ]);
    });

    it('deeplx: posts to the custom URL and returns data', async () => {
        httpMock.queue({ data: { data: 'Hallo' } });
        await expect(
            translate('hello', 'EN', 'DE', { config: { type: 'deeplx', customUrl: 'http://localhost:1188/translate' } })
        ).resolves.toBe('Hallo');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('unknown type falls back to the free endpoint', async () => {
        httpMock.queue({ data: { result: { texts: [{ text: 'x' }] } } });
        await translate('hello', 'EN', 'DE', { config: { type: 'other' } });
        expect(httpMock.calls[0].url).toBe('https://www2.deepl.com/jsonrpc');
    });
});
```

Branches each translate service must cover (from the code survey):

| Service | Cases |
| --- | --- |
| alibaba | missing keys → `'Please configure AccessKey ID and AccessKey Secret'`; signed GET (snapshot); success; HTTP error |
| baidu | missing appid/secret → `'Please configure appid and secret'`; md5-signed GET; success; error |
| baidu_field | as baidu, plus the `field` default `'it'` |
| bing | token (text) then translate; success; token failure → `'Get Token Failed'`; translate HTTP error |
| bing_dict | `from === to` returns the text without a request; dictionary result; not found → ``'Words not yet included: …'`` |
| caiyun | missing token → `'Please configure token'`; success (`target[0]`); unexpected payload → `TypeError` (known issue) |
| cambridge_dict | single English word → dictionary object (parse a small HTML fixture with one entry); several words → `''` without a request |
| chatglm | no API key → rejects `'invalid apikey'`; streaming success with `setResult` (stub global `fetch` with an SSE `ReadableStream`; snapshot the request incl. the JWT `Authorization`) |
| deepl | as the worked example |
| ecdict | POSTs `{ text }`; returns `res.data` as is |
| geminipro | non-streaming success; streaming with `setResult` (stub `window.fetch`); streaming without `setResult` → `'[STREAM]'` |
| google | sentence → string; word with `result[1]` → dictionary object; custom URL; error |
| lingva | `/` encoded as `@@` in the path; success; no `translation` → `TypeError` (known issue) |
| niutrans | `https: true` vs falsy → scheme; success; error |
| ollama | streaming with `setResult` (stub global `fetch`, NDJSON body); without `setResult` → `'[STREAM]'` |
| openai | non-streaming success (strips quotes); streaming with `setResult` (stub `window.fetch`); azure `api-key` header and no `model`; `requestPath` normalisation; streaming without `setResult` → `'[STREAM]'` |
| tencent | TC3-signed POST; success; error |
| transmart | headers only when username/token set; success; error |
| volcengine | HMAC-signed POST; success; error |
| yandex | uuid id in the query; success; error |
| youdao | word → dictionary object (two extra speech GETs, `responseType: 3`); sentence → string; error |

- [ ] **Step 1–21: one step per service in the table** (alphabetical), each following the recipe and committed on its own.
- [ ] **Step 22: Ship the PR** (title "Add characterization tests for the translate services").

---

### Task 6: Recognize, TTS and collection service tests (PR 4)

Branch `test/ocr-tts-collection-services`. Same recipe and commit pattern as Task 5. Files: `src/services/recognize/<dir>/index.test.ts`, `src/services/tts/lingva/index.test.ts`, `src/services/collection/<dir>/index.test.ts`.

| Service (dir) | Cases |
| --- | --- |
| baidu_ocr (`baidu`), baidu_accurate_ocr (`baidu_accurate`) | token POST then OCR POST (form body); lines joined; token failure → `'Get Access Token Failed!'` |
| baidu_img_ocr (`baidu_img`) | missing appid/secret error; reads `AppCache:pot_screenshot_cut.png` from `fakeTauri.files` (not the `base64` argument); multipart body; `auto` → `sumSrc`, otherwise `sumDst` |
| iflytek_ocr, iflytek_intsig_ocr | signed POST URL (`authorization`, `host`, `date`); base64 payload decoded; error |
| iflytek_latex_ocr | `Date`/`Digest`/`Authorization` headers; latex markers stripped |
| simple_latex_ocr | reads the cut screenshot; multipart `file`; `token` header; returns `latex` |
| tencent_ocr, tencent_accurate_ocr, tencent_img_ocr | TC3-signed POST; lines joined / `SourceText` for auto, `TargetText` otherwise |
| volcengine_ocr, volcengine_multi_lang_ocr | signed `Body.text` POST; `line_texts` / `ocr_infos[].text`; no `data` → `TypeError` (known issue) |
| system | `osType` per OS via `initEnv()`; Windows: `invoke('system_ocr', { lang: 'en-US' })`, zh/ja spaces removed, `auto` + detected `zh_cn` removes spaces; Linux: tesseract codes; macOS: no space stripping; `pt_pt` → `lang: undefined` (known issue) |
| tesseract | `vi.mock('tesseract.js')` with a fake `createWorker`; options (`workerPath`, `corePath`, `langPath`) snapshotted; chi_sim spaces removed |
| qrcode | stub `document.createElement('CANVAS').getContext` and `Image` so `onload` fires; `vi.mock('jsqr')`; returns `code.data`; no code → `'QR code not recognized or multiple QR codes exist'` |
| lingva_tts (`tts/lingva`) | default and custom `requestPath`; returns `audio`; HTTP error → `undefined` (known issue) |
| anki | three POSTs (`createDeck`, `createModel`, `addNote`) to `http://127.0.0.1:<port>`; legacy `store.get('anki')` fallback |
| eudic | category GET (exists / missing → POST), then words POST; returns `message`; failures → `'Get Category Failed'` / `'Create Category Failed'` |

- [ ] **Steps: one per service**, then **ship the PR** (title "Add characterization tests for the OCR, TTS and collection services").

---

### Task 7: Render tests for the windows (PR 5, part 1)

Branch `test/render`. Files: `src/App.test.tsx`, `src/window/Translate/index.test.tsx`, `src/window/Recognize/index.test.tsx`, `src/window/Screenshot/index.test.tsx`, `src/window/Updater/index.test.tsx`, `src/window/Config/index.test.tsx`.

Pattern (each file sets its window label in `vi.hoisted`, imports `../../i18n` so labels are English, renders inside `NextUIProvider` + `MemoryRouter` where routing is used, and ends with `expect(fakeTauri.unhandled).toEqual([])`):

```tsx
import { render, screen } from '@testing-library/react';
import { NextUIProvider } from '@nextui-org/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'translate' }], __currentWindow: { label: 'translate' } };
});

import Translate from './index';

describe('Translate window', () => {
    it('renders the source box and a card per default translate service', async () => {
        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );
        expect(await screen.findByText('DeepL')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
```

Labels to assert: Translate — the default services' titles from `en_US.json` (`services.translate.<name>.title` for deepl, bing, lingva, yandex, google, ecdict) and the source text box; Recognize — the Recognize and Translate buttons' labels; Screenshot — an `img` whose `src` is the asset URL of `/fake/AppCache/pot_screenshot.png` after `invoke('screenshot')`; Updater — with `fakeTauri.update = { version: '3.1.0', body: 'Release notes here', date: '2026-01-01' }`, the notes appear; Config — the eight sidebar labels; App — with label `config` it renders the Config sidebar.

- [ ] **Steps: one per file** (write, run, mutation check: delete one rendered element's label key from the component temporarily, see the test fail, restore), commit `Add a render test for the <name> window`.

### Task 8: Render tests for the Config pages (PR 5, part 2)

Same branch. Files: `src/window/Config/pages/<Page>/index.test.tsx` for General, Translate, Recognize, Hotkey, Service, History, Backup, About. Each renders the page in `NextUIProvider` + `MemoryRouter`, asserts the page's own labels (from `config.<page>.*` in `en_US.json`), and asserts `fakeTauri.unhandled` is empty. Service: the four tabs and the default instances (`DeepL`, `Bing`, … on the translate tab). History: an empty table with `fakeTauri.sqlRows = []`, and one row when `sqlRows` holds `{ id: 1, text: 'hello', source: 'en', target: 'zh_cn', service: 'deepl', result: '你好', timestamp: 1767323045678 }`. About: version `3.0.7`.

- [ ] **Steps: one per page**, commit `Add a render test for the <page> settings page`; then **ship the PR** (title "Add render tests for every window and settings page"), updating `docs/agents/testing.md` with a "Render tests" section describing the pattern above.

---

### Task 9: Real-app smoke test and IDE run configurations (PR 6)

Branch `test/smoke`.

**Files:**
- Create: `scripts/smoke.ts` (orchestrates), `scripts/smoke/windows.ps1` (Win32 + UI Automation helpers)
- Create: `.run/Tauri dev.run.xml`, `.run/Unit tests.run.xml`, `.run/Smoke test.run.xml`, `.run/Docs check.run.xml`
- Modify: `package.json` (`smoke` script), `.gitignore` (`test-results/`)
- Modify: `docs/agents/testing.md`, `docs/agents/setup-and-run.md`, `AGENTS.md`, three READMEs

**Interfaces:**
- `pnpm smoke [--out <dir>]` exits 0 when every scenario passes, 1 otherwise; writes `<out>/report.json` and one PNG per scenario; default out `test-results/smoke/<YYYYMMDD-HHMMSS>`.
- `scripts/smoke/windows.ps1 -Action <list|capture|close|text> [-Handle <hwnd>] [-Path <png>]` prints JSON: `list` → `[{ handle, title, visible, processPath }]` for windows of processes named `pot`; `capture` saves the window's screen rectangle to `-Path`; `close` posts `WM_CLOSE`; `text` → all UI Automation `Edit`/`Document` values inside the window.

**Scenarios** (each: send the request, wait up to 15 s for a visible `pot` window with the title, capture it, read its text where stated, close it):

| Scenario | Request | Window title | Assertion |
| --- | --- | --- | --- |
| config | `GET /config` | `Config` | window appears |
| translate | `POST /translate` body `hello world` | `Translate` | window appears; UIA text contains `hello world` |
| input | `GET /input_translate` | `Translate` | window appears |
| ocr | write a PNG with the text `Hello World` (drawn by PowerShell) to `%LOCALAPPDATA%\com.pot-app.desktop\pot_screenshot_cut.png`, then `GET /ocr_recognize?screenshot=false` | `Recognize` | window appears; UIA text contains `Hello World` (system OCR, offline) |

Before the scenarios: `GET /__smoke_probe` must get an HTTP response (the server answers unknown URLs with 500) within 2 s, otherwise exit 1 with `app not running on 127.0.0.1:60828 — start it with the "Tauri dev" run configuration`; `windows.ps1 -Action list` must show a `pot` process whose path ends with `src-tauri\target\debug\pot.exe`, otherwise exit 1 (Review Focus 4). After the scenarios: read `%APPDATA%\com.pot-app.desktop\logs\pot.log`, and fail on any line written during the run that contains `[ERROR]` or `panicked`.

- [ ] **Step 1: Write `scripts/smoke/windows.ps1`, `scripts/smoke.ts`, the `smoke` script (`tsx scripts/smoke.ts`), and `test-results/` in `.gitignore`.**
- [ ] **Step 2: Write the four `.run/*.run.xml` files** (npm run configurations: `tauri dev`, `test`, `smoke`, `check:docs`), and confirm RustRover lists them (`get_run_configurations`).
- [ ] **Step 3: Real-app run from the IDE.** Start "Tauri dev" through RustRover (`execute_run_configuration`, not waiting for exit); when the app's port answers, run "Smoke test" through RustRover; read `report.json` and look at every PNG. Expected: 4/4 scenarios pass. Copy the run directory to `test-results/smoke/baseline-js/` — Plan 3 compares against it. Quit the app (tray Quit, or `taskkill /IM pot.exe`).
- [ ] **Step 4: Prove the smoke test can fail:** with the app stopped, `pnpm smoke` exits 1 with the "app not running" message.
- [ ] **Step 5: Docs.** `testing.md` gets a "Real-app smoke test" section (how to run it from RustRover and the terminal, what it checks, where results go, the baseline); `setup-and-run.md` "In RustRover" lists the shared run configurations; `AGENTS.md` Commands gets `pnpm smoke`; the READMEs' build-from-source steps list `pnpm test` and `pnpm smoke`. Commit per topic; ship the PR (title "Add a real-app smoke test and shared IDE run configurations").

---

### Task 10: Verify the phase

- [ ] `git switch main && git pull --ff-only`; `pnpm install --frozen-lockfile`; `pnpm check:docs`; `pnpm test` twice (no snapshot written or changed: `git status --short` empty); `pnpm build`.
- [ ] Count: one `index.test.ts` per built-in service — `ls src/services/*/*/index.test.ts | wc -l` → 39.
- [ ] CI green on `main`; six PRs merged with merge commits; only `main` locally and on `origin`.
- [ ] Report: test counts, the smoke baseline location, anything found but not fixed (added to `known-issues.md`).
