import React from 'react';

import AgentCliConfig from '../../../components/AgentCliConfig';
import { CLAUDE_CODE_MODELS } from '../../../utils/agent_cli';
import type { ServiceConfigProps } from '../../../types/service';

// `off` turns thinking off, which is what makes a rewrite fast; `default` leaves it to the model.
export function Config(props: ServiceConfigProps) {
    return (
        <AgentCliConfig
            {...props}
            kind='writing'
            provider='claude_code'
            models={CLAUDE_CODE_MODELS}
            efforts={['off', 'default', 'low', 'medium', 'high', 'xhigh', 'max']}
            defaultModel={CLAUDE_CODE_MODELS[0].value}
            defaultEffort='off'
        />
    );
}
