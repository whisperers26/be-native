import { describe, expect, it } from 'vitest';
import {
    createServiceInstanceKey,
    getDisplayInstanceName,
    getServiceName,
    getServiceSouceType,
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    ServiceType,
    whetherAvailableService,
    whetherPluginService,
} from './service_instance';

describe('service instance keys', () => {
    it('names the four service types and two source types', () => {
        expect(ServiceType).toEqual({
            TRANSLATE: 'translate',
            RECOGNIZE: 'recognize',
            TTS: 'tts',
            COLLECTION: 'collection',
        });
        expect(ServiceSourceType).toEqual({ BUILDIN: 'buildin', PLUGIN: 'plugin' });
        expect(INSTANCE_NAME_CONFIG_KEY).toBe('instanceName');
    });

    it('treats keys starting with "plugin" as plugins and everything else as built-in', () => {
        expect(getServiceSouceType('plugin_demo@abc')).toBe('plugin');
        expect(getServiceSouceType('plugin_demo')).toBe('plugin');
        expect(getServiceSouceType('deepl@abc')).toBe('buildin');
        expect(getServiceSouceType('deepl')).toBe('buildin');
        expect(whetherPluginService('plugin_demo@abc')).toBe(true);
        expect(whetherPluginService('deepl')).toBe(false);
    });

    it('creates "<name>@<random base-36 id>" keys', () => {
        const id = (0.123456789).toString(36).substring(2);
        expect(createServiceInstanceKey('deepl')).toBe(`deepl@${id}`);
    });

    it('takes the service name from before the "@", or the whole legacy key', () => {
        expect(getServiceName('deepl@abc')).toBe('deepl');
        expect(getServiceName('plugin_demo@abc')).toBe('plugin_demo');
        expect(getServiceName('deepl')).toBe('deepl');
    });

    it('shows the instance name, or the supplier when it is empty', () => {
        expect(getDisplayInstanceName('', () => 'DeepL')).toBe('DeepL');
        expect(getDisplayInstanceName('My DeepL', () => 'DeepL')).toBe('My DeepL');
    });

    it('looks services up in the list for their source type', () => {
        const available = { buildin: { deepl: {} }, plugin: { plugin_demo: {} } };
        expect(whetherAvailableService('deepl@1', available)).toBe(true);
        expect(whetherAvailableService('bing@1', available)).toBe(false);
        expect(whetherAvailableService('plugin_demo@1', available)).toBe(true);
        expect(whetherAvailableService('plugin_other', available)).toBe(false);
        expect(whetherAvailableService('deepl', { plugin: {} } as never)).toBe(false);
    });
});
