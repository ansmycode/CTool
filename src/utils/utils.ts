export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let last = 0;
  let timer: NodeJS.Timeout | null = null;

  return function (this: any, ...args: any[]) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, delay);
    }
  } as T;
}
