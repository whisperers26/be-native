import { invoke } from '@tauri-apps/api/tauri';

// The backend shows and focuses the window, so that its test mode can keep the window from taking the focus
// (docs/agents/testing.md).
// Whether the backend's test mode is on.
export function isTestMode(): Promise<boolean> {
    return invoke('test_mode');
}

export function showWindow(): Promise<void> {
    return invoke('show_window');
}

export function focusWindow(): Promise<void> {
    return invoke('focus_window');
}
