import React from 'react';

import ChatConfig from '../ChatConfig';
import { DEFAULT_MODEL, improve } from './index';
import type { ServiceConfigProps } from '../../../types/service';

export function Config(props: ServiceConfigProps) {
    return (
        <ChatConfig
            {...props}
            service='llm7'
            fields={['apiKey', 'model']}
            defaults={{ apiKey: '', model: DEFAULT_MODEL }}
            improve={improve}
        />
    );
}
