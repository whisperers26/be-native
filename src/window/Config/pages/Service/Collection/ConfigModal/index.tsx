import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import {
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/collection';
import { PluginConfig } from '../../PluginConfig';
import type { CollectionService, PluginConfigInfo } from '../../../../../../types/service';

// The registry is looked up by a name known only at run time.
type CollectionServices = Record<string, CollectionService>;

interface ConfigModalProps {
    serviceInstanceKey: string;
    pluginList: Record<string, PluginConfigInfo>;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    updateServiceInstanceList: (instanceKey: string) => void;
}

export default function ConfigModal(props: ConfigModalProps) {
    const { serviceInstanceKey, pluginList, isOpen, onOpenChange, updateServiceInstanceList } = props;

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const pluginServiceFlag = whetherPluginService(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const { t } = useTranslation();
    const ConfigComponent = pluginServiceFlag ? PluginConfig : (builtinServices as CollectionServices)[serviceName].Config;

    return pluginServiceFlag && !(serviceName in pluginList) ? (
        <></>
    ) : (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            scrollBehavior='inside'
        >
            <ModalContent className='max-h-[75vh]'>
                {(onClose) => (
                    <>
                        <ModalHeader>
                            {serviceSourceType === ServiceSourceType.BUILDIN && (
                                <>
                                    <img
                                        src={(builtinServices as CollectionServices)[serviceName].info.icon}
                                        className='h-[24px] w-[24px] my-auto'
                                        draggable={false}
                                    />
                                    <Spacer x={2} />
                                    {t(`services.collection.${serviceName}.title`)}
                                </>
                            )}
                            {pluginServiceFlag && (
                                <>
                                    <img
                                        src={pluginList[serviceName].icon}
                                        className='h-[24px] w-[24px] my-auto'
                                        draggable={false}
                                    />

                                    <Spacer x={2} />
                                    {`${pluginList[serviceName].display} [${t('common.plugin')}]`}
                                </>
                            )}
                        </ModalHeader>
                        <ModalBody>
                            <ConfigComponent
                                name={serviceName}
                                instanceKey={serviceInstanceKey}
                                pluginType='collection'
                                pluginList={pluginList}
                                updateServiceList={updateServiceInstanceList}
                                onClose={onClose}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                color='danger'
                                variant='light'
                                onPress={onClose}
                            >
                                {t('common.cancel')}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
