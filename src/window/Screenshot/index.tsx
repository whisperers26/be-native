import React, { useEffect, useState, useRef } from 'react';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { currentMonitor } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { warn } from 'tauri-plugin-log-api';
import { invoke } from '@tauri-apps/api';
import type { MutableRefObject } from 'react';

interface Point {
    x: number;
    y: number;
}

/** What the `cursor_position` command returns, in physical pixels. */
interface CursorPosition extends Point {
    /** The origin of the monitor under the cursor. */
    monitor: Point;
}

const CURSOR_POLL_MS = 50;

export default function Screenshot() {
    const [imgurl, setImgurl] = useState('');
    const [isMoved, setIsMoved] = useState(false);
    const [isDown, setIsDown] = useState(false);
    const [mouseDownX, setMouseDownX] = useState(0);
    const [mouseDownY, setMouseDownY] = useState(0);
    const [mouseMoveX, setMouseMoveX] = useState(0);
    const [mouseMoveY, setMouseMoveY] = useState(0);
    // Where the crosshair lines meet, in CSS pixels; null while the pointer is not over the window.
    const [cursor, setCursor] = useState<Point | null>(null);

    // What the poll below reads; it outlives the render it was created in.
    const origin = useRef<Point | null>(null);
    const pointerSeen = useRef(false);

    // The image is always rendered, so the ref is set before any handler runs.
    const imgRef = useRef<HTMLImageElement>() as MutableRefObject<HTMLImageElement>;

    useEffect(() => {
        currentMonitor().then((monitor) => {
            // @ts-expect-error known bug (known-issues.md): currentMonitor() can return null
            const position = monitor.position;
            origin.current = { x: position.x, y: position.y };
            invoke('screenshot', { x: position.x, y: position.y }).then(() => {
                appCacheDir().then((appCacheDirPath) => {
                    join(appCacheDirPath, 'pot_screenshot.png').then((filePath) => {
                        setImgurl(convertFileSrc(filePath));
                    });
                });
            });
        });
    }, []);

    // Until the mouse moves there is no mouse event to place the lines with, so ask Rust where the cursor is.
    useEffect(() => {
        let busy = false;
        const timer = setInterval(async () => {
            if (busy || origin.current === null) return;
            busy = true;
            try {
                const position = await invoke<CursorPosition>('cursor_position');
                const here = origin.current;
                if (position.monitor.x === here.x && position.monitor.y === here.y && !pointerSeen.current) {
                    setCursor({
                        x: (position.x - here.x) / window.devicePixelRatio,
                        y: (position.y - here.y) / window.devicePixelRatio,
                    });
                }
            } catch {
                // No cursor position this time; the next poll asks again.
            } finally {
                busy = false;
            }
        }, CURSOR_POLL_MS);
        return () => clearInterval(timer);
    }, []);

    return (
        <>
            <img
                ref={imgRef}
                className='fixed top-0 left-0 w-full select-none'
                src={imgurl}
                draggable={false}
                onLoad={() => {
                    if (imgurl !== '' && imgRef.current.complete) {
                        void appWindow.show();
                        void appWindow.setFocus();
                        void appWindow.setResizable(false);
                    }
                }}
            />
            <div
                className={`fixed bg-[#2080f020] border border-solid border-sky-500 ${!isMoved && 'hidden'}`}
                style={{
                    top: Math.min(mouseDownY, mouseMoveY),
                    left: Math.min(mouseDownX, mouseMoveX),
                    bottom: screen.height - Math.max(mouseDownY, mouseMoveY),
                    right: screen.width - Math.max(mouseDownX, mouseMoveX),
                }}
            />
            {cursor && (
                <>
                    <div
                        data-testid='crosshair-horizontal'
                        className='fixed left-0 right-0 h-px bg-sky-500 pointer-events-none'
                        style={{ top: cursor.y }}
                    />
                    <div
                        data-testid='crosshair-vertical'
                        className='fixed top-0 bottom-0 w-px bg-sky-500 pointer-events-none'
                        style={{ left: cursor.x }}
                    />
                </>
            )}
            <div
                className='fixed top-0 left-0 bottom-0 right-0 cursor-none select-none'
                onMouseDown={(e) => {
                    if (e.buttons === 1) {
                        setIsDown(true);
                        setMouseDownX(e.clientX);
                        setMouseDownY(e.clientY);
                    } else {
                        void appWindow.close();
                    }
                }}
                onMouseMove={(e) => {
                    pointerSeen.current = true;
                    setCursor({ x: e.clientX, y: e.clientY });
                    if (isDown) {
                        setIsMoved(true);
                        setMouseMoveX(e.clientX);
                        setMouseMoveY(e.clientY);
                    }
                }}
                onMouseLeave={() => {
                    setCursor(null);
                }}
                onMouseUp={async (e) => {
                    appWindow.hide();
                    setIsDown(false);
                    setIsMoved(false);
                    const imgWidth = imgRef.current.naturalWidth;
                    const dpi = imgWidth / screen.width;
                    const left = Math.floor(Math.min(mouseDownX, e.clientX) * dpi);
                    const top = Math.floor(Math.min(mouseDownY, e.clientY) * dpi);
                    const right = Math.floor(Math.max(mouseDownX, e.clientX) * dpi);
                    const bottom = Math.floor(Math.max(mouseDownY, e.clientY) * dpi);
                    const width = right - left;
                    const height = bottom - top;
                    if (width <= 0 || height <= 0) {
                        warn('Screenshot area is too small');
                        await appWindow.close();
                    } else {
                        await invoke('cut_image', { left, top, width, height });
                        await emit('success');
                        await appWindow.close();
                    }
                }}
            />
        </>
    );
}
