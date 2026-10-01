import { useCallback } from 'react';

// Older WebKit only has the prefixed name.
type WebkitWindow = typeof window & { webkitAudioContext: typeof AudioContext };

let audioContext = new (window.AudioContext || (window as WebkitWindow).webkitAudioContext)();
let source: AudioBufferSourceNode | null = null;

export const useVoice = () => {
    // @ts-expect-error called without a dependency list, so every render gets a new function
    const playOrStop = useCallback((data: number[]) => {
        if (source) {
            // 如果正在播放，停止播放
            source.stop();
            source.disconnect();
            source = null;
        } else {
            // 如果没在播放，开始播放
            audioContext.decodeAudioData(new Uint8Array(data).buffer, (buffer) => {
                source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start();
                source.onended = () => {
                    // source is already null here after a manual stop, which also fires `ended`
                    source!.disconnect();
                    source = null;
                };
            });
        }
    });

    return playOrStop;
};
