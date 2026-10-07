import { Code, Card, CardBody, Button, Link, Progress, Skeleton } from '@nextui-org/react';
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/api/shell';
import React, { useEffect, useState } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { relaunch } from '@tauri-apps/api/process';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';

import { useToastStyle } from '../../hooks';
import { osType } from '../../utils/env';
import { showWindow } from '../../utils/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

const REPO_URL = 'https://github.com/whisperers26/be-native';
const RELEASES_URL = `${REPO_URL}/releases/latest`;

// Versions up to 1.1.5 cannot update themselves to a new release; they are reinstalled by hand.
function needsReinstall(version: string): boolean {
    const [major = 0, minor = 0, patch = 0] = version.split('.').map((n) => parseInt(n, 10) || 0);
    return major !== 1 ? major < 1 : minor !== 1 ? minor < 1 : patch <= 5;
}

// 0 until the download-progress listener has been registered.
let unlisten: Promise<UnlistenFn> | 0 = 0;
let eventId = 0;

// The payload of Tauri's download-progress event: contentLength is null when the server sends no Content-Length.
interface DownloadProgress {
    chunkLength: number;
    contentLength: number | null;
}

export default function Updater() {
    const [downloaded, setDownloaded] = useState(0);
    const [total, setTotal] = useState(0);
    const [body, setBody] = useState('');
    const [reinstall, setReinstall] = useState(false);
    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    useEffect(() => {
        if (appWindow.label === 'updater') {
            showWindow();
        }
        checkUpdate().then(
            (update) => {
                if (update.shouldUpdate) {
                    // checkUpdate sets the manifest whenever shouldUpdate is true.
                    setBody(update.manifest!.body);
                    getVersion().then((version) => setReinstall(needsReinstall(version)));
                } else {
                    setBody(t('updater.latest'));
                }
            },
            (e) => {
                setBody(e.toString());
                toast.error(e.toString(), { style: toastStyle });
            }
        );
        if (unlisten === 0) {
            unlisten = listen<DownloadProgress>('tauri://update-download-progress', (e) => {
                if (eventId === 0) {
                    eventId = e.id;
                }
                if (e.id === eventId) {
                    // @ts-expect-error known bug (known-issues.md): contentLength can be null
                    setTotal(e.payload.contentLength);
                    setDownloaded((a) => {
                        return a + e.payload.chunkLength;
                    });
                }
            });
        }
    }, []);

    return (
        <div
            className={`bg-background h-screen ${
                osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
            }`}
        >
            <Toaster />
            <div className='p-[5px] h-[35px] w-full select-none cursor-default'>
                <div
                    data-tauri-drag-region='true'
                    className={`h-full w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-start'}`}
                >
                    <img
                        src='icon.png'
                        className='h-[25px] w-[25px] mr-[10px]'
                        draggable={false}
                    />
                    <h2>{t('updater.title')}</h2>
                </div>
            </div>
            {reinstall && (
                <div className='mx-[80px] mt-[10px] p-[10px] rounded-lg bg-warning-100 text-warning-800 text-[14px]'>
                    <b>{t('updater.reinstall_title')}</b>
                    <p>{t('updater.reinstall')}</p>
                    <Link
                        className='cursor-pointer'
                        size='sm'
                        onPress={() => open(REPO_URL)}
                    >
                        {t('updater.repo')}: {REPO_URL}
                    </Link>
                </div>
            )}
            <Card className='mx-[80px] mt-[10px] overscroll-auto h-[calc(100vh-150px)]'>
                <CardBody>
                    {body === '' ? (
                        <div className='space-y-3'>
                            <Skeleton className='w-3/5 rounded-lg'>
                                <div className='h-3 w-3/5 rounded-lg bg-default-200'></div>
                            </Skeleton>
                            <Skeleton className='w-4/5 rounded-lg'>
                                <div className='h-3 w-4/5 rounded-lg bg-default-200'></div>
                            </Skeleton>
                            <Skeleton className='w-2/5 rounded-lg'>
                                <div className='h-3 w-2/5 rounded-lg bg-default-300'></div>
                            </Skeleton>
                        </div>
                    ) : (
                        <ReactMarkdown
                            className='markdown-body select-text'
                            components={{
                                code: ({ node, ...props }) => {
                                    const { children } = props;
                                    return <Code size='sm'>{children}</Code>;
                                },
                                h2: ({ node, ...props }) => (
                                    <b>
                                        <h2
                                            className='text-[24px]'
                                            {...props}
                                        />
                                        <hr />
                                        <br />
                                    </b>
                                ),
                                h3: ({ node, ...props }) => (
                                    <b>
                                        <br />
                                        <h3
                                            className='text-[18px]'
                                            {...props}
                                        />
                                        <br />
                                    </b>
                                ),
                                li: ({ node, ...props }) => {
                                    const { children } = props;
                                    return (
                                        <li
                                            className='list-disc list-inside'
                                            children={children}
                                        />
                                    );
                                },
                            }}
                        >
                            {body}
                        </ReactMarkdown>
                    )}
                </CardBody>
            </Card>
            {downloaded !== 0 && (
                <Progress
                    aria-label='Downloading...'
                    label={t('updater.progress')}
                    value={(downloaded / total) * 100}
                    classNames={{
                        base: 'w-full px-[80px]',
                        track: 'drop-shadow-md border border-default',
                        indicator: 'bg-gradient-to-r from-pink-500 to-yellow-500',
                        label: 'tracking-wider font-medium text-default-600',
                        value: 'text-foreground/60',
                    }}
                    showValueLabel
                    size='sm'
                />
            )}

            <div className='grid gap-4 grid-cols-2 h-[50px] my-[10px] mx-[80px]'>
                <Button
                    variant='flat'
                    isLoading={downloaded !== 0}
                    isDisabled={downloaded !== 0}
                    color='primary'
                    onPress={() => {
                        if (reinstall) {
                            open(RELEASES_URL);
                            return;
                        }
                        installUpdate().then(
                            () => {
                                toast.success(t('updater.installed'), { style: toastStyle, duration: 10000 });
                                relaunch();
                            },
                            (e) => {
                                toast.error(e.toString(), { style: toastStyle });
                            }
                        );
                    }}
                >
                    {downloaded !== 0
                        ? downloaded > total
                            ? t('updater.installing')
                            : t('updater.downloading')
                        : reinstall
                          ? t('updater.download')
                          : t('updater.update')}
                </Button>
                <Button
                    variant='flat'
                    color='danger'
                    onPress={() => {
                        appWindow.close();
                    }}
                >
                    {t('updater.cancel')}
                </Button>
            </div>
        </div>
    );
}
