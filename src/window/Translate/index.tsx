import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { appWindow, currentMonitor } from '@tauri-apps/api/window';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { Spacer, Button } from '@nextui-org/react';
import { AiFillCloseCircle } from 'react-icons/ai';
import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { BsPinFill } from 'react-icons/bs';
import { invoke } from '@tauri-apps/api';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import LanguageArea from './components/LanguageArea';
import SourceArea, { sourceHeightAtom, sourceTextAtom } from './components/SourceArea';
import TargetArea from './components/TargetArea';
import Progress from './components/Progress';
import { fitSize, limitsFor, MIN_WIDTH } from './auto_size';
import { cardProgressAtom, isReady, servicesInProgress, sourceBusyAtom, stageAtom } from './progress';
import * as builtinTranslateServices from '../../services/translate';
import * as builtinRecognizeServices from '../../services/recognize';
import { getServiceName, whetherPluginService } from '../../utils/service_instance';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import { store } from '../../utils/store';
import { isTestMode } from '../../utils/window';
import { info } from 'tauri-plugin-log-api';
import type { LogicalPosition, PhysicalPosition } from '@tauri-apps/api/window';
import type { DropResult } from 'react-beautiful-dnd';
import type { PluginList, RecognizeService, ServiceConfigMap, TranslateService } from '../../types/service';
import type { Size } from './auto_size';

let blurTimeout: ReturnType<typeof setTimeout> | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
let moveTimeout: ReturnType<typeof setTimeout> | null = null;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'translate') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            info('Blur');
            // 100ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                info('Confirm Blur');
                await appWindow.close();
            }, 100);
        }
    });
};

let unlisten = listenBlur();
// 取消 blur 监听
const unlistenBlur = () => {
    unlisten.then((f) => {
        f();
    });
};

// 监听 focus 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://focus', () => {
    info('Focus');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});
// 监听 move 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://move', () => {
    info('Move');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});

const TEST_MODE_SERVICE_LIST = ['google'];
// How long the window takes to open from its progress indicator: a little longer than Rust takes to resize it.
const OPENING = 260;

