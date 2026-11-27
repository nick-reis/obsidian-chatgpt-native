function makeHiddenHeaderCSS() {
    // Only the ChatGPT page header and our own fallback control. Keep the
    // conversation, composer, navigation overlay and Obsidian toolbar intact.
    const headers = "#page-header, #thread-header, [data-testid='conversation-header'], [data-testid='thread-header'], [data-testid='chat-header'], [data-testid='page-header'], .app-shell-main-header, [data-app-shell-header], [data-app-shell-main-header], [data-obsidian-hidden-toolbar], #obsidian-chatgpt-sidebar-toggle";
    // A title-only header can mount before (or without) Share/New chat.
    // Exclude sidebar titles, message content, dialogs, and the composer.
    const titles = ":is(#conversation-title, #thread-title, [data-testid='conversation-title'], [data-testid='conversation-title-button'], [data-testid='thread-title'], [data-testid='chat-title'], [data-testid='chat-title-button'])";
    const protectedContent = ":not(:is(aside *, nav *, article *, [role=dialog] *, [data-message-author-role] *, #app-shell-sidebar *, #browser-sidebar-popover *, #thread-bottom *, form *))";
    return headers + " { display: none !important; }\n" +
        "[data-app-shell-sidebar-open] " + titles + protectedContent + " { display: none !important; }";
}


/**
 * Current ChatGPT releases may use a div rather than #page-header.
 * Identify only top-of-shell navigation rows, never message/composer nodes.
 */
function installHeaderHiding(enabled) {
    if (location.protocol !== "https:" ||
        !["chatgpt.com", "chat.openai.com"].includes(location.hostname) || location.port) return false;
    const key = "__obsidianChatGPTHeaderHiding";
    if (!enabled) { window[key]?.dispose(); return true; }
    if (window[key]) { window[key].refresh(); return true; }
    const attr = "data-obsidian-hidden-toolbar";
    const controls = 'button[aria-label="New chat"], a[aria-label="New chat"], button[aria-label="Share"], button[aria-label="Share chat"], button[data-testid="share-chat-button"], button[data-testid="model-switcher-dropdown-button"], button[data-testid="conversation-menu-button"], button[data-testid="chat-menu-button"], #obsidian-chatgpt-sidebar-toggle';
    const marked = new Set();
    let frame = 0, disposed = false;
    function discover() {
        frame = 0;
        if (disposed) return;
        for (const row of marked) if (!row.isConnected) marked.delete(row);
        const shell = document.querySelector("[data-app-shell-sidebar-open]");
        if (!shell) return;
        const bounds = shell.getBoundingClientRect();
        for (const control of shell.querySelectorAll(controls)) {
            if (control.closest("aside, nav, article, [role=dialog], [" + attr + "]") ||
                control.hasAttribute("data-obsidian-fallback")) continue;
            let best = null;
            for (let el = control.parentElement, depth = 0; el && el !== shell && depth < 9; el = el.parentElement, depth++) {
                if (el.matches("main, article, aside, nav, [role=dialog], [data-app-shell-sidebar-open]") ||
                    el.querySelector("article, [data-message-author-role], #prompt-textarea, [contenteditable=true], #app-shell-sidebar")) break;
                const r = el.getBoundingClientRect();
                if (r.height >= 24 && r.height <= 100 &&
                    r.width >= Math.min(280, bounds.width * 0.65) &&
                    r.top >= bounds.top - 5 && r.top <= bounds.top + 96) best = el;
            }
            if (best) {
                marked.add(best);
                best.setAttribute(attr, "");
            }
        }
    }
    function schedule() {
        if (!disposed && !frame) frame = requestAnimationFrame(discover);
    }
    const observer = new MutationObserver(records => {
        const missing = !marked.size || Array.from(marked).some(row => !row.isConnected);
        for (const record of records) {
            if (missing || (record.type === "attributes" &&
                (record.target.matches?.(controls) || record.attributeName === "data-app-shell-sidebar-open"))) {
                schedule(); return;
            }
            for (const node of record.addedNodes || []) {
                if (node.nodeType === 1 && (node.matches?.(controls) || node.querySelector?.(controls))) {
                    schedule(); return;
                }
            }
        }
    });
    window.addEventListener?.("resize", schedule);
    observer.observe(document.documentElement, {childList:true, subtree:true,
        attributes:true, attributeFilter:["aria-label","data-testid","data-app-shell-sidebar-open"]});
    window[key] = {
        refresh: schedule,
        dispose() {
            disposed = true;
            observer.disconnect();
            window.removeEventListener?.("resize", schedule);
            if (frame) cancelAnimationFrame(frame);
            for (const row of marked) row.removeAttribute(attr);
            marked.clear();
            delete window[key];
        },
    };
    discover();
    return true;
}
