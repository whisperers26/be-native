import { BaseDirectory, readTextFile } from '@tauri-apps/api/fs';
import { sendNotification } from '@tauri-apps/api/notification';
import { writeText } from '@tauri-apps/api/clipboard';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { error as logError } from 'tauri-plugin-log-api';
import { invoke } from '@tauri-apps/api';
import { useEffect } from 'react';
import { t } from 'i18next';

import { getServiceName, whetherPluginService } from '../../utils/service_instance';
import { mergeLines } from '../../utils/merge_lines';
import { invoke_plugin } from '../../utils/invoke_plugin';
import * as builtinServices from '../../services/recognize';
import { store } from '../../utils/store';
import type { PluginInfo, RecognizeService, ServiceConfig } from '../../types/service';

// The registry is looked up by a name known only at run time.
type RecognizeServices = Record<string, RecognizeService>;

// Recognize the cut screenshot the way the Recognize window does when it opens: with the first OCR instance and the
// default recognition language.
async function recognize(): Promise<string> {
    const base64 = await invoke<string>('get_base64');
    const serviceInstanceList = (await store.get<string[]>('recognize_service_list')) ?? ['system', 'tesseract'];
    const language = (await store.get<string>('recognize_language')) ?? 'auto';
    const mergeWrappedLines = (await store.get<boolean>('recognize_merge_lines')) ?? true;
    const instanceKey = serviceInstanceList[0];
    const config = (await store.get<ServiceConfig>(instanceKey)) ?? {};
    const serviceName = getServiceName(instanceKey);

    let text: string | undefined;
    if (whetherPluginService(instanceKey)) {
        const pluginInfo: PluginInfo = JSON.parse(
            await readTextFile(`plugins/recognize/${serviceName}/info.json`, { dir: BaseDirectory.AppConfig })
        );
        if (!(language in pluginInfo.language)) throw 'Language not supported';
        const [func, utils] = await invoke_plugin('recognize', serviceName);
        text = await func(base64, pluginInfo.language[language], { config, utils });
    } else {
        const service = (builtinServices as RecognizeServices)[serviceName];
        if (!(language in service.Language)) throw 'Language not supported';
        text = await service.recognize(base64, service.Language[language], { config });
    }

    text = (text ?? '').trim();
    if (mergeWrappedLines) {
        text = mergeLines(text);
    }
    if (text === '') throw t('silent_recognize.no_text');
    return text;
}

/**
 * The `silent_recognize` window, which is never shown: it copies the text of the cut screenshot to the clipboard and
 * closes. Only a failure is reported, as a system notification.
 */
export default function SilentRecognize() {
    useEffect(() => {
        // Rust sends new_image instead of opening the window again, so count what is still to do and close only
        // after the last one.
        let pending = 0;
        const run = async () => {
            pending += 1;
            try {
                const text = await recognize();
                // A newer capture replaces this one.
                if (pending === 1) await writeText(text);
            } catch (e) {
                void logError(`Silent recognition failed: ${String(e)}`);
                sendNotification({ title: t('silent_recognize.failed'), body: String(e) });
            }
            pending -= 1;
            if (pending === 0) await appWindow.close();
        };

        void run();
        const unlisten = listen('new_image', () => void run());
        return () => {
            void unlisten.then((f) => f());
        };
    }, []);

    return null;
}
