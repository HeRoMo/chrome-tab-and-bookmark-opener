import { getEnvVar } from './lib/shell.js';

export function run(argv: string[]): void {
  const url = argv[0];
  const itemType = getEnvVar('itemType'); // 'tab' | 'bookmark', set as an Alfred variable by the Script Filter

  const chrome = Application('Google Chrome');
  chrome.activate();

  if (itemType === 'tab') {
    const windowIndex = Number(getEnvVar('windowIndex'));
    const tabIndex = Number(getEnvVar('tabIndex'));

    const windows = chrome.windows();
    if (windowIndex >= 0 && windowIndex < windows.length) {
      const win = windows[windowIndex];
      const tabs = win.tabs();
      if (tabIndex >= 0 && tabIndex < tabs.length) {
        win.activeTabIndex = tabIndex + 1; // JXA tab indices are 1-based
      }
      win.index = 1; // bring this window to the front
      return;
    }
    // Fall through to opening a new tab if the recorded indices are stale
    // (e.g. a tab/window was closed between search and selection).
  }

  const targetWindow = chrome.windows.length > 0 ? chrome.windows[0] : chrome.Window().make();
  targetWindow.tabs.push(chrome.Tab({ url }));
  targetWindow.index = 1;
}
