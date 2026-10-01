import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { Card, Spacer, Button, useDisclosure } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import SelectPluginModal from '../SelectPluginModal';
import { osType } from '../../../../../utils/env';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';
import type { DropResult } from 'react-beautiful-dnd';
import type { PluginConfigInfo } from '../../../../../types/service';

interface CollectionProps {
    pluginList: Record<string, PluginConfigInfo>;
}

export default function Collection(props: CollectionProps) {
    const { pluginList } = props;
    const {
        isOpen: isSelectPluginOpen,
        onOpen: onSelectPluginOpen,
        onOpenChange: onSelectPluginOpenChange,
    } = useDisclosure();
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('anki');
    // now it's service instance list
    const [collectionServiceInstanceList, setCollectionServiceInstanceList] = useConfig<string[]>('collection_service_list', []);

    const { t } = useTranslation();

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
        const items = reorder(collectionServiceInstanceList!, result.source.index, result.destination.index);
        setCollectionServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey: string) => {
        setCollectionServiceInstanceList(collectionServiceInstanceList!.filter((x) => x !== instanceKey));
        deleteKey(instanceKey);
    };
    const updateServiceInstanceList = (instanceKey: string) => {
        if (collectionServiceInstanceList!.includes(instanceKey)) {
            return;
        } else {
            const newList = [...collectionServiceInstanceList!, instanceKey];
            setCollectionServiceInstanceList(newList);
        }
    };

    return (
        <>
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
                                {collectionServiceInstanceList !== null &&
                                    collectionServiceInstanceList.map((x, i) => {
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
                                                                serviceInstanceKey={x}
                                                                key={x}
                                                                pluginList={pluginList}
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
                    <Spacer x={2} />
                    <Button
                        fullWidth
                        onPress={onSelectPluginOpen}
                    >
                        {t('config.service.add_external_service')}
                    </Button>
                </div>
            </Card>
            <SelectPluginModal
                isOpen={isSelectPluginOpen}
                onOpenChange={onSelectPluginOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
                pluginType='collection'
                pluginList={pluginList}
                deleteService={deleteServiceInstance}
            />
            <SelectModal
                isOpen={isSelectOpen}
                onOpenChange={onSelectOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
            />
            <ConfigModal
                serviceInstanceKey={currentConfigKey}
                isOpen={isConfigOpen}
                pluginList={pluginList}
                onOpenChange={onConfigOpenChange}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}
