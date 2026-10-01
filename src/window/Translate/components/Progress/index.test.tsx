import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Progress from './index';

const at = { x: 0, y: 0 };

describe('the progress indicator of the Translate window', () => {
    it('shows the icon of the service at work in a turning ring', () => {
        const { container } = render(
            <Progress
                icons={['logo/google.svg']}
                origin={at}
                leaving={false}
                animated
                onPress={() => {}}
            />
        );

        expect(container.querySelector('img')).toHaveAttribute('src', 'logo/google.svg');
        expect(container.querySelector('.translate-progress-arc')).not.toBeNull();
        expect(container.querySelector('.translate-progress-appear')).not.toBeNull();
    });

    it('keeps the ring turning, and nothing else moving, with the animations off', () => {
        const { container } = render(
            <Progress
                icons={['logo/google.svg']}
                origin={at}
                leaving={false}
                animated={false}
                onPress={() => {}}
            />
        );

        expect(container.querySelector('.translate-progress-arc')).not.toBeNull();
        expect(container.querySelector('.translate-progress-appear')).toBeNull();
        expect(container.querySelector('.translate-progress-breathe')).toBeNull();
        expect(container.querySelector('.translate-progress-icon')).toBeNull();
    });
});