export default function Translate() {
    const [closeOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop] = useConfig('translate_always_on_top', false);
    const [windowPosition] = useConfig('translate_window_position', 'smart');
    const [rememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [configuredServiceInstanceList, setTranslateServiceInstanceList] = useConfig('translate_service_list', [
        'deepl',
        'bing',
        'lingva',
        'yandex',
        'google',
        'ecdict',
    ]);
    const [recognizeServiceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [collectionServiceInstanceList] = useConfig<string[]>('collection_service_list', []);
    const [hideLanguage] = useConfig('hide_language', false);
    const [pined, setPined] = useState(false);
    const [stage, setStage] = useAtom(stageAtom);
    // Rust says whether it opened the window to wait in or at its size (the input window).
    useEffect(() => {
        void invoke<boolean>('translate_window_waiting').then((waiting) => {
            if (!waiting) {
                setStage('shown');
            }
        });
    }, []);
    const [testMode, setTestMode] = useState<boolean | null>(null);
    // In test mode only Google translates: it is free, and the owner's services may be paid for.
    const translateServiceInstanceList =
        testMode === null ? null : testMode ? TEST_MODE_SERVICE_LIST : configuredServiceInstanceList;
    useEffect(() => {
        void isTestMode().then(setTestMode);
    }, []);
    const reorder = (list: string[], startIndex: number, endIndex: number) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination || testMode) return;
        const items = reorder(translateServiceInstanceList!, result.source.index, result.destination.index);
        setTranslateServiceInstanceList(items);
    };
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);
    // 是否默认置顶
    useEffect(() => {
        if (alwaysOnTop !== null && alwaysOnTop) {
            appWindow.setAlwaysOnTop(true);
            unlistenBlur();
            setPined(true);
        }
    }, [alwaysOnTop]);
    // 保存窗口位置
    // Not in test mode: a test must leave the owner's saved position and size as they are.
    useEffect(() => {
        if (testMode === false && windowPosition !== null && windowPosition === 'pre_state') {
            const unlistenMove = listen('tauri://move', async () => {
                if (moveTimeout) {
                    clearTimeout(moveTimeout);
                }
                moveTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        // Physical at first, logical after toLogical. A PhysicalPosition also fits LogicalPosition,
                        // so TypeScript does not narrow the union and the call needs the cast.
                        let position: PhysicalPosition | LogicalPosition = await appWindow.outerPosition();
                        const monitor = await currentMonitor();
                        // @ts-expect-error known bug (known-issues.md): currentMonitor() can return null
                        const factor = monitor.scaleFactor;
                        position = (position as PhysicalPosition).toLogical(factor);
                        // @ts-expect-error parseInt takes a string, and x is a number, which it converts
                        await store.set('translate_window_position_x', parseInt(position.x));
                        // @ts-expect-error parseInt takes a string, and y is a number, which it converts
                        await store.set('translate_window_position_y', parseInt(position.y));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenMove.then((f) => {
                    f();
                });
            };
        }
    }, [windowPosition, testMode]);
    // 保存窗口大小
    useEffect(() => {
        // Not before the window has opened from its progress indicator: that is not the user resizing it.
        if (testMode === false && stage === 'shown' && rememberWindowSize !== null && rememberWindowSize) {
            const unlistenResize = listen('tauri://resize', async () => {
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        // The inner size, which is what Rust sets when the window opens, and rounded: a
                        // whole number of logical pixels is not always a whole number of physical ones,
                        // and cutting the fraction off made the window a pixel smaller each time.
                        const size = (await appWindow.innerSize()).toLogical(await appWindow.scaleFactor());
                        await store.set('translate_window_height', Math.round(size.height));
                        await store.set('translate_window_width', Math.round(size.width));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenResize.then((f) => {
                    f();
                });
            };
        }
    }, [rememberWindowSize, testMode, stage]);

    const [pluginList, setPluginList] = useState<PluginList | null>(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState<ServiceConfigMap | null>(null);
    const sourceText = useAtomValue(sourceTextAtom);
    // The part of the window that scrolls, and all of what it shows.
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const setSourceHeight = useSetAtom(sourceHeightAtom);
    // Whether the next fit works the width out anew, which it does for new source text, and how to ask for a fit.
    const fitAnew = useRef(true);
    const requestFit = useRef<(() => void) | null>(null);

    // Until the window opens it is a progress indicator, and what it will show is laid out unseen at this size,
    // which becomes the size it opens to.
    const [layout, setLayout] = useState<Size>({ width: MIN_WIDTH, height: 240 });
    const layoutRef = useRef(layout);
    const sourceBusy = useAtomValue(sourceBusyAtom);
    const cards = useAtomValue(cardProgressAtom);
    const [pressed, setPressed] = useState(false);
    const cardCount =
        translateServiceInstanceList !== null && serviceInstanceConfigMap !== null
            ? translateServiceInstanceList.filter((key) => (serviceInstanceConfigMap[key] ?? {})['enable'] ?? true)
                  .length
            : null;
    // Pressing the indicator opens the window with whatever it has.
    const ready = pressed || isReady(sourceBusy, sourceText, cards, cardCount);
    const readyRef = useRef(ready);
    readyRef.current = ready;
    const opened = useRef(false);
    const open = (size: Size) => {
        if (opened.current) return;
        opened.current = true;
        setStage('opening');
        void invoke('fit_translate_window', { width: size.width, height: size.height });
        setTimeout(() => setStage('shown'), OPENING);
    };
    // A remembered size is the size the window opens to.
    useEffect(() => {
        if (stage !== 'waiting' || rememberWindowSize !== true) return;
        void (async () => {
            const size = {
                width: (await store.get<number>('translate_window_width')) ?? 350,
                height: (await store.get<number>('translate_window_height')) ?? 420,
            };
            layoutRef.current = size;
            setLayout(size);
            if (readyRef.current) {
                open(size);
            }
        })();
    }, [rememberWindowSize]);
    useEffect(() => {
        if (stage !== 'waiting' || !ready) return;
        if (rememberWindowSize === true) {
            open(layoutRef.current);
        } else {
            requestFit.current?.();
        }
    }, [ready]);

    // A size that is not remembered follows what the window shows.
    useEffect(() => {
        const scroll = scrollRef.current;
        const content = contentRef.current;
        if (rememberWindowSize !== false || stage === 'opening' || scroll === null || content === null) return;
        const waiting = stage === 'waiting';
        let fitTimeout: ReturnType<typeof setTimeout> | null = null;
        // The size last asked for. Rust takes a moment to get the window there, and what the window measures of
        // itself on the way says nothing about where it should end up.
        let asked: { width: number; height: number; at: number } | null = null;
        const fit = () => {
            fitTimeout = null;
            if (
                asked !== null &&
                performance.now() - asked.at < 500 &&
                (window.innerWidth !== asked.width || Math.abs(window.innerHeight - asked.height) > 1)
            ) {
                fitTimeout = setTimeout(fit, 50);
                return;
            }
            asked = null;
            const textAreas = Array.from(content.querySelectorAll('textarea'));
            // The source text is the one that can be typed in. When the box around it is kept short, the text is
            // as short as the box and scrolls, so the height of all of it is the height it scrolls over.
            const sourceText = content.querySelector<HTMLTextAreaElement>('textarea:not([readonly])');
            const sourceBox = sourceText?.parentElement;
            if (content.offsetHeight === 0 || !sourceText || !sourceBox) return;
            const sourceHeight = sourceText.scrollHeight + sourceBox.clientHeight - sourceText.offsetHeight;
            const size = fitSize(
                {
                    // While the window waits, the size is that of the unseen layout.
                    width: waiting ? layoutRef.current.width : window.innerWidth,
                    // What lies above the scrolling part, and all of what scrolls, with all of the source text.
                    height: scroll.offsetTop + content.offsetHeight - sourceBox.clientHeight + sourceHeight,
                    textHeights: textAreas.map((textArea) =>
                        textArea === sourceText ? textArea.scrollHeight : textArea.offsetHeight
                    ),
                    lineHeight: parseFloat(getComputedStyle(sourceText).lineHeight) || 24,
                    sourceHeight,
                },
                limitsFor(window.screen),
                fitAnew.current
            );
            fitAnew.current = false;
            if (size.sourceHeight !== undefined) {
                setSourceHeight(size.sourceHeight);
            }
            if (waiting) {
                if (size.width !== layoutRef.current.width || size.height !== layoutRef.current.height) {
                    layoutRef.current = { width: size.width, height: size.height };
                    setLayout(layoutRef.current);
                    // Measure again at the new size, until it stays.
                    fitTimeout = setTimeout(fit, 30);
                } else if (readyRef.current) {
                    open(layoutRef.current);
                }
                return;
            }
            // A height that is not a whole number of physical pixels comes back a pixel off.
            if (size.width !== window.innerWidth || Math.abs(size.height - window.innerHeight) > 1) {
                asked = { width: size.width, height: size.height, at: performance.now() };
                void invoke('fit_translate_window', { width: size.width, height: size.height });
                // Measure again once the window is there: at a new width the text has wrapped differently.
                fitTimeout = setTimeout(fit, 50);
            }
        };
        // The result cards open with an animation, so the content changes height many times in a row.
        const request = () => {
            if (fitTimeout) {
                clearTimeout(fitTimeout);
            }
            fitTimeout = setTimeout(fit, 30);
        };
        const observer = new ResizeObserver(request);
        observer.observe(content);
        requestFit.current = request;
        return () => {
            observer.disconnect();
            requestFit.current = null;
            if (fitTimeout) {
                clearTimeout(fitTimeout);
            }
        };
    }, [rememberWindowSize, pluginList !== null, stage]);
    // The width only grows while the text stays the same, so that the window does not go back and forth between
    // two widths. New text gets a new width.
    useEffect(() => {
        fitAnew.current = true;
        requestFit.current?.();
    }, [sourceText]);

    // The icons for the progress indicator: the service recognizing the image, or the services translating.
    const progressIcons = (): string[] => {
        if (pluginList === null) return [];
        const icon = (kind: 'translate' | 'recognize', key: string): string | undefined => {
            const name = getServiceName(key);
            if (whetherPluginService(key)) return pluginList[kind][name]?.icon;
            const builtin =
                kind === 'translate'
                    ? (builtinTranslateServices as Record<string, TranslateService>)[name]
                    : (builtinRecognizeServices as Record<string, RecognizeService>)[name];
            return builtin?.info.icon === 'system' ? `logo/${osType}.svg` : builtin?.info.icon;
        };
        let icons: (string | undefined)[];
        if (sourceBusy === 'image' && recognizeServiceInstanceList !== null) {
            icons = [icon('recognize', recognizeServiceInstanceList[0])];
        } else {
            const services = servicesInProgress(cards);
            icons = (services.length > 0 ? services : (translateServiceInstanceList ?? []).slice(0, 1)).map((key) =>
                icon('translate', key)
            );
        }
        return icons.filter((src): src is string => src !== undefined);
    };

    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'tts', 'recognize', 'collection'];
        let temp: PluginList = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        dir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    // readDir lists children, and every child has a name.
                    temp[serviceType][plugin.name!] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    useEffect(() => {
        loadPluginList();
        if (!unlisten) {
            unlisten = listen('reload_plugin_list', loadPluginList);
        }
    }, []);

    const loadServiceInstanceConfigMap = async () => {
        // Runs only once all four lists have been read (the effect below checks), so none of them is null.
        const config: ServiceConfigMap = {};
        for (const serviceInstanceKey of translateServiceInstanceList!) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of recognizeServiceInstanceList!) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of ttsServiceInstanceList!) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of collectionServiceInstanceList!) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (
            translateServiceInstanceList !== null &&
            recognizeServiceInstanceList !== null &&
            ttsServiceInstanceList !== null &&
            collectionServiceInstanceList !== null
        ) {
            loadServiceInstanceConfigMap();
        }
    }, [
        translateServiceInstanceList,
        recognizeServiceInstanceList,
        ttsServiceInstanceList,
        collectionServiceInstanceList,
    ]);

    return (
        pluginList && (
            <>
                {stage !== 'shown' && (
                    <Progress
                        icons={progressIcons()}
                        leaving={stage === 'opening'}
                        onPress={() => setPressed(true)}
                    />
                )}
                <div
                    className={`bg-background ${stage === 'shown' && 'h-screen w-screen'} ${
                        osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
                    }`}
                    // Until the window has opened, its content keeps the size it will open to, unseen at first and
                    // then uncovered as the window grows over it.
                    style={
                        stage === 'shown'
                            ? undefined
                            : {
                                  position: 'fixed',
                                  top: 0,
                                  left: 0,
                                  width: layout.width,
                                  height: layout.height,
                                  overflow: 'hidden',
                                  visibility: stage === 'waiting' ? 'hidden' : 'visible',
                                  opacity: stage === 'waiting' ? 0 : 1,
                                  transition: 'opacity 200ms ease-out',
                              }
                    }
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
                                if (pined) {
                                    if (closeOnBlur) {
                                        unlisten = listenBlur();
                                    }
                                    appWindow.setAlwaysOnTop(false);
                                } else {
                                    unlistenBlur();
                                    appWindow.setAlwaysOnTop(true);
                                }
                                setPined(!pined);
                            }}
                        >
                            <BsPinFill className={`text-[20px] ${pined ? 'text-primary' : 'text-default-400'}`} />
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
                        className={`${osType === 'Linux' ? 'h-[calc(100vh-37px)]' : 'h-[calc(100vh-35px)]'} px-[8px]`}
                        // The height of the window it will be, not of the one it waits in.
                        style={
                            stage === 'shown' ? undefined : { height: layout.height - (osType === 'Linux' ? 37 : 35) }
                        }
                    >
                        <div
                            ref={scrollRef}
                            className='h-full overflow-y-auto'
                        >
                            <div ref={contentRef}>
                                <div>
                                    {serviceInstanceConfigMap !== null && (
                                        <SourceArea
                                            pluginList={pluginList}
                                            serviceInstanceConfigMap={serviceInstanceConfigMap}
                                        />
                                    )}
                                </div>
                                <div className={`${hideLanguage && 'hidden'}`}>
                                    <LanguageArea />
                                    <Spacer y={2} />
                                </div>
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable
                                        droppableId='droppable'
                                        direction='vertical'
                                    >
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                            >
                                                {translateServiceInstanceList !== null &&
                                                    serviceInstanceConfigMap !== null &&
                                                    translateServiceInstanceList.map((serviceInstanceKey, index) => {
                                                        const config =
                                                            serviceInstanceConfigMap[serviceInstanceKey] ?? {};
                                                        const enable = config['enable'] ?? true;

                                                        return enable ? (
                                                            <Draggable
                                                                key={serviceInstanceKey}
                                                                draggableId={serviceInstanceKey}
                                                                index={index}
                                                            >
                                                                {(provided) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                    >
                                                                        <TargetArea
                                                                            {...provided.dragHandleProps}
                                                                            index={index}
                                                                            name={serviceInstanceKey}
                                                                            translateServiceInstanceList={
                                                                                translateServiceInstanceList
                                                                            }
                                                                            pluginList={pluginList}
                                                                            serviceInstanceConfigMap={
                                                                                serviceInstanceConfigMap
                                                                            }
                                                                        />
                                                                        <Spacer y={2} />
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ) : (
                                                            <></>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )
    );
}
