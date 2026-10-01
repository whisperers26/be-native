import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import * as builtinServices from '../../../../../../services/writing';
import { getServiceName } from '../../../../../../utils/service_instance';
import type { WritingService } from '../../../../../../types/service';

// The registry is looked up by a name known only at run time.
type WritingServices = Record<string, WritingService>;

interface ConfigModalProps {
    serviceInstanceKey: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    updateServiceInstanceList: (instanceKey: string) => void;
}

export default function ConfigModal(props: ConfigModalProps) {
    const { serviceInstanceKey, isOpen, onOpenChange, updateServiceInstanceList } = props;

    const serviceName = getServiceName(serviceInstanceKey);

    const { t } = useTranslation();
    const ConfigComponent = (builtinServices as WritingServices)[serviceName].Config;

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            scrollBehavior='inside'
        >
            <ModalContent className='max-h-[75vh]'>
                {(onClose) => (
                    <>
                        <ModalHeader>
                            <img
                                src={(builtinServices as WritingServices)[serviceName].info.icon}
                                className='h-[24px] w-[24px] my-auto'
                                draggable={false}
                            />
                            <Spacer x={2} />
                            {t(`services.writing.${serviceName}.title`)}
                        </ModalHeader>
                        <ModalBody>
                            <ConfigComponent
                                name={serviceName}
                                instanceKey={serviceInstanceKey}
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
