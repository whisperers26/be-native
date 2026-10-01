import { useAtom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import type { Dispatch, SetStateAction } from 'react';

import { useGetState } from './useGetState';

export const useSyncAtom = <T>(
    atom: PrimitiveAtom<T>
): [Awaited<T>, Dispatch<SetStateAction<Awaited<T>>>, () => void] => {
    const [atomValue, setAtomValue] = useAtom(atom);
    const [localValue, setLocalValue, getLocalValue] = useGetState(atomValue);

    const syncAtom = () => setAtomValue(getLocalValue());

    return [localValue, setLocalValue, syncAtom];
};
