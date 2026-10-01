import { Button, Tooltip } from '@nextui-org/react';
import React, { useEffect, useRef, useState } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';
import PulseLoader from 'react-spinners/PulseLoader';
import { MdContentCopy } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { GiCycle } from 'react-icons/gi';
import { error as logError } from 'tauri-plugin-log-api';

import * as builtinServices from '../../services/writing';
import { INSTANCE_NAME_CONFIG_KEY, getDisplayInstanceName, getServiceName } from '../../utils/service_instance';
import type { KeyboardEvent } from 'react';
import type { ServiceConfig, WritingService } from '../../types/service';
import type { ResultSpec } from './results';

// The registry is looked up by a name known only at run time.
type WritingServices = Record<string, WritingService>;

interface ResultCardProps {
    /** The text to improve. */
    text: string;
    spec: ResultSpec;
    /** The settings of the service instance. */
    config: ServiceConfig;
    /** Tells the window whether this box is waiting for its answer. */
    onBusy: (id: string, busy: boolean) => void;
    /** The user picked this box's text to replace the selection. */
    onReplace: (text: string) => void;
}

/** One rewrite of the text by one service: the box asks for it when it appears, and a click on it picks it. */
export default function ResultCard(props: ResultCardProps) {
    const { text, spec, config, onBusy, onReplace } = props;
    const { t } = useTranslation();
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Counts the requests made: an answer to an older one, or to a box that is gone, is dropped.
    const run = useRef(0);
    const abort = useRef<AbortController | null>(null);

    const serviceName = getServiceName(spec.service);
    const service = (builtinServices as WritingServices)[serviceName];

    const ask = () => {
        const id = ++run.current;
        abort.current?.abort();
        abort.current = new AbortController();
        setResult('');
        setError('');
        if (!service) {
            setError(`Unknown service: ${serviceName}`);
            return;
        }
        setIsLoading(true);
        onBusy(spec.id, true);
        service
            .improve(text, {
                config,
                style: spec.style,
                request: spec.request,
                signal: abort.current.signal,
                setResult: (partial) => {
                    if (run.current === id) setResult(partial);
                },
            })
            .then(
                (answer) => {
                    if (run.current !== id) return;
                    setResult(answer.trim());
                    setIsLoading(false);
                    onBusy(spec.id, false);
                },
                (e) => {
                    if (run.current !== id) return;
                    const message = String(e);
                    void logError(`[${spec.service}]happened error: ${message}`);
                    setResult('');
                    setError(message);
                    setIsLoading(false);
                    onBusy(spec.id, false);
                }
            );
    };
    useEffect(() => {
        ask();
        return () => {
            run.current = -1;
            abort.current?.abort();
            onBusy(spec.id, false);
        };
    }, []);

    const ready = !isLoading && error === '' && result !== '';
    const replace = () => {
        if (ready) onReplace(result);
    };

    return (
        <div
            // A group and not a button: a button's text is read as its name only, which would hide the rewrite from
            // a screen reader, and from the smoke test.
            role='group'
            tabIndex={ready ? 0 : -1}
            aria-label={t('writing.replace')}
            className={`group rounded-[10px] border-1 bg-content1 outline-none transition-[border-color,box-shadow,transform] duration-200 ${
                ready
                    ? 'cursor-pointer border-default-100 hover:-translate-y-[1px] hover:border-primary hover:shadow-md focus-visible:border-primary'
                    : 'cursor-default border-default-100'
            }`}
            onClick={replace}
            onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) replace();
            }}
        >
            <div className='flex h-[30px] items-center justify-between rounded-t-[10px] bg-content2 px-[10px]'>
                <div className='flex min-w-0 items-center gap-[8px]'>
                    {service && (
                        <img
                            src={service.info.icon}
                            className='h-[18px] w-[18px]'
                            draggable={false}
                        />
                    )}
                    <span className='shrink-0 text-[13px]'>
                        {getDisplayInstanceName(config[INSTANCE_NAME_CONFIG_KEY], () =>
                            t(`services.writing.${serviceName}.title`)
                        )}
                    </span>
                    {spec.label && (
                        <span className='truncate rounded-full bg-primary/15 px-[8px] py-[1px] text-[12px] text-primary'>
                            {spec.label}
                        </span>
                    )}
                    <PulseLoader
                        loading={isLoading}
                        color='currentColor'
                        size={6}
                        cssOverride={{ display: 'inline-block', opacity: 0.5 }}
                    />
                </div>
                {/* A press on a button is not a click on the box. */}
                <div
                    className='flex shrink-0 items-center gap-[4px]'
                    onClick={(e) => e.stopPropagation()}
                >
                    {ready && (
                        <span className='text-[12px] text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100'>
                            {t('writing.replace')}
                        </span>
                    )}
                    <Tooltip content={t('translate.copy')}>
                        <Button
                            isIconOnly
                            variant='light'
                            size='sm'
                            className='h-[24px] w-[24px] min-w-0'
                            aria-label={t('translate.copy')}
                            isDisabled={!ready}
                            onPress={() => {
                                void writeText(result);
                            }}
                        >
                            <MdContentCopy className='text-[14px]' />
                        </Button>
                    </Tooltip>
                </div>
            </div>
            <div className='select-none px-[12px] py-[10px] text-[1rem] leading-[1.5]'>
                {isLoading && result === '' && (
                    // As tall as the text it stands in for, so that the box hardly changes when the answer comes.
                    <div
                        className='relative'
                        aria-busy='true'
                    >
                        <p className='invisible whitespace-pre-wrap break-words'>{text}</p>
                        <div className='writing-skeleton absolute inset-0' />
                    </div>
                )}
                {result !== '' && <p className='whitespace-pre-wrap break-words'>{result}</p>}
                {error !== '' && (
                    <div onClick={(e) => e.stopPropagation()}>
                        {error.split('\n').map((line, index) => (
                            <p
                                key={index}
                                className='break-words text-red-500'
                            >
                                {line}
                            </p>
                        ))}
                        <Button
                            size='sm'
                            variant='flat'
                            className='mt-[6px]'
                            startContent={<GiCycle className='text-[14px]' />}
                            onPress={ask}
                        >
                            {t('translate.retry')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
