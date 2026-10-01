import { Card, CardBody, CardFooter, Button, Tooltip } from '@nextui-org/react';
import { appWindow } from '@tauri-apps/api/window';
import React, { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MdContentCopy } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';
import { atom, useAtom } from 'jotai';

import { useConfig } from '../../../hooks';
import { focusWindow, showWindow } from '../../../utils/window';
import type { MutableRefObject } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';

export const base64Atom = atom('');
let unlisten: Promise<UnlistenFn> | null = null;

export default function ImageArea() {
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const [base64, setBase64] = useAtom(base64Atom);
    // The image is rendered only while base64 is not empty, so the ref is not always set.
    const imgRef = useRef<HTMLImageElement | null>() as MutableRefObject<HTMLImageElement | null>;
    const { t } = useTranslation();
    const load_img = () => {
        invoke<string>('get_base64').then((v) => {
            setBase64(v);
            if (hideWindow) {
                appWindow.hide();
            } else {
                showWindow();
                focusWindow();
            }
        });
    };

    useEffect(() => {
        if (hideWindow !== null) {
            load_img();
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
            unlisten = listen('new_image', (_) => {
                load_img();
            });
        }
    }, [hideWindow]);

    // known bug (known-issues.md): the Card's radius is none, sm, md or lg, so '10' falls back to lg; the cast keeps
    // the value as it is.
    return (
        <Card
            shadow='none'
            className='bg-content1 h-full ml-[12px] mr-[6px]'
            radius={'10' as unknown as 'lg'}
        >
            <CardBody className='bg-content1 h-full p-0'>
                {base64 !== '' && (
                    <img
                        ref={imgRef}
                        draggable={false}
                        className='object-contain h-full w-full'
                        src={'data:image/png;base64,' + base64}
                    />
                )}
            </CardBody>
            <CardFooter className='bg-content1 flex justify-start px-[12px]'>
                <Tooltip content={t('recognize.copy_img')}>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={async () => {
                            // known bug (known-issues.md): the ref is unset while no image is shown
                            await invoke('copy_img', {
                                width: imgRef.current!.naturalWidth,
                                height: imgRef.current!.naturalHeight,
                            });
                        }}
                    >
                        <MdContentCopy className='text-[16px]' />
                    </Button>
                </Tooltip>
            </CardFooter>
        </Card>
    );
}
