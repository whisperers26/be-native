import { RxDragHandleHorizontal } from 'react-icons/rx';
import { Spacer, Button } from '@nextui-org/react';
import { MdDeleteOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { BiSolidEdit } from 'react-icons/bi';
import React from 'react';

import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/collection';
import { useConfig } from '../../../../../../hooks';
import type { DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';
import type { CollectionService, PluginConfigInfo, ServiceConfig } from '../../../../../../types/service';

// The registry is looked up by a name known only at run time.
type CollectionServices = Record<string, CollectionService>;

// The drag handle's props, which the page spreads in, go to the handle.
interface ServiceItemProps extends Partial<DraggableProvidedDragHandleProps> {
    serviceInstanceKey: string;
    pluginList: Record<string, PluginConfigInfo>;
    deleteServiceInstance: (instanceKey: string) => void;
    setCurrentConfigKey: (instanceKey: string) => void;
    onConfigOpen: () => void;
}

export default function ServiceItem(props: ServiceItemProps) {
    const { serviceInstanceKey, pluginList, deleteServiceInstance, setCurrentConfigKey, onConfigOpen, ...drag } = props;

    const { t } = useTranslation();

    const [serviceInstanceConfig, setServiceInstanceConfig] = useConfig<ServiceConfig>(serviceInstanceKey, {});

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);

    return serviceSourceType === ServiceSourceType.PLUGIN && !(serviceName in pluginList) ? (
        <></>
    ) : (
        serviceInstanceConfig !== null && (
            <div className='bg-content2 rounded-md px-[10px] py-[20px] flex justify-between'>
                <div className='flex'>
                    <div
                        {...drag}
                        className='text-2xl my-auto'
                    >
                        <RxDragHandleHorizontal />
                    </div>

                    <Spacer x={2} />
                    {serviceSourceType === ServiceSourceType.BUILDIN && (
                        <>
                            <img
                                src={`${(builtinServices as CollectionServices)[serviceName].info.icon}`}
                                className='h-[24px] w-[24px] my-auto'
                                draggable={false}
                            />
                            <Spacer x={2} />
                            <h2 className='my-auto'>
                                {serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ||
                                    t(`services.collection.${serviceName}.title`)}
                            </h2>
                        </>
                    )}
                    {serviceSourceType === ServiceSourceType.PLUGIN && (
                        <>
                            <img
                                src={pluginList[serviceName].icon}
                                className='h-[24px] w-[24px] my-auto'
                                draggable={false}
                            />
                            <Spacer x={2} />
                            <h2 className='my-auto'>
                                {serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ||
                                    `${pluginList[serviceName].display} [${t('common.plugin')}]`}
                            </h2>
                        </>
                    )}
                </div>
                <div className='flex'>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={() => {
                            setCurrentConfigKey(serviceInstanceKey);
                            onConfigOpen();
                        }}
                    >
                        <BiSolidEdit className='text-2xl' />
                    </Button>
                    <Spacer x={2} />
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        color='danger'
                        onPress={() => {
                            deleteServiceInstance(serviceInstanceKey);
                        }}
                    >
                        <MdDeleteOutline className='text-2xl' />
                    </Button>
                </div>
            </div>
        )
    );
}
