import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Button } from '@nextui-org/react';
import { atom, useAtom, useSetAtom, useAtomValue } from 'jotai';
import { fetch, Body } from '@tauri-apps/api/http';
import { useTranslation } from 'react-i18next';
import { HiTranslate } from 'react-icons/hi';
import { GiCycle } from 'react-icons/gi';
import React, { useEffect } from 'react';
import { nanoid } from 'nanoid';
import * as builtinService from '../../../services/recognize';
import { languageList } from '../../../utils/language';
import { useConfig } from '../../../hooks';
import { textAtom } from '../TextArea';
import { pluginListAtom } from '..';
import { osType } from '../../../utils/env';
import {
    ServiceSourceType,
    getServiceSouceType,
    getServiceName,
    INSTANCE_NAME_CONFIG_KEY,
    getDisplayInstanceName,
} from '../../../utils/service_instance';
import type { RecognizeService, ServiceConfigMap } from '../../../types/service';

export const currentServiceInstanceKeyAtom = atom<string>();
export const languageAtom = atom<string>();
export const recognizeFlagAtom = atom<string>();

// The registry is looked up by a name known only at run time.
type RecognizeServices = Record<string, RecognizeService>;

interface ControlAreaProps {
    serviceInstanceConfigMap: ServiceConfigMap;
    serviceInstanceList: string[];
}

export default function ControlArea(props: ControlAreaProps) {
    const { serviceInstanceConfigMap, serviceInstanceList } = props;
    // The window renders this area only once it has loaded the plugin list.
    const pluginList = useAtomValue(pluginListAtom)!;
    const [recognizeLanguage] = useConfig('recognize_language', 'auto');
    const [serverPort] = useConfig('server_port', 60828);
    const setRecognizeFlag = useSetAtom(recognizeFlagAtom);
    const [currentServiceInstanceKey, setCurrentServiceInstanceKey] = useAtom(currentServiceInstanceKeyAtom);
    const [language, setLanguage] = useAtom(languageAtom);
    const text = useAtomValue(textAtom);
    const { t } = useTranslation();

    function getInstanceName(instanceKey: string, serviceNameSupplier: () => string) {
        const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {};
        return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier);
    }

    useEffect(() => {
        if (serviceInstanceList) {
            setCurrentServiceInstanceKey(serviceInstanceList[0]);
        }
        if (recognizeLanguage) {
            setLanguage(recognizeLanguage);
        }
    }, [serviceInstanceList, recognizeLanguage]);

    return (
        <div className='flex justify-between px-[12px] h-full'>
            {currentServiceInstanceKey && (
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            className='my-auto'
                            variant='bordered'
                            size='sm'
                            startContent={
                                <img
                                    className='h-[16px] w-[16px] my-auto'
                                    src={
                                        getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                                            ? pluginList[getServiceName(currentServiceInstanceKey)].icon
                                            : (builtinService as RecognizeServices)[
                                                    getServiceName(currentServiceInstanceKey)
                                                ].info.icon === 'system'
                                              ? `logo/${osType}.svg`
                                              : (builtinService as RecognizeServices)[
                                                    getServiceName(currentServiceInstanceKey)
                                                ].info.icon
                                    }
                                />
                            }
                        >
                            {getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                                ? getInstanceName(
                                      currentServiceInstanceKey,
                                      () => pluginList[getServiceName(currentServiceInstanceKey)].display
                                  )
                                : getInstanceName(currentServiceInstanceKey, () =>
                                      t(`services.recognize.${currentServiceInstanceKey}.title`)
                                  )}
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label='service name'
                        className='max-h-[70vh] overflow-y-auto'
                        onAction={(key) => {
                            setCurrentServiceInstanceKey(key as string);
                        }}
                    >
                        {serviceInstanceList.map((instanceKey) => {
                            return (
                                <DropdownItem
                                    key={instanceKey}
                                    startContent={
                                        <img
                                            className='h-[16px] w-[16px] my-auto'
                                            src={
                                                getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
                                                    ? pluginList[getServiceName(instanceKey)].icon
                                                    : (builtinService as RecognizeServices)[getServiceName(instanceKey)]
                                                            .info.icon === 'system'
                                                      ? `logo/${osType}.svg`
                                                      : (builtinService as RecognizeServices)[
                                                            getServiceName(instanceKey)
                                                        ].info.icon
                                            }
                                        />
                                    }
                                >
                                    {getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
                                        ? getInstanceName(
                                              instanceKey,
                                              () => pluginList[getServiceName(instanceKey)].display
                                          )
                                        : getInstanceName(instanceKey, () =>
                                              t(`services.recognize.${instanceKey}.title`)
                                          )}
                                </DropdownItem>
                            );
                        })}
                    </DropdownMenu>
                </Dropdown>
            )}
            {language && (
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            className='my-auto'
                            variant='bordered'
                            size='sm'
                        >
                            {t(`languages.${language}`)}
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label='language'
                        className='max-h-[70vh] overflow-y-auto'
                        onAction={(key) => {
                            setLanguage(key as string);
                        }}
                    >
                        <DropdownItem key='auto'>{t('languages.auto')}</DropdownItem>
                        {/* NextUI's collection children type does not accept a list after a fixed item */}
                        {languageList.map((name) => {
                            return <DropdownItem key={name}>{t(`languages.${name}`)}</DropdownItem>;
                        }) as any}
                    </DropdownMenu>
                </Dropdown>
            )}
            <Button
                variant='flat'
                color='secondary'
                size='sm'
                className='my-auto'
                startContent={<GiCycle className='text-[16px]' />}
                onPress={() => {
                    setRecognizeFlag(nanoid());
                }}
            >
                {t('recognize.recognize')}
            </Button>
            <Button
                variant='flat'
                color='primary'
                size='sm'
                className='my-auto'
                startContent={<HiTranslate className='text-[16px]' />}
                onPress={async () => {
                    if (text) {
                        void fetch(`http://127.0.0.1:${serverPort}/translate`, {
                            method: 'POST',
                            body: Body.text(text),
                            responseType: 2,
                        });
                    }
                }}
            >
                {t('recognize.translate')}
            </Button>
        </div>
    );
}
