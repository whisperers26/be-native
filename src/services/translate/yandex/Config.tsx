import { useTranslation } from 'react-i18next';
import { Button } from '@nextui-org/react';
import React from 'react';
import type { ServiceConfigProps } from '../../../types/service';

export function Config(props: ServiceConfigProps) {
    const { updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <>
            <div>{t('services.no_need')}</div>
            <div>
                <Button
                    fullWidth
                    color='primary'
                    onPress={() => {
                        updateServiceList('yandex');
                        onClose();
                    }}
                >
                    {t('common.save')}
                </Button>
            </div>
        </>
    );
}
