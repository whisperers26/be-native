import { useState, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export const useGetState = <T>(initState: T | (() => T)): [T, Dispatch<SetStateAction<T>>, () => T] => {
    const [state, setState] = useState(initState);
    const stateRef = useRef(state);
    stateRef.current = state;
    const getState = useCallback(() => stateRef.current, []);
    return [state, setState, getState];
};
