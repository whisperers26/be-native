import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@nextui-org/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/react';
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { Textarea, Button, ButtonGroup } from '@nextui-org/react';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Pagination } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import Database from 'tauri-plugin-sql-api';

import * as builtinCollectionServices from '../../../../services/collection';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import { useConfig, useToastStyle } from '../../../../hooks';
import { LanguageFlag } from '../../../../utils/language';
import { store } from '../../../../utils/store';
import { osType } from '../../../../utils/env';
import {
    ServiceSourceType,
    ServiceType,
    getServiceName,
    getServiceSouceType,
    whetherAvailableService,
} from '../../../../utils/service_instance';
import type { CollectionService, PluginList, TranslateService } from '../../../../types/service';
import type { Key, ReactElement } from 'react';

// The registries are looked up by a name known only at run time.
type TranslateServices = Record<string, TranslateService>;
type CollectionServices = Record<string, CollectionService>;

// A row of the history table, which the Translate window creates and fills.
interface HistoryItem {
    id: number;
    text: string;
    source: string;
    target: string;
    service: string;
    result: string;
    timestamp: number;
}

export default function History() {
    const [collectionServiceList] = useConfig<string[]>('collection_service_list', []);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [pluginList, setPluginList] = useState<PluginList | null>(null);
    const [selectedItem, setSelectItem] = useState<HistoryItem | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<HistoryItem[]>([]);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();
    useEffect(() => {
        init();
        loadPluginList();
    }, []);

    useEffect(() => {
        getData();
    }, [total, page]);

    const init = async () => {
        const db = await Database.load('sqlite:history.db');
        const result = await db.select<{ 'COUNT(*)': number }[]>('SELECT COUNT(*) FROM history');
        if (result[0] && result[0]['COUNT(*)']) {
            setTotal(result[0]['COUNT(*)']);
        }
    };
    const getData = async () => {
        const db = await Database.load('sqlite:history.db');
        let result = await db.select<HistoryItem[]>('SELECT * FROM history ORDER BY id DESC LIMIT 20 OFFSET $1', [20 * (page - 1)]);
        setItems(result);
    };

    // The table's row key is the id, which NextUI hands back as a Key.
    const getSelectedData = async (id: Key) => {
        const db = await Database.load('sqlite:history.db');
        let result = await db.select<HistoryItem[]>('SELECT * FROM history WHERE id=$1', [id]);
        setSelectItem(result[0]);
    };
    const clearData = async () => {
        const db = await Database.load('sqlite:history.db');
        await db.execute('DROP TABLE history');
        await db.execute('VACUUM');
        setItems([]);
        setTotal(0);
        setPage(1);
    };
    // The dialog's Save button, the only caller, is rendered only while an item is selected.
    const updateData = async () => {
        const db = await Database.load('sqlite:history.db');
        await db.execute('UPDATE history SET text=$1, result=$2 WHERE id=$3', [
            selectedItem!.text,
            selectedItem!.result,
            selectedItem!.id,
        ]);
        await getData();
    };

    const formatDate = (date: Date) => {
        function padTo2Digits(num: number) {
            return num.toString().padStart(2, '0');
        }
        const year = date.getFullYear().toString().slice(2, 4);
        const month = padTo2Digits(date.getMonth() + 1);
        const day = padTo2Digits(date.getDate());
        const hour = padTo2Digits(date.getHours());
        const minute = padTo2Digits(date.getMinutes());
        const second = padTo2Digits(date.getSeconds());
        return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
    };
    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'collection'];
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

    return (
        pluginList !== null && (
            <>
                <Toaster />
                <Table
                    fullWidth
                    hideHeader
                    selectionMode='single'
                    selectionBehavior='toggle'
                    aria-label='History Table'
                    classNames={{
                        base: `${
                            osType === 'Linux' ? 'h-[calc(100vh-130px)]' : 'h-[calc(100vh-100px)]'
                        } overflow-y-auto`,
                        td: 'px-0',
                    }}
                    onRowAction={(id) => {
                        getSelectedData(id);
                        onOpen();
                    }}
                >
                    <TableHeader>
                        {/* @ts-expect-error NextUI's TableColumn requires children, but the header is hidden */}
                        <TableColumn key='service' />
                        {/* @ts-expect-error NextUI's TableColumn requires children, but the header is hidden */}
                        <TableColumn key='text' />
                        {/* @ts-expect-error NextUI's TableColumn requires children, but the header is hidden */}
                        <TableColumn key='source' />
                        {/* @ts-expect-error NextUI's TableColumn requires children, but the header is hidden */}
                        <TableColumn key='target' />
                        {/* @ts-expect-error NextUI's TableColumn requires children, but the header is hidden */}
                        <TableColumn key='result' />
                        {/* @ts-expect-error NextUI's TableColumn requires children, but the header is hidden */}
                        <TableColumn key='timestamp' />
                    </TableHeader>
                    <TableBody
                        emptyContent={'No History to display.'}
                        items={items}
                    >
                        {/* A service that is gone gives false, which the collection skips, but its type wants a row */}
                        {(item) =>
                            (whetherAvailableService(item.service, {
                                [ServiceSourceType.BUILDIN]: builtinServices,
                                [ServiceSourceType.PLUGIN]: pluginList[ServiceType.TRANSLATE],
                            }) && (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        {getServiceSouceType(item.service) === ServiceSourceType.PLUGIN ? (
                                            <img
                                                src={pluginList['translate'][getServiceName(item.service)].icon}
                                                className='h-[18px] w-[18px] my-auto mr-[8px]'
                                                draggable={false}
                                            />
                                        ) : (
                                            <img
                                                src={`${(builtinServices as TranslateServices)[getServiceName(item.service)].info.icon}`}
                                                className='h-[18px] w-[18px] my-auto mr-[8px]'
                                                draggable={false}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <p
                                            className={`whitespace-nowrap ${
                                                osType === 'Linux'
                                                    ? 'w-[calc((100vw-287px-26px-60px-140px-30px)*0.5)]'
                                                    : 'w-[calc((100vw-287px-26px-60px-140px)*0.5)]'
                                            } text-ellipsis overflow-hidden`}
                                        >
                                            {item.text}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`w-[30px] fi fi-${LanguageFlag[item.source as keyof typeof LanguageFlag]}`} />
                                    </TableCell>
                                    <TableCell>
                                        <span className={`w-[30px] fi fi-${LanguageFlag[item.target as keyof typeof LanguageFlag]}`} />
                                    </TableCell>
                                    <TableCell>
                                        <p
                                            className={`whitespace-nowrap ${
                                                osType === 'Linux'
                                                    ? 'w-[calc((100vw-287px-26px-60px-140px-30px)*0.5)]'
                                                    : 'w-[calc((100vw-287px-26px-60px-140px)*0.5)]'
                                            } text-ellipsis overflow-hidden`}
                                        >
                                            {item.result}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <p className='text-center whitespace-nowrap w-[140px]'>
                                            {formatDate(new Date(item.timestamp))}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            )) as ReactElement
                        }
                    </TableBody>
                </Table>
                <div className='mt-[8px] flex justify-around'>
                    <Pagination
                        showControls
                        isCompact
                        total={Math.ceil(total / 20)}
                        page={page}
                        onChange={setPage}
                    />
                    <Button
                        size='sm'
                        className='my-auto'
                        onPress={clearData}
                    >
                        {t('common.clear')}
                    </Button>
                </div>

                <Modal
                    isOpen={isOpen}
                    onOpenChange={onOpenChange}
                    scrollBehavior='inside'
                >
                    <ModalContent className='max-h-[80vh]'>
                        {(onClose) =>
                            selectedItem && (
                                <>
                                    <ModalHeader>
                                        <div className='flex justify-start'>
                                            {getServiceSouceType(selectedItem.service) === ServiceSourceType.PLUGIN ? (
                                                <img
                                                    src={
                                                        pluginList['translate'][getServiceName(selectedItem.service)]
                                                            .icon
                                                    }
                                                    className='h-[24px] w-[24px] my-auto'
                                                    draggable={false}
                                                />
                                            ) : (
                                                <img
                                                    src={`${(builtinServices as TranslateServices)[getServiceName(selectedItem.service)].info.icon}`}
                                                    className='h-[24px] w-[24px] m-auto mr-[8px]'
                                                    draggable={false}
                                                />
                                            )}
                                        </div>
                                    </ModalHeader>
                                    <ModalBody>
                                        <Textarea
                                            value={selectedItem.text}
                                            onChange={(e) => {
                                                setSelectItem({ ...selectedItem, text: e.target.value });
                                            }}
                                        />
                                        <Textarea
                                            value={selectedItem.result}
                                            onChange={(e) => {
                                                setSelectItem({ ...selectedItem, result: e.target.value });
                                            }}
                                        />
                                    </ModalBody>
                                    <ModalFooter className='flex justify-between'>
                                        <Button
                                            color='primary'
                                            onPress={async () => {
                                                await updateData();
                                                onClose();
                                            }}
                                        >
                                            {t('common.save')}
                                        </Button>
                                        <ButtonGroup>
                                            {collectionServiceList &&
                                                collectionServiceList.map((instanceKey) => {
                                                    return (
                                                        <Button
                                                            key={instanceKey}
                                                            isIconOnly
                                                            variant='light'
                                                            onPress={async () => {
                                                                if (
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                ) {
                                                                    const pluginConfig =
                                                                        (await store.get(instanceKey)) ?? {};
                                                                    let [func, utils] = await invoke_plugin(
                                                                        'collection',
                                                                        getServiceName(instanceKey)
                                                                    );
                                                                    func(selectedItem.text, selectedItem.result, {
                                                                        config: pluginConfig,
                                                                        utils,
                                                                    }).then(
                                                                        (_: any) => {
                                                                            toast.success(
                                                                                t('translate.add_collection_success'),
                                                                                {
                                                                                    style: toastStyle,
                                                                                }
                                                                            );
                                                                        },
                                                                        (e: any) => {
                                                                            toast.error(e.toString(), {
                                                                                style: toastStyle,
                                                                            });
                                                                        }
                                                                    );
                                                                } else {
                                                                    const instanceConfig =
                                                                        (await store.get(instanceKey)) ?? {};
                                                                    (builtinCollectionServices as CollectionServices)[
                                                                        getServiceName(instanceKey)
                                                                    ]
                                                                        .collection(
                                                                            selectedItem.text,
                                                                            selectedItem.result,
                                                                            {
                                                                                config: instanceConfig,
                                                                            }
                                                                        )
                                                                        .then(
                                                                            (_) => {
                                                                                toast.success(
                                                                                    t(
                                                                                        'translate.add_collection_success'
                                                                                    ),
                                                                                    {
                                                                                        style: toastStyle,
                                                                                    }
                                                                                );
                                                                            },
                                                                            (e) => {
                                                                                toast.error(e.toString(), {
                                                                                    style: toastStyle,
                                                                                });
                                                                            }
                                                                        );
                                                                }
                                                            }}
                                                        >
                                                            <img
                                                                src={
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                        ? pluginList['collection'][
                                                                              getServiceName(instanceKey)
                                                                          ].icon
                                                                        : (builtinCollectionServices as CollectionServices)[
                                                                              getServiceName(instanceKey)
                                                                          ].info.icon
                                                                }
                                                                className='h-[24px] w-[24px]'
                                                            />
                                                        </Button>
                                                    );
                                                })}
                                        </ButtonGroup>
                                    </ModalFooter>
                                </>
                            )
                        }
                    </ModalContent>
                </Modal>
            </>
        )
    );
}
