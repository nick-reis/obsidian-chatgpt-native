// Keep rounding on buttons, messages, code blocks and the composer.
function makeFrameCSS() {
    return [
        '[data-app-shell-sidebar-open] { --app-shell-window-radius: 0px !important; --app-shell-main-surface-end-radius: 0px !important; --app-shell-rail-corner-radius: 0px !important; border-radius: 0 !important; }',
        '[data-app-shell-sidebar-open] [class*="rounded-[var(--app-shell-window-radius"],',
        '[data-app-shell-sidebar-open] [class*="rounded-s-[var(--app-shell-window-radius"],',
        '[data-app-shell-sidebar-open] [class*="rounded-e-[var(--app-shell-window-radius"],',
        '[data-app-shell-sidebar-open] [class*="rounded-[var(--app-shell-main-surface-end-radius"] { border-radius: 0 !important; }',
        '[data-app-shell-sidebar-open] [class*="before:rounded-[var(--app-shell-window-radius"]::before { border-radius: 0 !important; }',
    ].join("\n");
}

// Reduce costly compositing and layout effects without changing the viewport,
// intercepting scrolling, suspending the guest, or touching chat contents.
function makePerformanceCSS(optimizeLongChats = false) {
    const rules = [
        'html { scroll-behavior: auto !important; }',
        '#page-header { transition: none !important; scroll-behavior: auto !important; }',
        // Preserve the native width variables and animation names. A
        // nonzero duration allows transitionend/animationend handlers to
        // run, unlike cancelling the animations or forcing their geometry.
        // Scope descendants to the sidebar, never the entire chat shell.
        ':is([data-app-shell-sidebar-open], aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover, #obsidian-chatgpt-sidebar-backdrop, #obsidian-chatgpt-sidebar-toggle), :is(aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover) *, :is([data-app-shell-sidebar-open], aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover, #obsidian-chatgpt-sidebar-backdrop, #obsidian-chatgpt-sidebar-toggle)::before, :is([data-app-shell-sidebar-open], aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover, #obsidian-chatgpt-sidebar-backdrop, #obsidian-chatgpt-sidebar-toggle)::after, :is(aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover) *::before, :is(aside.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover) *::after { transition-duration: 1ms !important; transition-delay: 0s !important; animation-duration: 1ms !important; animation-delay: 0s !important; scroll-behavior: auto !important; }',
        '[class*="backdrop-blur"], [class*="backdrop-filter"], #page-header, #browser-sidebar-popover { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
        '[data-app-shell-sidebar-open] aside.app-shell-left-panel, #browser-sidebar-popover, #obsidian-chatgpt-sidebar-backdrop { box-shadow: none !important; }',
    ];
    if (optimizeLongChats) {
        // Experimental. Preserve elements, their measured sizes, and browser
        // search/accessibility. Avoid containing the active/last message.
        rules.push(
            '@supports (content-visibility: auto) {',
            'article[data-testid^="conversation-turn-"]:not(:last-of-type):not(:focus-within), article[data-turn]:not(:last-of-type):not(:focus-within) { content-visibility: auto; contain-intrinsic-size: auto 320px; }',
            '}'
        );
    }
    return rules.join("\n");
}
