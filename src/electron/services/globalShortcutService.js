import { globalShortcut } from "electron";

export function createGlobalShortcutService(getMainWindow) {
  const registeredAccelerators = new Set();

  function clear() {
    for (const accelerator of registeredAccelerators) {
      globalShortcut.unregister(accelerator);
    }
    registeredAccelerators.clear();
  }

  function update(bindings) {
    clear();

    const results = {};
    const usedAccelerators = new Set();
    for (const binding of bindings) {
      const actionId =
        typeof binding?.actionId === "string" ? binding.actionId : "";
      const accelerator =
        typeof binding?.accelerator === "string" ? binding.accelerator : "";

      if (!actionId || !accelerator || usedAccelerators.has(accelerator)) {
        if (actionId) results[actionId] = false;
        continue;
      }

      usedAccelerators.add(accelerator);
      try {
        const registered = globalShortcut.register(accelerator, () => {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("shortcut-triggered", actionId);
          }
        });
        results[actionId] = registered;
        if (registered) registeredAccelerators.add(accelerator);
      } catch {
        results[actionId] = false;
      }
    }

    return results;
  }

  return { clear, update };
}
