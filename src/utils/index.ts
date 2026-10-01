export const debounce = <A extends unknown[]>(fn: (...args: A) => void, delay = 500) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: A) => {
        timer && clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};
