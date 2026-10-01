/**
 * Real-app smoke test (Windows). Start the app first, with the "Tauri dev" run configuration
 * or `pnpm tauri dev`, then run `pnpm smoke [--out <dir>]`.
 *
 * It puts the app in test mode, drives it through its local HTTP API, waits for each window to appear,
 * reads the window's text through UI Automation, saves a screenshot, and closes the window. It does not
 * touch the mouse, the keyboard or the focus, so it can run while the computer is in use.
 * Afterwards it fails on any error or panic the app logged during the run.
 * Results: <out>/report.json and one PNG per scenario (default out: test-results/smoke/<time>).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyLogLines } from './smoke/log';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HELPER = join(ROOT, 'scripts', 'smoke', 'windows.ps1');
const DEV_BINARY = join('src-tauri', 'target', 'debug', 'Be Native.exe');
const APP_TITLES = ['Config', 'Translate', 'Recognize', 'Screenshot', 'Updater'];
const APP_DIR = 'com.pot-app.desktop';
const CONFIG_FILE = join(process.env.APPDATA ?? '', APP_DIR, 'config.json');
const LOG_FILE = join(process.env.APPDATA ?? '', APP_DIR, 'logs', 'pot.log');
const CUT_FILE = join(process.env.LOCALAPPDATA ?? '', APP_DIR, 'pot_screenshot_cut.png');

interface AppWindow {
    handle: number;
    title: string;
    visible: boolean;
    processPath: string | null;
}

interface Scenario {
    name: string;
    title: string;
    expectText?: string;
    prepare?: () => void;
    request: (api: string) => Promise<unknown>;
}

interface Result {
    name: string;
    ok: boolean;
    title: string;
    screenshot?: string;
    text?: string[];
    error?: string;
}

function helper(...args: string[]): string {
    return execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HELPER, ...args], {
        encoding: 'utf8',
    }).trim();
}

function listWindows(): AppWindow[] {
    const output = helper('-Action', 'list');
    return output ? (JSON.parse(output) as AppWindow[]) : [];
}

function visibleAppWindows(): AppWindow[] {
    return listWindows().filter((window) => window.visible && APP_TITLES.includes(window.title));
}

function readPort(): number {
    try {
        const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as { server_port?: number };
        return config.server_port ?? 60828;
    } catch {
        return 60828;
    }
}

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function isListening(api: string): Promise<boolean> {
    try {
        // Unknown paths only log a warning in the app and get an HTTP error back.
        await fetch(`${api}/__smoke_probe`, { signal: AbortSignal.timeout(2000) });
        return true;
    } catch {
        return false;
    }
}

async function setTestMode(api: string, on: boolean): Promise<boolean> {
    try {
        return (await fetch(`${api}/test_mode?on=${on}`, { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
        return false;
    }
}

async function waitFor<T>(what: string, check: () => T | undefined, timeoutMs = 15000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const found = check();
        if (found !== undefined) return found;
        if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
        await delay(300);
    }
}

async function closeAll(): Promise<void> {
    for (const window of visibleAppWindows()) helper('-Action', 'close', '-Handle', String(window.handle));
    await waitFor('app windows to close', () => (visibleAppWindows().length === 0 ? true : undefined));
}

const scenarios: Scenario[] = [
    {
        name: 'config',
        title: 'Config',
        expectText: 'General Settings',
        request: (api) => fetch(`${api}/config`),
    },
    {
        name: 'translate',
        title: 'Translate',
        expectText: 'hello world',
        request: (api) => fetch(`${api}/translate`, { method: 'POST', body: 'hello world' }),
    },
    {
        name: 'input',
        title: 'Translate',
        request: (api) => fetch(`${api}/input_translate`),
    },
    {
        // No text check: the Recognize window opened this way stays in its loading state
        // (docs/agents/known-issues.md). The screenshot still shows the image it received.
        name: 'ocr',
        title: 'Recognize',
        prepare: () => helper('-Action', 'fixture', '-Path', CUT_FILE, '-Text', 'Hello World'),
        request: (api) => fetch(`${api}/ocr_recognize?screenshot=false`),
    },
];

async function run(scenario: Scenario, api: string, outDir: string): Promise<Result> {
    const result: Result = { name: scenario.name, ok: false, title: scenario.title };
    try {
        scenario.prepare?.();
        await scenario.request(api);
        const window = await waitFor(`a visible "${scenario.title}" window`, () =>
            visibleAppWindows().find((candidate) => candidate.title === scenario.title)
        );
        if (scenario.expectText) {
            const expected = scenario.expectText;
            result.text = await waitFor(`"${expected}" in the ${scenario.title} window`, () => {
                const text = JSON.parse(helper('-Action', 'text', '-Handle', String(window.handle))) as string[];
                return text.some((value) => value.toLowerCase().includes(expected.toLowerCase())) ? text : undefined;
            });
        }
        result.screenshot = join(outDir, `${scenario.name}.png`);
        helper('-Action', 'capture', '-Handle', String(window.handle), '-Path', result.screenshot);
        result.ok = true;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
    }
    await closeAll().catch(() => undefined);
    return result;
}

function newLogErrors(fromByte: number): { appErrors: string[]; serviceErrors: string[] } {
    if (!existsSync(LOG_FILE)) return { appErrors: [], serviceErrors: [] };
    const log = readFileSync(LOG_FILE);
    const start = fromByte <= log.length ? fromByte : 0;
    return classifyLogLines(log.subarray(start).toString('utf8').split(/\r?\n/));
}

function outputDir(): string {
    const index = process.argv.indexOf('--out');
    if (index !== -1 && process.argv[index + 1]) return resolve(process.argv[index + 1]);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    return join(ROOT, 'test-results', 'smoke', stamp);
}

async function main(): Promise<number> {
    if (process.platform !== 'win32') {
        console.error('pnpm smoke runs on Windows only.');
        return 1;
    }
    const api = `http://127.0.0.1:${readPort()}`;
    if (!(await isListening(api))) {
        console.error(`app not running on ${api.slice(7)} — start it with the "Tauri dev" run configuration or pnpm tauri dev`);
        return 1;
    }
    const devWindow = listWindows().find((window) => window.processPath?.endsWith(DEV_BINARY));
    if (!devWindow) {
        console.error(`the app answering on ${api.slice(7)} is not this repository's dev build (${DEV_BINARY})`);
        return 1;
    }

    // In test mode the app opens its windows on the secondary monitor and leaves the focus where it is.
    if (!(await setTestMode(api, true))) {
        console.error('the app has no test mode: it was built before this branch — restart it');
        return 1;
    }

    const outDir = outputDir();
    mkdirSync(outDir, { recursive: true });
    const logStart = existsSync(LOG_FILE) ? statSync(LOG_FILE).size : 0;
    const results: Result[] = [];
    try {
        await closeAll();
        for (const scenario of scenarios) {
            const result = await run(scenario, api, outDir);
            results.push(result);
            console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${scenario.name}${result.error ? `  ${result.error}` : ''}`);
        }
    } finally {
        await setTestMode(api, false);
    }
    const { appErrors, serviceErrors } = newLogErrors(logStart);
    for (const line of appErrors) console.log(`ERROR ${line}`);
    for (const line of serviceErrors) console.log(`WARN  ${line.slice(0, 160)}`);

    const ok = results.every((result) => result.ok) && appErrors.length === 0;
    writeFileSync(
        join(outDir, 'report.json'),
        JSON.stringify({ ok, api, finishedAt: new Date().toISOString(), results, appErrors, serviceErrors }, null, 2)
    );
    const passed = results.filter((result) => result.ok).length;
    console.log(
        `\n${ok ? 'smoke: OK' : 'smoke: FAILED'} (${passed}/${results.length} scenarios, ${appErrors.length} app errors, ` +
            `${serviceErrors.length} service failures) → ${outDir}`
    );
    return ok ? 0 : 1;
}

process.exit(await main());
