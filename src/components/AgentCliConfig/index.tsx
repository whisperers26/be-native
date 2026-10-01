import {
    Autocomplete,
    AutocompleteItem,
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Textarea,
} from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import {
    agentCliSpec,
    DEFAULT_SYSTEM_PROMPT,
    Language,
    runAgentCli,
    translationPrompt,
} from '../../utils/agent_cli';
import { DEFAULT_WRITING_PROMPT, writingMessage } from '../../utils/writing_prompt';
import { INSTANCE_NAME_CONFIG_KEY } from '../../utils/service_instance';
import { useConfig } from '../../hooks/useConfig';
import { useToastStyle } from '../../hooks';
import type { AgentCliProvider } from '../../utils/agent_cli';
import type { ServiceConfigProps } from '../../types/service';

interface AgentCliConfigProps extends ServiceConfigProps {
    provider: AgentCliProvider;
    /** Model names to suggest. The field takes any name; with no suggestions it is a plain text field. */
    models: string[];
    /** The reasoning levels the tool accepts, as `services.translate.agent_cli.efforts.<level>` keys. */
    efforts: string[];
    defaultModel: string;
    defaultEffort: string;
    /** What the service does with the tool, which decides its instructions and the form's test run. */
    kind?: keyof typeof kinds;
}

// The built-in instructions of each kind of service, and the prompt its form tests the settings with.
const kinds = {
    translate: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        testPrompt: translationPrompt('hello', Language.auto, Language.zh_cn),
    },
    writing: {
        systemPrompt: DEFAULT_WRITING_PROMPT,
        testPrompt: writingMessage('hello'),
    },
};

const inputClassNames = {
    base: 'justify-between',
    label: 'text-[length:--nextui-font-size-medium]',
    mainWrapper: 'max-w-[50%]',
};

/** The settings form of the services that work through a command-line tool (Claude Code, Codex). */
export default function AgentCliConfig(props: AgentCliConfigProps) {
    const { instanceKey, updateServiceList, onClose, provider, models, efforts, defaultModel, defaultEffort } = props;
    const kind = props.kind ?? 'translate';
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t(`services.${kind}.${provider}.title`),
            command: '',
            model: defaultModel,
            effort: defaultEffort,
            systemPrompt: kinds[kind].systemPrompt,
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
                    runAgentCli(agentCliSpec(provider, config), kinds[kind].testPrompt).then(
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
                <p className='text-[12px] text-default-700'>
                    {t(`services.${kind}.agent_cli.description`, {
                        tool: t(`services.${kind}.${provider}.title`),
                    })}
                </p>
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
                <div className='config-item'>
                    <Input
                        label={t('services.translate.agent_cli.command')}
                        labelPlacement='outside-left'
                        placeholder={t('services.translate.agent_cli.command_placeholder')}
                        value={config.command}
                        variant='bordered'
                        classNames={inputClassNames}
                        onValueChange={(value) => {
                            setConfig({ ...config, command: value });
                        }}
                    />
                </div>
                <div className='config-item'>
                    {models.length > 0 ? (
                        <>
                            <h3 className='my-auto'>{t('services.translate.agent_cli.model')}</h3>
                            <Autocomplete
                                aria-label={t('services.translate.agent_cli.model')}
                                allowsCustomValue
                                variant='bordered'
                                className='max-w-[50%]'
                                placeholder={t('services.translate.agent_cli.model_placeholder')}
                                inputValue={config.model}
                                onInputChange={(value) => {
                                    setConfig({ ...config, model: value });
                                }}
                            >
                                {models.map((model) => (
                                    <AutocompleteItem key={model}>{model}</AutocompleteItem>
                                ))}
                            </Autocomplete>
                        </>
                    ) : (
                        <Input
                            label={t('services.translate.agent_cli.model')}
                            labelPlacement='outside-left'
                            placeholder={t('services.translate.agent_cli.model_placeholder')}
                            value={config.model}
                            variant='bordered'
                            classNames={inputClassNames}
                            onValueChange={(value) => {
                                setConfig({ ...config, model: value });
                            }}
                        />
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.agent_cli.effort')}</h3>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button variant='bordered'>
                                {t(`services.translate.agent_cli.efforts.${config.effort}`)}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            autoFocus='first'
                            aria-label={t('services.translate.agent_cli.effort')}
                            onAction={(key) => {
                                setConfig({ ...config, effort: key as string });
                            }}
                        >
                            {efforts.map((effort) => (
                                <DropdownItem key={effort}>
                                    {t(`services.translate.agent_cli.efforts.${effort}`)}
                                </DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                </div>
                <div className='config-item'>
                    <Textarea
                        label={t('services.translate.agent_cli.instructions')}
                        labelPlacement='outside'
                        variant='faded'
                        value={config.systemPrompt}
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
