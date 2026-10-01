import React from 'react';

import ChatConfig from '../ChatConfig';
import { DEFAULT_MODEL, DEFAULT_REQUEST_PATH, improve } from './index';
import type { ServiceConfigProps } from '../../../types/service';

export function Config(props: ServiceConfigProps) {
    return (
        <ChatConfig
            {...props}
            service='openai'
            fields={['requestPath', 'apiKey', 'model']}
            defaults={{ requestPath: DEFAULT_REQUEST_PATH, apiKey: '', model: DEFAULT_MODEL }}
            improve={improve}
        />
    );
}
