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
    cursor_position: () => ({ x: 0, y: 0, monitor: { x: 0, y: 0 } }),
    show_window: () => null,
    fit_translate_window: () => null,
    translate_window_waiting: () => false,
    translate_window_origin: () => [0, 0],
    translate_window_opened: () => null,
    focus_window: () => null,
    test_mode: () => false,
    cut_image: () => null,
    copy_img: () => null,
    system_ocr: () => '',
    lang_detect: () => 'en',
    agent_cli_run: () => '',
    get_writing_text: () => '',
    fit_writing_window: () => null,
    writing_replace: () => null,
    set_proxy: () => true,
    unset_proxy: () => true,
    install_plugin: () => 0,
    run_binary: () => ({ stdout: '', stderr: '', status: 0 }),
    font_list: () => ['Arial', 'Segoe UI'],
    open_devtools: () => null,
    register_shortcut_by_frontend: () => null,
    update_tray: () => null,
    updater_window: () => null,
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
    /** The current window: its size in physical pixels and the scale of the monitor it is on. */
    window = { size: { width: 800, height: 600 }, scaleFactor: 1 };
    appVersion = '3.0.7';
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
        this.window = { size: { width: 800, height: 600 }, scaleFactor: 1 };
        this.sqlRows = [];
        this.appVersion = '3.0.7';
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
                if (cmd === 'getAppVersion') return this.appVersion;
                if (cmd === 'getAppName') return 'Be Native';
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
                return this.window.scaleFactor;
            case 'innerPosition':
            case 'outerPosition':
                return { x: 0, y: 0 };
            case 'innerSize':
            case 'outerSize':
                return this.window.size;
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
                return /COUNT\(\*\)/.test(String(args.query)) ? [{ 'COUNT(*)': this.sqlRows.length }] : this.sqlRows;
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
