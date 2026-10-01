import { semanticColors } from '@nextui-org/theme';
import { useTheme } from 'next-themes';

// A NextUI ColorScale may also be a string; the semantic colours never are.
type Scale = { DEFAULT: string };

export const useToastStyle = () => {
    const { theme } = useTheme();
    const toastStyle = {
        background:
            theme == 'dark'
                ? (semanticColors.dark.content1 as Scale).DEFAULT
                : (semanticColors.light.content1 as Scale).DEFAULT,
        color:
            theme == 'dark'
                ? (semanticColors.dark.foreground as Scale).DEFAULT
                : (semanticColors.light.foreground as Scale).DEFAULT,
        wordBreak: 'break-all' as const,
        select: 'text',
    };

    return toastStyle;
};
