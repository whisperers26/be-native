import { useCallback, useEffect } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { useGetState } from './useGetState';
import { store, cachedValue, cacheValue } from '../utils/store';
import { debounce } from '../utils';

export const useConfig = <T>(
    key: string,
    defaultValue: T,
    options: { sync?: boolean } = {}
): [T | null, (value: T, forceSync?: boolean) => void, () => T | null] => {
    const [property, setPropertyState, getProperty] = useGetState<T | null>(() => cachedValue<T>(key));
    const { sync = true } = options;

    // 同步到Store (State -> Store)
    const syncToStore = useCallback(
        debounce((v: T) => {
            cacheValue(key, v);
            store.set(key, v);
            store.save();
            let eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
            emit(`${eventKey}_changed`, v);
        }),
        []
    );

    // 同步到State (Store -> State)
    const syncToState = useCallback((v: T | null) => {
        if (v !== null) {
            cacheValue(key, v);
            setPropertyState(v);
        } else {
            store.get<T>(key).then((v) => {
                if (v === null) {
                    cacheValue(key, defaultValue);
                    setPropertyState(defaultValue);
                    store.set(key, defaultValue);
                    store.save();
                } else {
                    cacheValue(key, v);
                    setPropertyState(v);
                }
            });
        }
    }, []);

    const setProperty = useCallback((v: T, forceSync = false) => {
        setPropertyState(v);
        const isSync = forceSync || sync;
        isSync && syncToStore(v);
    }, []);

    // 初始化
    useEffect(() => {
        syncToState(null);
        const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
        const unlisten = listen<T>(`${eventKey}_changed`, (e) => {
            syncToState(e.payload);
        });
        return () => {
            unlisten.then((f) => {
                f();
            });
        };
    }, []);

    return [property, setProperty, getProperty];
};

export const deleteKey = (key: string) => {
    // @ts-expect-error store.has() returns a promise that is never awaited, so the condition is always true
    if (store.has(key)) {
        cacheValue(key, null);
        store.delete(key);
        store.save();
    }
};
