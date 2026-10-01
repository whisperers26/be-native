import React from 'react';

import ChatConfig from '../ChatConfig';
import { DEFAULT_MODEL, improve } from './index';
import type { ServiceConfigProps } from '../../../types/service';

export function Config(props: ServiceConfigProps) {
    return (
        <ChatConfig
            {...props}
            service='llm7'
            fields={['model']}
            defaults={{ model: DEFAULT_MODEL }}
            improve={improve}
        />
    );
}
