import { invoke } from '@tauri-apps/api';

// An entry of the server's listing, as the webdav command serialises it: a file has a File key, a folder a Folder key.
interface WebDavEntry {
    File?: { href: string };
}

export async function backup(url: string, username: string, password: string, name: string) {
    return await invoke('webdav', {
        operate: 'put',
        url,
        username,
        password,
        name,
    });
}

export async function list(url: string, username: string, password: string) {
    const backup_list_text = await invoke<string>('webdav', {
        operate: 'list',
        url,
        username,
        password,
    });
    let backup_list: WebDavEntry[] = JSON.parse(backup_list_text);
    backup_list = backup_list.filter((item) => {
        return item.hasOwnProperty('File');
    });
    return backup_list.map((file) => {
        // The filter above keeps only the entries that have a File.
        return file.File!.href.split('/').slice(-1)[0];
    });
}

export async function get(url: string, username: string, password: string, name: string) {
    const _ = await invoke('webdav', {
        operate: 'get',
        url,
        username,
        password,
        name,
    });
}

export async function remove(url: string, username: string, password: string, name: string) {
    return await invoke('webdav', {
        operate: 'delete',
        url,
        username,
        password,
        name,
    });
}
