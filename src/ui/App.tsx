import Main from "./Main/index";
import { lazy, Suspense, useEffect } from "react";

const FakeGamePreview = import.meta.env.DEV
  ? lazy(() => import("@/dev/FakeGamePreview"))
  : null;

function App() {
  useEffect(() => {
    // Keep startup diagnostics behind Vite's compile-time dev guard.
    if (import.meta.env.DEV) {
      console.info(`[startup] React committed at ${Math.round(performance.now())}ms after navigation`);
      if (!performance.getEntriesByName('ctool:startup-reported').length) {
        performance.mark('ctool:startup-reported');
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const entry = performance.getEntriesByName('ctool:renderer-entry')[0];
        console.info(`[startup] Phases ${JSON.stringify({
          htmlResponseMs: Math.round(navigation?.responseEnd ?? 0),
          domInteractiveMs: Math.round(navigation?.domInteractive ?? 0),
          modulesReadyMs: Math.round(entry?.startTime ?? 0),
          reactAfterModulesMs: Math.round(performance.now() - (entry?.startTime ?? performance.now())),
          firstPaintMs: performance.getEntriesByName('first-paint')[0]
            ? Math.round(performance.getEntriesByName('first-paint')[0].startTime) : null,
          resourceCount: resources.length,
        })}`);
        // Local module paths only: do not log query strings, API URLs or credentials.
        const slowest = resources.filter(resource => {
          const url = new URL(resource.name);
          return url.origin === window.location.origin &&
            (url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/') || url.pathname.startsWith('/@vite/'));
        }).sort((a, b) => b.duration - a.duration).slice(0, 8).map(resource => ({
          path: new URL(resource.name).pathname,
          startMs: Math.round(resource.startTime),
          waitMs: Math.round(Math.max(0, resource.responseStart - resource.requestStart)),
          durationMs: Math.round(resource.duration),
          bytes: resource.transferSize,
        }));
        console.info(`[startup] Slowest local resources ${JSON.stringify(slowest)}`);
      }
    }
  }, []);
  const isFakeGamePreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") === "fake-game";

  if (isFakeGamePreview && FakeGamePreview) {
    return <Suspense fallback={null}><FakeGamePreview /></Suspense>;
  }

  return <Main />;
}

export default App
