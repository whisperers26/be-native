import { save, open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api';

export async function backup() {
    const selected = await save({
        filters: [
            {
                name: 'Backup',
                extensions: ['zip'],
            },
        ],
    });
    if (selected !== null) {
        return await invoke('local', {
            operate: 'put',
            path: selected,
        });
    } else {
        throw 'Invalid File';
    }
}

export async function get() {
    const selected = await open({
        multiple: false,
        directory: false,
        filters: [
            {
                name: '*.zip',
                extensions: ['zip'],
            },
        ],
    });

    // multiple is false, so the dialog answers with one path; open's type does not follow that option.
    if (selected !== null && (selected as string).endsWith('zip')) {
        return await invoke('local', {
            operate: 'get',
            path: selected,
        });
    } else {
        throw 'Invalid File';
    }
}
