import { Button, Card, CardBody, Input, Switch } from '@nextui-org/react';
import { MdDeleteOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { DEFAULT_TONES } from '../../../../utils/writing_tones';
import { useConfig } from '../../../../hooks/useConfig';
import type { Tone } from '../../../../utils/writing_tones';

export default function Writing() {
    const [tones, setTones] = useConfig<Tone[]>('writing_tones', DEFAULT_TONES);
    const [closeOnBlur, setCloseOnBlur] = useConfig('writing_close_on_blur', true);
    const { t } = useTranslation();

    const changeTone = (index: number, change: Partial<Tone>) => {
        setTones(tones!.map((tone, i) => (i === index ? { ...tone, ...change } : tone)));
    };

    return (
        <>
            <Card className='mb-[10px]'>
                <CardBody>
                    <h3>{t('config.writing.tones')}</h3>
                    <p className='mb-[10px] text-[12px] text-default-500'>{t('config.writing.tones_description')}</p>
                    {tones !== null &&
                        tones.map((tone, index) => (
                            <div
                                className='mb-[8px] flex gap-[8px]'
                                key={index}
                            >
                                <Input
                                    size='sm'
                                    variant='bordered'
                                    className='w-[30%]'
                                    aria-label={t('config.writing.tone_name')}
                                    placeholder={t('config.writing.tone_name')}
                                    value={tone.name}
                                    onValueChange={(name) => changeTone(index, { name })}
                                />
                                <Input
                                    size='sm'
                                    variant='bordered'
                                    aria-label={t('config.writing.tone_instruction')}
                                    placeholder={t('config.writing.tone_instruction')}
                                    value={tone.instruction}
                                    onValueChange={(instruction) => changeTone(index, { instruction })}
                                />
                                <Button
                                    isIconOnly
                                    size='sm'
                                    variant='light'
                                    color='danger'
                                    className='my-auto'
                                    aria-label={t('config.writing.remove_tone')}
                                    onPress={() => setTones(tones.filter((_, i) => i !== index))}
                                >
                                    <MdDeleteOutline className='text-[18px]' />
                                </Button>
                            </div>
                        ))}
                    {tones !== null && (
                        <div className='flex gap-[8px]'>
                            <Button
                                size='sm'
                                variant='flat'
                                onPress={() => setTones([...tones, { name: '', instruction: '' }])}
                            >
                                {t('config.writing.add_tone')}
                            </Button>
                            <Button
                                size='sm'
                                variant='light'
                                onPress={() => setTones(DEFAULT_TONES)}
                            >
                                {t('config.writing.reset_tones')}
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>
            <Card>
                <CardBody>
                    <div className='config-item'>
                        <h3>{t('config.writing.close_on_blur')}</h3>
                        {closeOnBlur !== null && (
                            <Switch
                                isSelected={closeOnBlur}
                                onValueChange={(v) => {
                                    setCloseOnBlur(v);
                                }}
                            />
                        )}
                    </div>
                </CardBody>
            </Card>
        </>
    );
}
