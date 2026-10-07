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
    Tooltip,
} from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { MdRefresh } from 'react-icons/md';

import {
    agentCliSpec,
    DEFAULT_SYSTEM_PROMPT,
    Language,
    listAgentCliModels,
    runAgentCli,
    translationPrompt,
} from '../../utils/agent_cli';
import { DEFAULT_WRITING_PROMPT, writingMessage } from '../../utils/writing_prompt';
import { INSTANCE_NAME_CONFIG_KEY } from '../../utils/service_instance';
import { useConfig } from '../../hooks/useConfig';
import { useToastStyle } from '../../hooks';
import type { AgentCliModel, AgentCliProvider } from '../../utils/agent_cli';
import type { ServiceConfigProps } from '../../types/service';

interface AgentCliConfigProps extends ServiceConfigProps {
    provider: AgentCliProvider;
    /**
     * Models to suggest until the tool has been asked for its own. The field takes any name; with no suggestions it
     * is a plain text field.
     */
    models: AgentCliModel[];
    /** The reasoning levels the tool accepts, as `services.translate.agent_cli.efforts.<level>` keys. */
    efforts: string[];
    defaultModel: string;
    defaultEffort: string;
    /** What the service does with the tool, which decides its instructions and the form's test run. */
    kind?: keyof typeof kinds;
}

/** What the form stores under the instance key. */
interface AgentCliSettings {
    [INSTANCE_NAME_CONFIG_KEY]: string;
    command: string;
    model: string;
    effort: string;
    systemPrompt: string;
    /** The models the tool listed when it was last asked; absent until then. */
    models?: AgentCliModel[];
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
    const [config, setConfig, getConfig] = useConfig<AgentCliSettings>(
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
    const [isListing, setIsListing] = useState(false);
    const toastStyle = useToastStyle();
    // The models the tool listed when it was last asked, which are saved with the other settings
    const suggestions: AgentCliModel[] = config?.models ?? models;

    const listModels = () => {
        setIsListing(true);
        listAgentCliModels(provider, config?.command ?? '').then(
            (listed) => {
                setIsListing(false);
                // The settings as they are now: other fields may have changed while the tool was asked
                const current = getConfig();
                if (current) setConfig({ ...current, models: listed });
            },
            (e) => {
                setIsListing(false);
                toast.error(e.toString(), { style: toastStyle });
            }
        );
    };

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
                    <h3 className='my-auto'>{t('services.translate.agent_cli.model')}</h3>
                    <div className='flex w-full max-w-[50%] gap-2'>
                        {suggestions.length > 0 ? (
                            <Autocomplete
                                aria-label={t('services.translate.agent_cli.model')}
                                allowsCustomValue
                                variant='bordered'
                                placeholder={t('services.translate.agent_cli.model_placeholder')}
                                // A suggested model shows by its name and is saved by its value; any other text is kept as typed.
                                inputValue={
                                    suggestions.find((model) => model.value === config.model)?.label ?? config.model
                                }
                                onInputChange={(value) => {
                                    const model = suggestions.find((model) => model.label === value)?.value ?? value;
                                    setConfig({ ...config, model });
                                }}
                            >
                                {suggestions.map((model) => (
                                    <AutocompleteItem key={model.value}>{model.label}</AutocompleteItem>
                                ))}
                            </Autocomplete>
                        ) : (
                            <Input
                                aria-label={t('services.translate.agent_cli.model')}
                                placeholder={t('services.translate.agent_cli.model_placeholder')}
                                value={config.model}
                                variant='bordered'
                                onValueChange={(value) => {
                                    setConfig({ ...config, model: value });
                                }}
                            />
                        )}
                        <Tooltip content={t('services.translate.agent_cli.list_models')}>
                            <Button
                                isIconOnly
                                variant='flat'
                                aria-label={t('services.translate.agent_cli.list_models')}
                                isLoading={isListing}
                                onPress={listModels}
                            >
                                <MdRefresh className='text-[18px]' />
                            </Button>
                        </Tooltip>
                    </div>
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
