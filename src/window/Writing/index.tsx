import { Button, Input } from '@nextui-org/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { AiFillCloseCircle } from 'react-icons/ai';
import { BsPinFill } from 'react-icons/bs';
import { LuCornerDownLeft, LuPalette, LuPenLine } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { error as logError } from 'tauri-plugin-log-api';

import Grow, { GROW_MS } from './Grow';
import ResultCard from './ResultCard';
import { customResults, defaultResults, enabledServices, toneResults } from './results';
import { DEFAULT_TONES } from '../../utils/writing_tones';
import { focusWindow, isTestMode, showWindow } from '../../utils/window';
import { osType } from '../../utils/env';
import { store } from '../../utils/store';
import { useConfig } from '../../hooks';
import type { KeyboardEvent } from 'react';
import type { ServiceConfigMap } from '../../types/service';
import type { ResultSpec } from './results';
import type { Tone } from '../../utils/writing_tones';

const DEFAULT_SERVICE_LIST = ['llm7'];
// In test mode only the free default service is asked: the owner's services may be paid for.
const TEST_MODE_SERVICE_LIST = ['llm7'];
// The bar with the pin and close buttons, and the room under the last box.
const BAR_HEIGHT = 35;
const BOTTOM_PADDING = 8;
// The window is at most this part of the screen's work area tall; beyond that what it shows scrolls.
const TALLEST = 0.8;

