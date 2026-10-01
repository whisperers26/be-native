import { Button, Input, Textarea } from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { DEFAULT_WRITING_PROMPT } from '../../utils/writing_prompt';
import { INSTANCE_NAME_CONFIG_KEY } from '../../utils/service_instance';
import { useConfig } from '../../hooks/useConfig';
import { useToastStyle } from '../../hooks';
import type { ServiceConfig, ServiceConfigProps, WritingOptions } from '../../types/service';

interface ChatConfigProps extends ServiceConfigProps {
    /** The service's name, for its title and description. */
    service: string;
    /** The settings the form asks for besides the name and the instructions, in order. */
    fields: ('requestPath' | 'apiKey' | 'model')[];
    defaults: ServiceConfig;
    improve: (text: string, options: WritingOptions) => Promise<string>;
}

const inputClassNames = {
    base: 'justify-between',
    label: 'text-[length:--nextui-font-size-medium]',
    mainWrapper: 'max-w-[50%]',
};

const fieldLabels = {
    requestPath: 'services.writing.request_path',
    apiKey: 'services.writing.api_key',
    model: 'services.writing.model',
};

/** The settings form of the writing services that ask an OpenAI-compatible API (LLM7, OpenAI). */
export default function ChatConfig(props: ChatConfigProps) {
    const { instanceKey, updateServiceList, onClose, service, fields, defaults, improve } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig<ServiceConfig>(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t(`services.writing.${service}.title`),
            ...defaults,
            systemPrompt: DEFAULT_WRITING_PROMPT,
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    improve('hello', { config }).then(
                        () => {
                            setIsLoading(false);
                            setConfig(config, true);
                            updateServiceList(instanceKey);
                            onClose();
                        },
                        (e) => {
                            setIsLoading(false);
                            toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle });
                        }
                    );
                }}
            >
                <Toaster />
                <p className='text-[12px] text-default-700'>{t(`services.writing.${service}.description`)}</p>
                <div className='config-item'>
                    <Input
                        label={t('services.instance_name')}
                        labelPlacement='outside-left'
                        value={config[INSTANCE_NAME_CONFIG_KEY]}
                        variant='bordered'
                        classNames={inputClassNames}
                        onValueChange={(value) => {
                            setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value });
                        }}
                    />
                </div>
                {fields.map((field) => (
                    <div
                        className='config-item'
                        key={field}
                    >
                        <Input
                            label={t(fieldLabels[field])}
                            labelPlacement='outside-left'
                            type={field === 'apiKey' ? 'password' : 'text'}
                            value={config[field] ?? ''}
                            variant='bordered'
                            classNames={inputClassNames}
                            onValueChange={(value) => {
                                setConfig({ ...config, [field]: value });
                            }}
                        />
                    </div>
                ))}
                <div className='config-item'>
                    <Textarea
                        label={t('services.writing.instructions')}
                        labelPlacement='outside'
                        variant='faded'
                        value={config.systemPrompt ?? ''}
                        onValueChange={(value) => {
                            setConfig({ ...config, systemPrompt: value });
                        }}
                    />
                </div>
                <Button
                    type='submit'
                    isLoading={isLoading}
                    fullWidth
                    color='primary'
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
