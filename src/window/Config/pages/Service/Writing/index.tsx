import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { Card, Spacer, Button, useDisclosure } from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { useToastStyle } from '../../../../../hooks';
import { osType } from '../../../../../utils/env';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';
import type { DropResult } from 'react-beautiful-dnd';

// The writing services, as the Translate tab shows the translate ones. There are no writing plugins.
export default function Writing() {
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('llm7');
    const [writingServiceInstanceList, setWritingServiceInstanceList] = useConfig('writing_service_list', ['llm7']);

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    const reorder = (list: string[], startIndex: number, endIndex: number) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };
    // The list is null until the settings have been read. The three functions below run on a drag or a press on a
    // card that is drawn from the list, or on a press in a dialog that opens after the page has loaded, so they take
    // the list with `!`.
    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const items = reorder(writingServiceInstanceList!, result.source.index, result.destination.index);
        setWritingServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey: string) => {
        if (writingServiceInstanceList!.length === 1) {
            toast.error(t('config.service.least'), { style: toastStyle });
            return;
        } else {
            setWritingServiceInstanceList(writingServiceInstanceList!.filter((x) => x !== instanceKey));
            deleteKey(instanceKey);
        }
    };
    const updateServiceInstanceList = (instanceKey: string) => {
        if (writingServiceInstanceList!.includes(instanceKey)) {
            return;
        } else {
            const newList = [...writingServiceInstanceList!, instanceKey];
            setWritingServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Toaster />
            <Card
                className={`${
                    osType === 'Linux' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-120px)]'
                } overflow-y-auto p-5 flex justify-between`}
            >
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable
                        droppableId='droppable'
                        direction='vertical'
                    >
                        {(provided) => (
                            <div
                                className='overflow-y-auto h-full'
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {writingServiceInstanceList !== null &&
                                    writingServiceInstanceList.map((x, i) => {
                                        return (
                                            <Draggable
                                                key={x}
                                                draggableId={x}
                                                index={i}
                                            >
                                                {(provided) => {
                                                    return (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                        >
                                                            <ServiceItem
                                                                {...provided.dragHandleProps}
                                                                key={x}
                                                                serviceInstanceKey={x}
                                                                deleteServiceInstance={deleteServiceInstance}
                                                                setCurrentConfigKey={setCurrentConfigKey}
                                                                onConfigOpen={onConfigOpen}
                                                            />
                                                            <Spacer y={2} />
                                                        </div>
                                                    );
                                                }}
                                            </Draggable>
                                        );
                                    })}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                <Spacer y={2} />
                <div className='flex'>
                    <Button
                        fullWidth
                        onPress={onSelectOpen}
                    >
                        {t('config.service.add_builtin_service')}
                    </Button>
                </div>
            </Card>
            <SelectModal
                isOpen={isSelectOpen}
                onOpenChange={onSelectOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
            />
            <ConfigModal
                serviceInstanceKey={currentConfigKey}
                isOpen={isConfigOpen}
                onOpenChange={onConfigOpenChange}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}