export default function Writing() {
    const { t } = useTranslation();
    const [configuredServiceList] = useConfig('writing_service_list', DEFAULT_SERVICE_LIST);
    const [tones] = useConfig<Tone[]>('writing_tones', DEFAULT_TONES);
    const [closeOnBlur] = useConfig('writing_close_on_blur', true);
    const [windowAnimation] = useConfig('writing_window_animation', true);
    const animated = windowAnimation !== false;
    const [testMode, setTestMode] = useState<boolean | null>(null);
    useEffect(() => {
        void isTestMode().then(setTestMode);
    }, []);
    const serviceList = testMode === null ? null : testMode ? TEST_MODE_SERVICE_LIST : configuredServiceList;

    const [configs, setConfigs] = useState<ServiceConfigMap | null>(null);
    useEffect(() => {
        if (serviceList === null) return;
        void (async () => {
            const map: ServiceConfigMap = {};
            for (const key of serviceList) {
                map[key] = (await store.get(key)) ?? {};
            }
            setConfigs(map);
        })();
    }, [serviceList]);
    const services = serviceList !== null && configs !== null ? enabledServices(serviceList, configs) : null;

    // The text to improve. Each new one starts the window over: `version` makes its boxes new ones.
    const [text, setText] = useState('');
    const [version, setVersion] = useState(0);
    // The boxes after the default ones, in the order they were asked for, so that a box stays where it is.
    const [moreSpecs, setMoreSpecs] = useState<ResultSpec[]>([]);
    const [tonesAsked, setTonesAsked] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [customRequest, setCustomRequest] = useState('');
    const customRound = useRef(0);
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [pinned, setPinned] = useState(false);

    useEffect(() => {
        const start = (value: string) => {
            setText(value.trim());
            setVersion((count) => count + 1);
            setMoreSpecs([]);
            setTonesAsked(false);
            setCustomOpen(false);
            setCustomRequest('');
            setBusy({});
        };
        void invoke<string>('get_writing_text').then(start);
        const unlisten = listen<string>('new_writing_text', (event) => start(event.payload));
        return () => {
            void unlisten.then((f) => f());
        };
    }, []);

    // The window closes when it loses the focus, unless that is switched off or the window is pinned.
    useEffect(() => {
        if (closeOnBlur !== true || pinned) return;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const cancel = () => {
            if (timeout) clearTimeout(timeout);
            timeout = null;
    // When the window last asked for its height, which can move it.
    const lastFit = useRef(0);
        };
        // Dragging the window loses the focus and gets it back at once (Windows), so the close waits a moment.
        const listeners = [
            listen('tauri://blur', () => {
                cancel();
                timeout = setTimeout(() => void appWindow.close(), 100);
            }),
            listen('tauri://focus', cancel),
            // A move by the user, who is dragging the window; not one the window's own fit made.
            listen('tauri://move', () => {
                if (performance.now() - lastFit.current > 300) cancel();
            }),
        ];
        return () => {
            cancel();
            for (const listener of listeners) void listener.then((f) => f());
        };
    }, [closeOnBlur, pinned]);

    const onBusy = useCallback((id: string, value: boolean) => {
        setBusy((all) => (Boolean(all[id]) === value ? all : { ...all, [id]: value }));
    }, []);
    const onReplace = useCallback((result: string) => {
        if (replacing.current) return;
        replacing.current = true;
        invoke('writing_replace', { text: result })
            .catch((e) => {
                void logError(`Writing improvement: replace failed: ${e}`);
            })
            .finally(() => {
                replacing.current = false;
            });
    }, []);

    const askTones = () => {
        if (services === null || tones === null) return;
        setTonesAsked(true);
        setMoreSpecs((specs) => [...specs, ...toneResults(tones, services)]);
    };
    const askCustom = () => {
    // One result is picked: a second click before the window has closed picks nothing.
    const replacing = useRef(false);
        const request = customRequest.trim();
        if (services === null || request === '') return;
        const round = customRound.current++;
        setMoreSpecs((specs) => [...specs, ...customResults(request, services, round)]);
        setCustomRequest('');
    };
    const isBusy = (kind: 'tone' | 'custom') =>
        moreSpecs.some((spec) => spec.id.startsWith(`${kind}/`) && busy[spec.id]);
    const customInput = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (customOpen) customInput.current?.focus();
    }, [customOpen]);

    // The window is as tall as what it shows. It asks for its height on every change, which while a box grows is
    // every frame, so that its bottom edge moves with the box: one request at a time, each for the height of the
    // moment it is made.
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [capped, setCapped] = useState(false);
    const laidOut = services !== null;
    useEffect(() => {
        const content = contentRef.current;
        if (!laidOut || content === null) return;
        let asking = false;
        let again = false;
        let asked = -1;
        let shown = false;
        const fit = async () => {
            if (asking) {
                again = true;
                return;
            }
            if (content.offsetHeight === 0) return;
            const wanted = BAR_HEIGHT + content.offsetHeight + BOTTOM_PADDING;
            const tallest = Math.round((window.screen?.availHeight || 1000) * TALLEST);
            const height = Math.min(wanted, tallest);
            setCapped(wanted > tallest);
            if (height !== asked) {
                asking = true;
                asked = height;
                try {
                    await invoke('fit_writing_window', { height });
                } finally {
                    asking = false;
                }
            }
            if (!shown) {
                lastFit.current = performance.now();
                // Not before it has its height: a window seen at the size Rust opened it with would jump.
                shown = true;
                void showWindow().then(focusWindow);
            }
            if (again) {
                again = false;
                void fit();
            }
        };
        const observer = new ResizeObserver(() => void fit());
        observer.observe(content);
        void fit();
        return () => observer.disconnect();
    }, [laidOut]);
    // A window as tall as it may be scrolls to the boxes that were just added, once they have their height.
    const boxCount = moreSpecs.length;
    useEffect(() => {
        if (boxCount === 0) return;
        const timeout = setTimeout(
            () => {
                const scroll = scrollRef.current;
                scroll?.scrollTo?.({ top: scroll.scrollHeight, behavior: animated ? 'smooth' : 'auto' });
            },
            animated ? GROW_MS + 40 : 0
        );
        return () => clearTimeout(timeout);
    }, [boxCount]);

    const card = (spec: ResultSpec) => (
        <Grow
            key={`${version}/${spec.id}`}
            animated={animated}
        >
            <div className='pb-[8px]'>
                <ResultCard
                    text={text}
                    spec={spec}
                    config={configs?.[spec.service] ?? {}}
                    onBusy={onBusy}
                    onReplace={onReplace}
                />
            </div>
        </Grow>
    );

    return (
        services !== null && (
            <div
                className={`bg-background h-screen w-screen overflow-hidden ${
                    osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
                }`}
            >
                <div
                    className='fixed top-[5px] left-[5px] right-[5px] h-[30px]'
                    data-tauri-drag-region='true'
                />
                <div className={`h-[35px] w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='flat'
                        disableAnimation
                        className='my-auto bg-transparent'
                        onPress={() => {
                            void appWindow.setAlwaysOnTop(!pinned);
                            setPinned(!pinned);
                        }}
                    >
                        <BsPinFill className={`text-[20px] ${pinned ? 'text-primary' : 'text-default-400'}`} />
                    </Button>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='flat'
                        disableAnimation
                        className={`my-auto ${osType === 'Darwin' && 'hidden'} bg-transparent`}
                        onPress={() => {
                            void appWindow.close();
                        }}
                    >
                        <AiFillCloseCircle className='text-[20px] text-default-400' />
                    </Button>
                </div>
                <div
                    ref={scrollRef}
                    // No scrollbar while the window follows what it shows: one that came and went would take width
                    // from the text and wrap it anew.
                    className={`h-[calc(100vh-35px)] px-[8px] ${capped ? 'overflow-y-auto' : 'overflow-hidden'}`}
                >
                    <div ref={contentRef}>
                        {services.length === 0 && (
                            <p className='pb-[8px] text-[14px] text-default-500'>{t('writing.no_service')}</p>
                        )}
                        {text !== '' && defaultResults(services).map(card)}
                        <div className='flex gap-[8px] pb-[8px]'>
                            <Button
                                size='sm'
                                variant='flat'
                                startContent={!isBusy('tone') && <LuPalette className='text-[16px]' />}
                                isLoading={isBusy('tone')}
                                isDisabled={text === '' || services.length === 0 || tonesAsked}
                                onPress={askTones}
                            >
                                {t('writing.tones')}
                            </Button>
                            <Button
                                size='sm'
                                variant={customOpen ? 'solid' : 'flat'}
                                startContent={!isBusy('custom') && <LuPenLine className='text-[16px]' />}
                                isLoading={isBusy('custom')}
                                isDisabled={text === '' || services.length === 0}
                                onPress={() => setCustomOpen(!customOpen)}
                            >
                                {t('writing.custom_prompt')}
                            </Button>
                        </div>
                        <Grow
                            animated={animated}
                            open={customOpen}
                        >
                            {/* Kept while closed, so that it can close as smoothly as it opens. */}
                            <div className='flex gap-[8px] pb-[8px]'>
                                <Input
                                    ref={customInput}
                                    isDisabled={!customOpen}
                                    size='sm'
                                    variant='bordered'
                                    aria-label={t('writing.custom_prompt')}
                                    placeholder={t('writing.custom_placeholder')}
                                    value={customRequest}
                                    onValueChange={setCustomRequest}
                                    onKeyDown={(e: KeyboardEvent) => {
                                        // Enter that ends an input method's composition is not Enter.
                                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                            e.preventDefault();
                                            askCustom();
                                        }
                                    }}
                                />
                                <Button
                                    isIconOnly
                                    size='sm'
                                    color='primary'
                                    className='my-auto'
                                    aria-label={t('writing.enter')}
                                    isDisabled={customRequest.trim() === ''}
                                    onPress={askCustom}
                                >
                                    <LuCornerDownLeft className='text-[16px]' />
                                </Button>
                            </div>
                        </Grow>
                        {moreSpecs.map(card)}
                    </div>
                </div>
            </div>
        )
    );
}
