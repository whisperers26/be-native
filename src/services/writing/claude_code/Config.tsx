import React from 'react';

import AgentCliConfig from '../../../components/AgentCliConfig';
import type { ServiceConfigProps } from '../../../types/service';

// `off` turns thinking off, which is what makes a rewrite fast; `default` leaves it to the model.
export function Config(props: ServiceConfigProps) {
    return (
        <AgentCliConfig
            {...props}
            kind='writing'
            provider='claude_code'
            models={['haiku', 'sonnet', 'opus', 'fable']}
            efforts={['off', 'default', 'low', 'medium', 'high', 'xhigh', 'max']}
            defaultModel='haiku'
            defaultEffort='off'
        />
    );
}
