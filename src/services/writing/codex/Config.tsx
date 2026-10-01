import React from 'react';

import AgentCliConfig from '../../../components/AgentCliConfig';
import type { ServiceConfigProps } from '../../../types/service';

// Codex model names change with its releases and cannot be checked here, so the model is a plain text field.
export function Config(props: ServiceConfigProps) {
    return (
        <AgentCliConfig
            {...props}
            kind='writing'
            provider='codex'
            models={[]}
            efforts={['default', 'minimal', 'low', 'medium', 'high', 'xhigh']}
            defaultModel=''
            defaultEffort='low'
        />
    );
}
