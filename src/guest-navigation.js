// Static CSS only: leave React's navigation tree intact for native search.
function makeSidebarFreeCSS() {
    return [
        '[data-app-shell-sidebar-open] { --app-shell-left-panel-width:0px !important; --app-shell-navigation-rail-width:0px !important; --app-shell-animated-left-panel-width:0px !important; }',
        // The sidebar-free shell should not paint its former divider or a
        // second background at the edge of the fixed guest viewport.
        '[data-app-shell-sidebar-open] { border-inline-color:transparent !important; box-shadow:none !important; }',
        '[data-app-shell-sidebar-open] :is(.app-shell-main, .app-shell-main-surface, [data-app-shell-main]) { border-inline-color:transparent !important; box-shadow:none !important; }',
        'aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover, #obsidian-chatgpt-sidebar-toggle, #obsidian-chatgpt-sidebar-backdrop { display:none !important; }',
        'button[aria-controls="app-shell-sidebar"], button[aria-label="Toggle sidebar"], button[aria-label="Open sidebar"], button[aria-label="Close sidebar"], button[aria-label="Expand sidebar"], button[aria-label="Collapse sidebar"] { display:none !important; }',
        '#page-header, #thread-header, .app-shell-main-header, [data-app-shell-main-header] { padding-inline-start:76px !important; }',
    ].join("\n");
}

// Run only on explicit button clicks. No observer, polling or custom hotkey.
function invokeNativeNavigation(action) {
    if (location.protocol !== "https:" || !["chatgpt.com", "chat.openai.com"].includes(location.hostname) || location.port) return false;
    const selectors = action === "search"
        ? '[data-testid="search-chats-button"], button[aria-label="Search chats" i], a[aria-label="Search chats" i]'
        : action === "new"
        ? '[data-testid="new-chat-button"], [data-testid="create-new-chat-button"], button[aria-label="New chat" i], a[aria-label="New chat" i]'
        : null;
    if (!selectors) return false;
    const valid = el => !el.disabled && el.getAttribute("aria-disabled") !== "true" && !el.closest("article, [role=dialog], #prompt-textarea");
    const candidates = Array.from(document.querySelectorAll(selectors));
    const navs = document.querySelectorAll("#app-shell-sidebar, aside.app-shell-left-panel, #browser-sidebar-popover");
    for (const nav of navs) {
        const label = action === "search" ? /^search chats?$/i : /^new chat$/i;
        for (const el of nav.querySelectorAll('button, a, [role="button"]')) {
            if (label.test((el.getAttribute("aria-label") || el.textContent || "").trim())) candidates.push(el);
        }
    }
    const target = candidates.find(valid);
    if (!target) return false;
    target.click();
    return true;
}
