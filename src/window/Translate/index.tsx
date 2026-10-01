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
import { useAtomValue } from 'jotai';

import LanguageArea from './components/LanguageArea';
import SourceArea, { sourceTextAtom } from './components/SourceArea';
import TargetArea from './components/TargetArea';
import { fitSize, limitsFor, MIN_WIDTH } from './auto_size';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import { store } from '../../utils/store';
import { isTestMode } from '../../utils/window';
import { info } from 'tauri-plugin-log-api';
import type { LogicalPosition, PhysicalPosition } from '@tauri-apps/api/window';
import type { DropResult } from 'react-beautiful-dnd';
import type { PluginList, ServiceConfigMap } from '../../types/service';

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
    const [testMode, setTestMode] = useState<boolean | null>(null);
    // In test mode only Google translates: it is free, and the owner's services may be paid for.
    const translateServiceInstanceList =
        testMode === null ? null : testMode ? TEST_MODE_SERVICE_LIST : configuredServiceInstanceList;
    useEffect(() => {
        void isTestMode().then(setTestMode);
    }, []);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState<ServiceConfigMap | null>(null);
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
        if (testMode === false && rememberWindowSize !== null && rememberWindowSize) {
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
    }, [rememberWindowSize, testMode]);

    const [pluginList, setPluginList] = useState<PluginList | null>(null);
    const sourceText = useAtomValue(sourceTextAtom);
    // The part of the window that scrolls, and all of what it shows.
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // A size that is not remembered follows what the window shows.
    useEffect(() => {
        const scroll = scrollRef.current;
        const content = contentRef.current;
        if (rememberWindowSize !== false || scroll === null || content === null) return;
        let fitTimeout: ReturnType<typeof setTimeout> | null = null;
        const fit = () => {
            const textAreas = Array.from(content.querySelectorAll('textarea'));
            if (content.offsetHeight === 0 || textAreas.length === 0) return;
            const size = fitSize(
                {
                    width: window.innerWidth,
                    // What surrounds the scrolling part, and all of what scrolls.
                    height: window.innerHeight - scroll.clientHeight + content.offsetHeight,
                    textHeights: textAreas.map((textArea) => textArea.offsetHeight),
                    lineHeight: parseFloat(getComputedStyle(textAreas[0]).lineHeight) || 24,
                },
                limitsFor(window.screen)
            );
            if (size.width !== window.innerWidth || size.height !== window.innerHeight) {
                void invoke('fit_translate_window', { ...size });
            }
        };
        // The result cards open with an animation, so the content changes height many times in a row.
        const observer = new ResizeObserver(() => {
            if (fitTimeout) {
                clearTimeout(fitTimeout);
            }
            fitTimeout = setTimeout(fit, 30);
        });
        observer.observe(content);
        return () => {
            observer.disconnect();
            if (fitTimeout) {
                clearTimeout(fitTimeout);
            }
        };
    }, [rememberWindowSize, pluginList !== null]);
    // fitSize only widens the window, so new text starts from the least width again.
    useEffect(() => {
        if (rememberWindowSize === false && window.innerWidth > MIN_WIDTH) {
            void invoke('fit_translate_window', { width: MIN_WIDTH, height: window.innerHeight });
        }
    }, [sourceText]);

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
            <div
                className={`bg-background h-screen w-screen ${
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
                <div className={`${osType === 'Linux' ? 'h-[calc(100vh-37px)]' : 'h-[calc(100vh-35px)]'} px-[8px]`}>
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
                                                    const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {};
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
        )
    );
}
