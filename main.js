// Generated from src/ by build.py. Edit the source modules, not this bundle.

const { Plugin, PluginSettingTab, Setting, Notice, setIcon, addIcon } = require("obsidian");

const CHATGPT_RIBBON_ICON = 'chatgpt-theme-sync-logo';
const CHATGPT_RIBBON_SVG = "<g transform=\"scale(0.3125)\" fill=\"currentColor\" stroke=\"none\"><path d=\"m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z\"/></g>";

const DEFAULT_SETTINGS = {
    enabled: true,
    matchSidebar: true,
    matchComposer: true,
    composerClearance: true,
    matchAccent: true,
    matchSelection: true,
    alwaysShowSidebarToggle: true,
    sidebarFreeMode: true,
    squareFrame: true,
    hideAddressBar: true,
    performanceMode: true,
    keepSidebarWarm: true,
    optimizeLongChats: true,
    smoothResize: true,
    hideChatGPTHeader: true,
    solidHeader: true,
    matchWebviewBackground: true,
    launcherEnabled: true,
    launcherMode: "home",
    launcherURL: "",
};

function isChatGPT(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" &&
            (parsed.hostname === "chatgpt.com" || parsed.hostname === "chat.openai.com") &&
            !parsed.username && !parsed.password && !parsed.port;
    } catch {
        return false;
    }
}

// The launcher only opens a URL. It never writes to a composer.
function launcherDestination(settings) {
    if (settings.launcherMode === "chat") {
        const url = String(settings.launcherURL || "").trim();
        return isChatGPT(url) ? {url} : null;
    }
    return {url:"https://chatgpt.com/"};
}

async function openLauncherTab(workspace, destination) {
    const leaf = workspace.getLeaf("tab");
    try {
        await leaf.setViewState({type:"webviewer",state:{url:destination.url,navigate:true},active:true});
        if (typeof leaf.view?.getViewType === "function" && leaf.view.getViewType() !== "webviewer")
            throw new Error("Web Viewer unavailable");
        // active:true alone does not reliably activate a newly created
        // Web Viewer in every Obsidian layout.
        if (typeof workspace.revealLeaf === "function") await workspace.revealLeaf(leaf);
        workspace.setActiveLeaf?.(leaf,{focus:true});
        return leaf;
    } catch (error) {
        leaf.detach?.();
        throw error;
    }
}

// Resolve theme colors locally in Obsidian, never inside the guest page.
function readPalette(doc) {
    const dark = doc.body.classList.contains("theme-dark");
    const probe = doc.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    doc.body.appendChild(probe);
    const ctx = doc.createElement("canvas").getContext("2d", {willReadFrequently: true});
    const readColor = (name, fallback, preserveAlpha = false) => {
        if (!ctx) return fallback;
        probe.style.color = "var(" + name + ", " + fallback + ")";
        const color = doc.defaultView.getComputedStyle(probe).color;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = fallback;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        if (pixel[3] !== 255) {
            if (preserveAlpha && pixel[3] > 0)
                return "rgba(" + [pixel[0],pixel[1],pixel[2],+(pixel[3]/255).toFixed(3)].join(", ") + ")";
            return fallback;
        }
        return "#" + Array.from(pixel.slice(0, 3), x => x.toString(16).padStart(2, "0")).join("");
    };
    try {
        const primary = readColor("--background-primary", dark ? "#1e1e1e" : "#ffffff");
        const secondary = readColor("--background-secondary", dark ? "#262626" : "#f4f4f4");
        const elevated = readColor("--background-modifier-form-field", secondary);
        const accent = readColor("--interactive-accent", readColor("--color-accent", "#7c5cfc"));
        const accentHover = readColor("--interactive-accent-hover", accent);
        const selection = readColor("--text-selection", "color-mix(in srgb, " + accent + " 30%, transparent)", true);
        return { mode: dark ? "dark" : "light", primary, secondary, elevated, accent, accentHover, selection };
    } finally {
        probe.remove();
    }
}

// Only override surface tokens. Preserve text, semantic syntax colors, accent,
// contrast, button colors and native typography. Scope by matching theme mode
// so switching ChatGPT itself to the opposite mode does not make text illegible.
function makeCSS(palette, settings) {
    const { mode, primary, secondary, elevated } = palette;
    const root = 'html:is([data-theme="' + mode + '"], .' + mode + ')';
    const scope = root + ', ' + root + ' [data-theme="' + mode + '"]';
    const tokens = {
        "--app-color-background-surface": primary,
        "--color-background-panel": primary,
        "--main-surface-primary": primary,
        "--bg-primary": primary,
        "--color-token-main-surface-primary": primary,
        "--main-surface-secondary": secondary,
        "--bg-secondary": secondary,
        "--app-color-background-card": elevated,
        "--app-color-background-elevated-primary": elevated,
        "--app-color-background-elevated-primary-opaque": elevated,
        "--app-color-background-application-menu": elevated,
        "--color-surface-elevated-secondary": elevated,
    };
    if (settings.matchSidebar) {
        Object.assign(tokens, {
            "--app-color-background-surface-under": secondary,
            "--app-color-background-shell": secondary,
            "--sidebar-surface-primary": secondary,
            "--sidebar-surface-secondary": secondary,
            "--color-token-sidebar-surface-primary": secondary,
        });
    }
    if (settings.sidebarFreeMode) {
        // Match the exposed host canvas, not the hidden sidebar surface.
        tokens["--app-color-background-surface-under"] = primary;
        tokens["--app-color-background-shell"] = primary;
    }
    if (settings.matchComposer) {
        Object.assign(tokens, {
            "--color-background-composer-surface": elevated,
            "--composer-surface": elevated,
            "--color-token-composer-surface": elevated,
        });
    }
    const declarations = Object.entries(tokens)
        .map(([name, value]) => "  " + name + ": " + value + " !important;")
        .join("\n");
    const canvas = settings.matchWebviewBackground ?
        root + " { color-scheme: " + mode + " !important; }\n" +
        'html:not([data-theme]):not(.dark):not(.light) { background-color: ' + primary + ' !important; color-scheme: ' + mode + ' !important; }\n' : "";
    const header = settings.solidHeader ?
        root + " #page-header { background-image:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; mask-image:none !important; -webkit-mask-image:none !important; }\n" +
        root + " #page-header::before, " + root + " #page-header::after { background-image:none !important; }\n" : "";
    return scope + " {\n" + declarations + "\n}\n" +
        root + ", " + root + " body { background-color: " + primary + " !important; }\n" +
        root + " #page-header { background-color: " + primary + " !important; }\n" + canvas + header;
}

// Keep semantic status/syntax colors untouched. Only ChatGPT's accent roles
// receive the Obsidian interactive color. Use a contrasting foreground on
// solid filled controls, regardless of the host theme's text color.
function accentLuminance(hex) {
    const rgb = hex.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255);
    const linear = rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return linear[0]*0.2126 + linear[1]*0.7152 + linear[2]*0.0722;
}

function accentForeground(hex) {
    return accentLuminance(hex) > Math.sqrt(0.0525)-0.05 ? "#000000" : "#ffffff";
}

function mixAccent(a,b,weight) {
    return "#" + [1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*weight +
        parseInt(b.slice(i,i+2),16)*(1-weight)).toString(16).padStart(2,"0")).join("");
}

function readableAccent(accent, background) {
    const contrast = (a,b) => (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
    const base = accentLuminance(background);
    const ink = accentForeground(background);
    for (let step=0;step<=20;step++) {
        const candidate = mixAccent(ink,accent,step/20);
        if (contrast(accentLuminance(candidate),base)>=4.5) return candidate;
    }
    return ink;
}

// Accent roles from the Codex appearance stylesheet and actual chat DOM.
// No per-color palette guessing or overriding generic blue/syntax tokens.
function makeAccentCSS(palette, settings) {
    const {accent, accentHover, selection, mode} = palette;
    const rules = [], tokens = {};
    const validHex = value => /^#[0-9a-f]{6}$/i.test(value || "");
    if (settings.matchAccent && validHex(accent)) {
        const dark = mode !== "light";
        const surface = validHex(palette.primary) ? palette.primary : dark ? "#1c1c1c" : "#ffffff";
        const hover = validHex(accentHover) ? accentHover : accent;
        const active = mixAccent(accent,dark?"#000000":"#ffffff",0.85);
        // Preserve the native distinction between solid controls and tinted
        // conversation bubbles instead of filling all accent surfaces equally.
        const bubble = mixAccent(accent,surface,dark?0.45:0.15);
        const soft = mixAccent(accent,surface,dark?0.30:0.12);
        const ink = readableAccent(accent,surface);
        const hoverInk = readableAccent(hover,surface);
        const solidInk = accentForeground(accent);
        // Composer modules can redeclare these variables below the theme
        // root. Apply them on the actual primary-action utility classes
        // found in the exported stylesheet, including the icon itself.
        // Keep native hover, focus and disabled rules intact.
        // Use a richer accent than the message bubble, keeping the arrow
        // white. Darken only as needed for 4.5:1 foreground contrast.
        let composer = mixAccent(accent,surface,0.82);
        for (let step=1; accentLuminance(composer)>1.05/4.5-0.05 && step<=20; step++) {
            composer = mixAccent("#000000",mixAccent(accent,surface,0.82),step/20);
        }
        const composerInk = "#ffffff";
        rules.push("html .bg-composer-primary, html .text-composer-primary { --color-background-composer-primary: " + composer + " !important; --color-text-composer-primary: " + composerInk + " !important; }");
        Object.assign(tokens, {
            "--codex-base-accent": accent,
            "--color-accent": accent,
            "--color-background-composer-primary": composer,
            "--color-text-composer-primary": composerInk,
            "--color-background-user-message": bubble,
            "--color-text-user-message": accentForeground(bubble),
            "--user-message-background-luminance": String(accentLuminance(bubble)),
            "--color-background-attribution-highlight": "color-mix(in srgb, "+accent+" 35%, transparent)",
            "--app-color-background-accent": soft,
            "--app-color-background-accent-hover": mixAccent(accent,surface,dark?0.38:0.18),
            "--app-color-background-accent-active": mixAccent(accent,surface,dark?0.45:0.25),
            "--app-color-border-focus": accent,
            "--app-color-icon-accent": ink,
            "--app-color-text-accent": ink,
            "--app-color-text-on-accent": accentForeground(soft),
            "--color-text-on-accent": solidInk,
            "--color-background-accent-solid": accent,
            "--color-background-accent-solid-hover": hover,
            "--color-background-accent-solid-active": active,
            "--color-text-accent-solid": solidInk,
            "--color-text-accent": ink,
            "--color-text-accent-hover": hoverInk,
            "--color-text-accent-soft": ink,
            "--color-ring-accent": accent,
            "--color-border-accent-outline": ink,
            "--color-background-accent-soft-alpha": "color-mix(in srgb, "+accent+" 10%, transparent)",
            "--color-background-accent-soft-alpha-hover": "color-mix(in srgb, "+accent+" 17%, transparent)",
            "--color-background-accent-soft-alpha-active": "color-mix(in srgb, "+accent+" 25%, transparent)",
            "--color-text-composer-reference": ink,
            "--color-text-mode-toggle-accent": ink,
            "--link-primary-text-color": ink,
            "--link-primary-text-color-hover": hoverInk,
        });
    }
    if (settings.matchSelection && selection) {
        tokens["--color-background-text-selection"] = selection;
        rules.push("html::selection, html *::selection { background-color: " + selection + " !important; }");
    }
    const declarations = Object.entries(tokens).map(([key,value])=>"  "+key+": "+value+" !important;").join("\n");
    // The supplied CSS declares these roles on :root and [data-theme].
    // Override them at the same boundaries through the existing user-origin
    // stylesheet, so hydrated appearance styles cannot supersede them.
    if (declarations) rules.unshift("html, html[data-theme], html [data-theme] {\n"+declarations+"\n}");
    return rules.join("\n");
}

// Resolve only the guest WebContents, never the Obsidian window. Do not
// install dependencies or start a remote debugging server.
function getGuestDebugger(view) {
    const id = view.getWebContentsId?.();
    if (!Number.isInteger(id) || id <= 0) return null;
    let remote;
    try { remote = require("@electron/remote"); }
    catch { try { remote = require("electron").remote; } catch {} }
    const contents = remote?.webContents?.fromId(id);
    return contents?.debugger ?? null;
}

// Runs only within ChatGPT's own webview and touches navigation controls only.

function installSidebarToggle(enabled, keepWarm = true, sessionId = "", hostManaged = false) {
    if (location.protocol !== "https:" ||
        !["chatgpt.com", "chat.openai.com"].includes(location.hostname) || location.port) return false;
    const key = "__obsidianChatGPTSidebarToggle";
    if (!enabled) {
        const controller = window[key];
        if (controller && (!sessionId || !controller.sessionId || controller.sessionId === sessionId))
            controller.dispose();
        return true;
    }
    if (window[key]?.version === 3 && window[key].sessionId === sessionId) {
        window[key].configure(keepWarm, hostManaged); window[key].refresh(); return true;
    }
    window[key]?.dispose();
    const root = document.documentElement;
    const desktop = window.matchMedia("(min-width: 769px)");
    const shellSelector = "[data-app-shell-sidebar-open]";
    const newChatSelector = 'button[aria-label="New chat"], a[aria-label="New chat"]';
    const nativeSelector = 'button[aria-controls="app-shell-sidebar"], button[aria-label="Toggle sidebar"], button[aria-label="Open sidebar"], button[aria-label="Close sidebar"], button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]';
    const compactAttr = "data-obsidian-compact-sidebar";
    const visibleAttr = "data-obsidian-sidebar-visible";
    const warmAttr = "data-obsidian-sidebar-warm";
    const narrowGuard = "data-obsidian-sidebar-reconciling";
    const intentAttr = "data-obsidian-sidebar-intent";
    const hostAttr = "data-obsidian-sidebar-host-managed";
    const coldClosed = 'html[' + compactAttr + '][' + visibleAttr + '="false"]:not([' + warmAttr + ']) ' + shellSelector;
    const warmClosed = 'html[' + compactAttr + '][' + warmAttr + '][' + visibleAttr + '="false"] ' + shellSelector;
    const state = {
        desired: false,
        native: null, layout: null, phase: "closed",
        resize: "idle", pending: null, sequence: 0
    };
    let warm = Boolean(keepWarm), useHost = Boolean(hostManaged), frame = 0, disposed = false, shell = null, headerButton = null;
    let closeFrame = 0, closeTimer = null, closedFrames = 0, commandTimer = null;
    let reportedOpen = null, lastSnapshot = "", inertPanel = null, previousInert = false;
    let reconcileClosed = false, layoutPending = false, layoutTimer = null, resumeFromResize = false, warmAttempted = false, failedTarget = null;
    const snapshot = () => ({
        sessionId, sequence: state.sequence, desired: state.desired, native: state.native,
        layout: state.layout, phase: state.phase, resize: state.resize,
        hidden: state.phase === "open" || state.phase === "closing"
    });
    function publish() {
        const data = snapshot();
        const signature = JSON.stringify({...data, sequence:0});
        if (signature === lastSnapshot) return;
        lastSnapshot = signature;
        ++state.sequence;
        window.console?.info("chatgpt-theme-sync:sidebar-state:" + JSON.stringify(snapshot()));
        const hidden = snapshot().hidden;
        if (reportedOpen !== hidden) {
            reportedOpen = hidden;
            window.console?.info("chatgpt-theme-sync:sidebar:" + (hidden ? "open" : "closed"));
        }
    }
    function cancelCloseWait() {
        if (closeFrame) cancelAnimationFrame(closeFrame);
        if (closeTimer !== null) window.clearTimeout?.(closeTimer);
        closeFrame = 0; closeTimer = null; closedFrames = 0;
    }
    function clearPending() {
        if (commandTimer !== null) window.clearTimeout?.(commandTimer);
        commandTimer = null; state.pending = null;
    }
    function panelVisible(el) {
        if (!el?.isConnected || !window.getComputedStyle) return false;
        const css = window.getComputedStyle(el), r = el.getBoundingClientRect();
        return css.display !== "none" && css.visibility !== "hidden" &&
            css.visibility !== "collapse" && Number(css.opacity) > 0.01 &&
            r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 &&
            r.left < window.innerWidth && r.top < window.innerHeight;
    }
    function visiblePanel() {
        const panel = document.querySelector("aside.app-shell-left-panel");
        const popover = document.querySelector("#browser-sidebar-popover");
        const content = document.querySelector("#app-shell-sidebar");
        return state.layout === "compact" ?
            panelVisible(panel || content) || panelVisible(backdrop) :
            panelVisible(popover || panel || content);
    }
    function waitForClosedPaint() {
        if (closeFrame || closeTimer !== null) return;
        const finish = () => {
            cancelCloseWait();
            if (!disposed && !state.desired) { state.phase = "closed"; publish(); }
        };
        if (!window.getComputedStyle || !window.setTimeout) { finish(); return; }
        const check = () => {
            closeFrame = 0;
            if (disposed || state.desired) { cancelCloseWait(); return; }
            closedFrames = visiblePanel() ? 0 : closedFrames + 1;
            if (closedFrames >= 2) finish();
            else closeFrame = requestAnimationFrame(check);
        };
        closeFrame = requestAnimationFrame(check);
        closeTimer = window.setTimeout(finish, 900);
    }
    function setPanelInert() {
        const panel = warm && state.layout === "compact" && !state.desired && state.native === true ?
            document.querySelector("aside.app-shell-left-panel") : null;
        if (panel === inertPanel) return;
        if (inertPanel) inertPanel.inert = previousInert;
        inertPanel = panel;
        if (panel) { previousInert = panel.inert; panel.inert = true; }
    }
    const button = document.createElement("button");
    button.id = "obsidian-chatgpt-sidebar-toggle";
    button.type = "button";
    button.setAttribute("aria-controls", "app-shell-sidebar");
    button.style.cssText = "display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:36px;height:36px;padding:0;margin:0;border:0;border-radius:10px;background:transparent;color:var(--color-text-tertiary,currentColor);cursor:pointer";
    button.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M9 5v14"/></svg>';
    const backdrop = document.createElement("div");
    backdrop.id = "obsidian-chatgpt-sidebar-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    const style = document.createElement("style");
    const scope = "html[" + compactAttr + "] " + shellSelector;
    const closed = 'html[' + compactAttr + '][' + visibleAttr + '="false"] ' + shellSelector;
    const open = 'html[' + compactAttr + '][' + visibleAttr + '="true"] ' + shellSelector;
    style.textContent = [
        '@media (min-width: 769px) {',
        scope + ' { --app-shell-left-panel-width: 0px !important; --app-shell-navigation-rail-width: 0px !important; }',
        scope + ' aside.app-shell-left-panel { position:absolute !important; inset-block:0 !important; inset-inline-start:0 !important; z-index:51 !important; width:var(--app-shell-animated-left-panel-width,260px) !important; max-width:100%; background:var(--app-color-background-surface,var(--main-surface-primary)); }',
        coldClosed + ' aside.app-shell-left-panel { width:0 !important; overflow:hidden !important; }',
        coldClosed + ' aside.app-shell-left-panel, ' + coldClosed + ' aside.app-shell-left-panel *, ' + coldClosed + ' #app-shell-sidebar, ' + coldClosed + ' #app-shell-sidebar * { visibility:hidden !important; pointer-events:none !important; }',
        // Do not invalidate every child's visibility on each warm toggle.
        // Hide only the outer composited panel; leave descendants laid out.
        warmClosed + ' aside.app-shell-left-panel { opacity:0 !important; pointer-events:none !important; }',
        'html[' + compactAttr + '][' + warmAttr + '] ' + shellSelector + ' aside.app-shell-left-panel { transition-duration:1ms !important; transition-delay:0s !important; }',
        open + ' aside.app-shell-left-panel { box-shadow:0 0 24px rgba(0,0,0,.28); }',
        '#obsidian-chatgpt-sidebar-backdrop { position:absolute; inset:0; z-index:50; background:rgba(0,0,0,.28); }',
        closed + ' #obsidian-chatgpt-sidebar-backdrop { display:none; }',
        '#obsidian-chatgpt-sidebar-toggle[data-obsidian-fallback] { position:fixed !important; inset-inline-start:8px; top:8px; z-index:52; background:var(--app-color-background-surface,var(--main-surface-primary)) !important; }',
        '#obsidian-chatgpt-sidebar-toggle:hover { background:var(--app-color-background-button-tertiary-hover,rgba(128,128,128,.15)) !important; }',
        '}',
        '@media (max-width: 768px) {',
        'html[' + intentAttr + '="false"] #browser-sidebar-popover, html[' + intentAttr + '="false"] aside.app-shell-left-panel, html[' + intentAttr + '="false"] #app-shell-sidebar { visibility:hidden !important; pointer-events:none !important; }',
        '}',
        // The host button is the only opener. Native close controls inside
        // the actual sidebar remain available. Hidden buttons can still be
        // invoked programmatically by the native-state adapter.
        'html[' + hostAttr + '] #obsidian-chatgpt-sidebar-toggle { display:none !important; }',
        'html[' + hostAttr + '][' + visibleAttr + '="false"] :is(' + nativeSelector + '):not(aside *, #app-shell-sidebar *, #browser-sidebar-popover *) { display:none !important; }',
    ].join("\n");
    document.head.appendChild(style);


    const isNative = el => el && el !== button && !el.disabled;
    const native = target => {
        const candidates = Array.from(document.querySelectorAll(nativeSelector)).filter(isNative);
        const matchesDirection = el => {
            const label = el.getAttribute("aria-label") || "";
            return target ? /^(Open|Expand) sidebar$/i.test(label) :
                /^(Close|Collapse) sidebar$/i.test(label);
        };
        const compatible = candidates.filter(el => {
            const label = el.getAttribute("aria-label") || "";
            return !/^(Open|Expand|Close|Collapse) sidebar$/i.test(label) || matchesDirection(el);
        });
        const visible = el => el.getClientRects().length > 0 &&
            (!window.getComputedStyle || window.getComputedStyle(el).visibility !== "hidden");
        return compatible.find(el => matchesDirection(el) && visible(el)) ||
            compatible.find(visible) || compatible.find(matchesDirection) || compatible[0];
    };
    function observeNative() {
        const value = shell?.getAttribute("data-app-shell-sidebar-open");
        return value === "true" ? true : value === "false" ? false : null;
    }
    function render() {
        const intent = String(state.desired === true);
        if (root.getAttribute(intentAttr) !== intent) root.setAttribute(intentAttr, intent);
        if (useHost) {
            if (!root.hasAttribute(hostAttr)) root.setAttribute(hostAttr, "");
        } else root.removeAttribute(hostAttr);
        // Keep the desktop attributes across the breakpoint. Desktop CSS
        // already has a media query; retaining these prevents a one-frame
        // native panel flash when the window grows again.
        if (!root.hasAttribute(compactAttr)) root.setAttribute(compactAttr, "");
        const expanded = String(state.desired === true && state.native === true);
        if (root.getAttribute(visibleAttr) !== expanded) root.setAttribute(visibleAttr, expanded);
        if (warm && state.native === true) {
            if (!root.hasAttribute(warmAttr)) root.setAttribute(warmAttr, "");
        } else root.removeAttribute(warmAttr);
        if (state.layout === "compact") {
            if (button.getAttribute("aria-expanded") !== expanded) button.setAttribute("aria-expanded", expanded);
            const label = state.desired ? "Collapse sidebar" : "Show sidebar";
            if (button.title !== label) {
                button.title = label; button.setAttribute("aria-label", label);
            }
        } else {
            button.remove(); backdrop.remove(); headerButton = null;
        }
        if (state.layout === "native" && state.desired === false && state.native === true &&
            (layoutPending || state.resize !== "idle" || state.pending || reconcileClosed)) {
            if (!root.hasAttribute(narrowGuard)) root.setAttribute(narrowGuard, "");
        } else root.removeAttribute(narrowGuard);
        setPanelInert();
        if (state.desired) {
            cancelCloseWait();
            state.phase = state.native === true ? "open" : "opening";
        } else if (state.phase === "open" || state.phase === "closing") {
            state.phase = "closing"; waitForClosedPaint();
        } else state.phase = "closed";
        publish();
    }
    function commandFailed(target) {
        clearPending();
        state.native = observeNative();
        if (state.native !== target) {
            failedTarget = target;
            if (target && state.desired && state.resize === "idle" && !layoutPending)
                state.desired = false;
        }
        render();
    }
    function issueNative(target) {
        if (!shell || state.native === null || state.native === target || state.pending || failedTarget === target ||
            state.resize !== "idle" || layoutPending) return false;
        const control = native(target);
        if (!control) {
            // Hydration can temporarily remove the native toggle. Allow
            // mutations to find it, but do not leave the host button hidden
            // forever if it never appears.
            if (commandTimer === null && window.setTimeout)
                commandTimer = window.setTimeout(() => commandFailed(target), 750);
            return false;
        }
        clearPending();
        state.pending = {target, shell};
        if (window.setTimeout)
            commandTimer = window.setTimeout(() => commandFailed(target), 750);
        control.click();
        return true;
    }
    function reconcile() {
        if (state.native === null) return;
        if (state.desired) issueNative(true);
        else if (state.layout === "native" || (!warm && reconcileClosed)) issueNative(false);
        else if (warm && state.layout === "compact" && !state.native && !warmAttempted &&
                 state.resize === "idle" && !layoutPending && !state.pending) {
            // Eagerly initialize the desktop panel behind the closed CSS.
            // This is internal native state only; it must not hide the host
            // button or change user intent. Do not warm a mobile modal.
            if (issueNative(true)) warmAttempted = true;
        }
        if (state.native === state.desired && !state.pending && !(warm && state.layout === "compact" && !state.desired))
            clearPending();
        if (state.native === false && !state.pending) reconcileClosed = false;
    }
    function setOpen(value) {
        if (disposed) return false;
        if (!shell?.isConnected) sync();
        if (!shell) return false;
        if (!state.pending) clearPending();
        failedTarget = null;
        state.desired = Boolean(value);
        if (!state.desired) reconcileClosed = true;
        else warmAttempted = true;
        render();
        reconcile();
        return !!shell;
    }
    function toggle() { return setOpen(!state.desired); }
    const onNativeClick = event => {
        if (!event.isTrusted || !isNative(event.target?.closest?.(nativeSelector))) return;
        // Route native user input through the same intent path. The
        // synthetic click issued by the adapter is not trusted.
        event.preventDefault(); event.stopImmediatePropagation();
        if (!useHost || state.desired) setOpen(!state.desired);
    };
    document.addEventListener("click", onNativeClick, true);
    button.addEventListener("click", toggle);
    backdrop.addEventListener("click", () => setOpen(false));
    const onKey = event => {
        if (event.key === "Escape" && state.desired &&
            !document.querySelector('[role="dialog"][data-state="open"]')) {
            event.preventDefault(); event.stopImmediatePropagation();
            setOpen(false);
        }
    };
    document.addEventListener("keydown", onKey, true);
    function sync() {
        frame = 0;
        if (disposed) return;
        const layout = desktop.matches ? "compact" : "native";
        const modeChanged = state.layout !== layout;
        const nextShell = document.querySelector(shellSelector);
        const shellChanged = shell !== nextShell;
        if (shellChanged) { clearPending(); shell = nextShell; headerButton = null; warmAttempted = false; failedTarget = null; }
        if (modeChanged) { warmAttempted = false; failedTarget = null; }
        const previousNative = state.native;
        state.native = observeNative();
        state.layout = layout;
        const acknowledged = state.pending && state.native === state.pending.target;
        if (acknowledged) { clearPending(); failedTarget = null; }
        // A breakpoint or a replacement shell is an observation, not a
        // user action. Keep intent and reconcile once resizing settles.
        if (!modeChanged && !shellChanged && !acknowledged && !state.pending &&
            state.resize === "idle" && !layoutPending && !resumeFromResize && previousNative !== null &&
            state.native !== null && previousNative !== state.native) {
            // Native OPEN is never a user request: responsive hydration
            // and desktop prewarming can both restore it. Only a genuine
            // native dismissal of an already-open panel can close intent.
            if (previousNative && !state.native && state.desired &&
                (layout === "native" || !warm)) state.desired = false;
        }
        if (state.resize === "idle") resumeFromResize = false;
        if (modeChanged && layout === "native") reconcileClosed = state.desired === false;
        render();
        reconcile();
        if (!shell || layout !== "compact") return;
        if (useHost) {
            if (button.parentElement) button.remove();
            headerButton = null;
            if (backdrop.parentElement !== shell) shell.appendChild(backdrop);
            return;
        }
        const newChat = Array.from(document.querySelectorAll(newChatSelector))
            .find(el => !el.closest("aside, nav, [role=dialog]") && el.parentElement?.parentElement);
        if (newChat) {
            headerButton = newChat;
            button.removeAttribute("data-obsidian-fallback");
            const wrapper = newChat.parentElement;
            if (button.parentElement !== wrapper.parentElement) wrapper.parentElement.insertBefore(button, wrapper);
        } else {
            headerButton = null;
            // A missing/hover-only header control must not remove the
            // sidebar toggle or disable the compact layout.
            if (!button.hasAttribute("data-obsidian-fallback")) button.setAttribute("data-obsidian-fallback", "");
            if (button.parentElement !== shell) shell.appendChild(button);
        }
        if (backdrop.parentElement !== shell) shell.appendChild(backdrop);
    }

    function schedule() {
        if (!disposed && !frame) frame = requestAnimationFrame(sync);
    }
    function needsNativeControl() {
        if (!shell || state.native === null || state.pending) return true;
        if (state.desired) return !state.native;
        if (state.layout === "native" || (!warm && reconcileClosed)) return state.native;
        return warm && !state.native && !warmAttempted;
    }
    const observer = new MutationObserver(records => {
        if (!shell?.isConnected || (state.layout === "compact" &&
            ((!useHost && !button.isConnected) || !backdrop.isConnected ||
            (headerButton && (!headerButton.isConnected || button.parentElement !== headerButton.parentElement?.parentElement)))) ||
            records.some(record => record.type === "attributes" &&
                (record.attributeName === "data-app-shell-sidebar-open" || record.target === shell ||
                 (needsNativeControl() && record.target.matches?.(nativeSelector)) ||
                 (!useHost && !headerButton && record.target.matches?.(newChatSelector))))) {
            schedule(); return;
        }
        const findHeader = !useHost && state.layout === "compact" && !headerButton;
        const findNative = needsNativeControl();
        if (findHeader || findNative) {
            const controls = findHeader && findNative ? newChatSelector + ", " + nativeSelector :
                findHeader ? newChatSelector : nativeSelector;
            for (const record of records) for (const node of record.addedNodes || []) {
                if (node.nodeType === 1 && (node.matches(controls) || node.querySelector(controls))) {
                    schedule(); return;
                }
            }
        }
    });
    observer.observe(root, {childList:true, subtree:true, attributes:true,
        attributeFilter:["data-app-shell-sidebar-open","aria-label","aria-controls","disabled"]});
    function onMediaChange() {
        // Keep intent across native responsive rehydration. The CSS
        // strategy changes immediately; native commands wait for quiet.
        layoutPending = true;
        if (layoutTimer !== null) window.clearTimeout?.(layoutTimer);
        if (window.setTimeout) layoutTimer = window.setTimeout(() => {
            layoutTimer = null; layoutPending = false; resumeFromResize = true; schedule();
        }, 96);
        else layoutPending = false;
        schedule();
    }
    desktop.addEventListener("change", onMediaChange);
    window[key] = {
        version: 3, sessionId, refresh: schedule,
        configure(value, host = useHost) {
            if (warm !== Boolean(value)) { warmAttempted = false; failedTarget = null; }
            warm = Boolean(value); useHost = Boolean(host);
            if (!warm) reconcileClosed = false;
            schedule();
        },
        setResizePhase(phase) {
            if (disposed || state.resize === phase) return;
            if (phase === "idle") resumeFromResize = true;
            state.resize = phase;
            schedule();
        },
        setOpen, toggle, snapshot,
        sidebarOpen() { return state.desired === true; },
        hostButtonHidden() { return snapshot().hidden; },
        dispose() {
            disposed = true; clearPending(); cancelCloseWait(); observer.disconnect();
            desktop.removeEventListener("change", onMediaChange);
            if (layoutTimer !== null) window.clearTimeout?.(layoutTimer);
            root.removeAttribute(narrowGuard);
            root.removeAttribute(intentAttr); root.removeAttribute(hostAttr);
            document.removeEventListener("keydown", onKey, true);
            document.removeEventListener("click", onNativeClick, true);
            if (frame) cancelAnimationFrame(frame);
            root.removeAttribute(compactAttr); root.removeAttribute(visibleAttr); root.removeAttribute(warmAttr);
            if (inertPanel) inertPanel.inert = previousInert;
            button.remove(); backdrop.remove(); style.remove();
            delete window[key];
        }
    };
    sync();
    return true;
}

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

const RESIZE_HANDLE = ".workspace-leaf-resize-handle, .workspace-split-resize-handle, .workspace-resize-handle";

const SIDEBAR_TOGGLE = '.sidebar-toggle-button, [aria-label="Toggle left sidebar"], [aria-label="Toggle right sidebar"], [aria-label="Collapse left sidebar"], [aria-label="Collapse right sidebar"], [aria-label="Expand left sidebar"], [aria-label="Expand right sidebar"]';
// Capture-phase handlers run before most workspace actions. Match all
// workspace splits, not just the right sidebar. Unknown commands still
// use the ordinary resize-burst fallback.
const PANE_ACTION = '.workspace-tab-header-inner-close-button, .workspace-tab-header-close-button, .workspace-tab-header-new-tab, .workspace-tab-header-tab-list, .workspace-leaf-close, .workspace-split-close, .workspace .view-action[aria-label^="Close"], .workspace .clickable-icon[aria-label^="Close tab"], .workspace .clickable-icon[aria-label^="Close pane"], .workspace .clickable-icon[aria-label^="Split"]';
function isWorkspaceLayoutAction(target) {
    if (target?.closest?.(SIDEBAR_TOGGLE + ", " + PANE_ACTION)) return true;
    const item = target?.closest?.(".menu-item, .prompt .suggestion-item");
    if (!item) return false;
    const label = item.querySelector?.(".menu-item-title, .suggestion-title")?.textContent || item.textContent || "";
    return /^(?:workspace:\s*)?(?:close (?:current |active |other |all )?(?:tab|pane|split|tabs|panes)(?:\b|$)|split (?:right|left|up|down|horizontally|vertically)\b|(?:toggle|collapse|expand) (?:left|right) sidebar\b)/i.test(label.trim());
}
const RESIZE_BURST_MS = 60;
const RESIZE_QUIET_MS = 48;
const ACTION_QUIET_MS = 64;
const RESIZE_MAX_MS = 1200;
const RELEASE_MAX_MS = 220;
const CAPTURE_MAX_MS = 120;
const GUEST_REVEAL_MAX_MS = 350;

// The guest must reach the new viewport and render across consecutive frames.
// This is a layout-readiness signal, not a GPU presentation guarantee.
function waitForGuestViewport(width, height, hostDpr) {
    return new Promise(resolve => {
        let frame = 0, matches = 0, done = false;
        const finish = ready => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (frame) cancelAnimationFrame(frame);
            resolve({ready, width:innerWidth, height:innerHeight});
        };
        const timer = setTimeout(() => finish(false), 260);
        const check = () => {
            const scale = hostDpr > 0 && devicePixelRatio > 0 ? hostDpr / devicePixelRatio : 1;
            const match = Math.abs(innerWidth-width*scale) <= 2 && Math.abs(innerHeight-height*scale) <= 2;
            matches = match ? matches+1 : 0;
            if (matches >= 3) finish(true);
            else frame = requestAnimationFrame(check);
        };
        frame = requestAnimationFrame(check);
    });
}

// Keep the live guest at a fixed size during a host resize. The host remains
// responsive; the guest is clipped (or temporarily exposes blank space).
// On release, retain the centered viewport until host geometry is stable,
// then restore native layout exactly once.
class SmoothResizeController {
    constructor(view, onPhase = () => {}) {
        this.view = view;
        this.onPhase = onPhase;
        this.phase = "idle";
        this.parent = view.parentElement;
        this.win = view.ownerDocument.defaultView;
        this.saved = [];
        this.dragIntent = false;
        this.pointerId = null;
        this.trace = [];
        this.disposed = false;
        this.unsupported = false;
        this.timer = null;
        this.releaseFrame = null;
        this.releaseTimer = null;
        this.captureTimer = null;
        this.releaseStage = null;
        this.capturePending = false;
        this.hostSettled = false;
        this.snapshot = null;
        this.preparedSnapshot = null;
        this.releaseToken = 0;
        this.readyRevision = 0;
        this.autoAction = false;
        this.autoStarted = null;
        this.lastChange = null;
        this.ignoreUntil = 0;
        this.hostSize = this.readHost();
        this.onClick = event => {
            if (!this.dragging && isWorkspaceLayoutAction(event.target)) this.beginLayoutAction();
        };
        this.onKey = event => {
            if (event.repeat || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
            if (String(event.key).toLowerCase() === "w" && !this.dragging) this.beginLayoutAction();
        };
        this.onDown = event => {
            // Middle-click closes tabs in Obsidian. Some controls act on
            // pointerdown instead of click, so lock before either event.
            if (event.button === 1 && event.target?.closest?.(".workspace-tab-header")) {
                if (!this.dragging) this.beginLayoutAction();
                return;
            }
            if (event.button !== 0 || event.isPrimary === false) return;
            if (!event.target?.closest?.(RESIZE_HANDLE)) {
                this.dragIntent = false;
                if (this.dragging) this.commit("new-click");
                if (isWorkspaceLayoutAction(event.target)) this.beginLayoutAction();
                return;
            }
            this.dragIntent = true;
            this.pointerId = event.pointerId ?? null;
            this.beginDrag();
        };
        this.onMove = event => {
            if (!this.dragIntent && !this.dragging) return;
            if (this.pointerId !== null && event.pointerId != null && event.pointerId !== this.pointerId) return;
            if (!(event.buttons & 1)) { this.onUp(); return; }
            if (!this.dragging) this.beginDrag();
            // A held pointer is not a completed gesture.
        };
        this.onUp = event => {
            if (this.pointerId !== null && event?.pointerId != null && event.pointerId !== this.pointerId) return;
            if (event?.isPrimary === false || (typeof event?.buttons === "number" && (event.buttons & 1))) return;
            this.pointerId = null;
            this.dragIntent = false;
            if (this.dragging) this.commit("pointer-release");
        };
        // Lost capture can occur during a held drag (e.g. DOM reparenting).
        // Do not treat it as a release. Button-up motion or actual pointerup
        // remains authoritative, even when the original handle disappeared.
        this.onLostCapture = () => {};
        this.onCancel = event => {
            if (this.pointerId !== null && event?.pointerId != null && event.pointerId !== this.pointerId) return;
            this.onUp({pointerId:event?.pointerId, isPrimary:event?.isPrimary, buttons:0});
        };
        this.onBlur = event => {
            // Capture-phase blur also sees individual controls losing focus.
            // Only a real window blur terminates the held gesture.
            if (event?.target && event.target !== this.win) return;
            this.pointerId = null;
            this.dragIntent = false;
            if (this.dragging) this.commit("window-blur");
        };
        this.listeners = [
            ["click", this.onClick], ["keydown", this.onKey],
            ["pointerdown", this.onDown], ["pointermove", this.onMove],
            ["pointerup", this.onUp], ["pointercancel", this.onCancel],
            ["lostpointercapture", this.onLostCapture], ["mouseup", this.onUp], ["blur", this.onBlur],
        ];
        for (const [type, fn] of this.listeners) this.win.addEventListener(type, fn, true);
        this.observer = this.win.ResizeObserver ? new this.win.ResizeObserver(() => this.measureHost()) : null;
        this.observer?.observe(this.parent);
    }

    get locked() { return this.phase !== "idle"; }
    get dragging() { return this.phase === "dragging"; }
    get committing() { return this.phase === "settling"; }
    setPhase(phase) {
        if (this.phase === phase) return;
        this.phase = phase;
        this.onPhase(phase);
    }
    now() { return this.win.performance.now(); }

    note(event, details = {}) {
        this.trace.push({t: Math.round(this.now()), event, ...details});
        if (this.trace.length > 40) this.trace.shift();
    }

    beginLayoutAction() {
        if (this.disposed || this.dragging) return;
        // Pointerdown and click are often the same action. Do not recapture.
        if (this.locked && this.autoAction && !this.committing) {
            this.arm(80);
            return;
        }
        if (!this.lock(this.sample())) return;
        this.autoAction = true;
        this.autoStarted = this.now();
        this.note("prelock-layout-action");
        this.arm(80);
    }

    beginDrag() {
        if (!this.lock(this.sample())) return;
        this.autoAction = false;
        this.autoStarted = null;
        if (this.timer !== null) this.win.clearTimeout(this.timer);
        this.timer = null;
        // Keep pointer hit-testing in the host until the gesture commits.
        if (!this.saved.some(e => e.element === this.view && e.name === "pointer-events"))
            this.setStyle(this.view, "pointer-events", "none");
        this.setPhase("dragging");
    }

    readHost() {
        if (!this.view.isConnected || this.view.parentElement !== this.parent) return null;
        const r = this.parent.getBoundingClientRect();
        return r.width >= 2 && r.height >= 2 ? { width: r.width, height: r.height, left: r.left, top: r.top } : null;
    }

    measureHost() {
        if (this.disposed) return;
        const previous = this.hostSize, current = this.readHost();
        this.hostSize = current;
        if (!current) { this.finish(); return; }
        if (!previous || (Math.abs(previous.width - current.width) < 0.5 &&
            Math.abs(previous.height - current.height) < 0.5)) return;
        if (this.committing) {
            this.note("release-host-changed", current);
            if (this.releaseStage === "guest") this.scheduleGuestReveal();
            else this.waitForStableFrames();
            return;
        }
        if (this.dragging) return;
        const now = this.now();
        if (this.locked) {
            if (this.autoStarted !== null && now - this.autoStarted >= RESIZE_MAX_MS) this.commit();
            else this.arm(this.autoAction ? ACTION_QUIET_MS : RESIZE_QUIET_MS);
            return;
        }
        if (now < this.ignoreUntil || this.unsupported) return;
        // One isolated change is immediate. Closely spaced changes indicate
        // a sidebar animation or another continuous layout change.
        const last = this.lastChange;
        this.lastChange = now;
        if (last === null || now - last > RESIZE_BURST_MS) return;
        // Lock the current size rather than snapping back to a prior frame.
        if (this.lock(this.sample())) {
            this.autoStarted = now;
            this.arm(RESIZE_QUIET_MS);
        }
    }

    sample() {
        const p = this.parent, v = this.view;
        if (!v.isConnected || v.parentElement !== p) return null;
        const rect = v.getBoundingClientRect(), host = p.getBoundingClientRect();
        if (host.width < 2 || host.height < 2 || rect.width < 2 || rect.height < 2) return null;
        return {
            width: rect.width, height: rect.height,
            hostWidth: host.width, hostHeight: host.height,
            left: rect.left - host.left - p.clientLeft + p.scrollLeft,
            top: rect.top - host.top - p.clientTop + p.scrollTop,
            fillsHost: Math.abs(rect.width - p.clientWidth) <= 4 &&
                Math.abs(rect.height - p.clientHeight) <= 4,
        };
    }

    setStyle(element, name, value) {
        const style = element.style;
        const entry = { element, name, old: style.getPropertyValue(name),
            priority: style.getPropertyPriority(name), applied: null };
        style.setProperty(name, value, "important");
        entry.applied = style.getPropertyValue(name);
        this.saved.push(entry);
    }

    lock(size) {
        if (this.disposed || this.unsupported) return false;
        if (this.committing) {
            if (this.releaseStage === "guest") {
                // Native viewport has already resized behind the cover.
                this.finish("new-gesture");
                size = this.sample();
            } else {
                // Keep the original fixed viewport for a resumed drag.
                this.cancelRelease();
                this.setPhase("locked");
                return true;
            }
        }
        if (this.locked) return true;
        const current = this.sample();
        // Do not take over a shared or unexpected browser layout.
        if (!size?.fillsHost || !current?.fillsHost) return false;
        const parent = this.parent, view = this.view;
        this.setPhase("locked");
        if (this.win.getComputedStyle(parent).position === "static") {
            this.setStyle(parent, "position", "relative");
        }
        // Hidden overflow can still scroll on focus. Clip where supported.
        const clip = !parent.scrollLeft && !parent.scrollTop &&
            this.win.CSS?.supports?.("overflow", "clip") ? "clip" : "hidden";
        this.setStyle(parent, "overflow-x", clip);
        this.setStyle(parent, "overflow-y", clip);
        // Center the locked viewport in the changing host instead of
        // anchoring its left edge. Preserve the original small inset at lock
        // time, and let CSS resolve the percentage without JS resize writes.
        const centerOffset = current.left - parent.clientWidth / 2;
        const centeredLeft = "calc(50% " + (centerOffset < 0 ? "- " : "+ ") +
            Math.abs(centerOffset) + "px)";
        const rules = {
            position: "absolute", left: centeredLeft, top: current.top + "px",
            right: "auto", bottom: "auto", "box-sizing": "border-box",
            "margin-top": "0px", "margin-right": "0px", "margin-bottom": "0px", "margin-left": "0px",
            width: size.width + "px", height: size.height + "px",
            "min-width": "0px", "min-height": "0px",
            "max-width": "none", "max-height": "none",
            // The frozen viewport edge is inside the pane while expanding.
            // Suppress only decorative edges; leave border widths unchanged
            // so the guest viewport geometry is not altered by the lock.
            "border-left-color": "transparent", "border-right-color": "transparent",
            "outline-color": "transparent", "box-shadow": "none",
            // A guest/compositor edge can survive transparent host borders.
            // Crop two CSS pixels on both sides without resizing the guest.
            // The matching host canvas paints the tiny exposed strip.
            "clip-path": "inset(0 2px)",
        };
        for (const [name, value] of Object.entries(rules)) this.setStyle(view, name, value);
        // Absolute positioning must not collapse an intrinsically sized host.
        const after = parent.getBoundingClientRect();
        const guest = view.getBoundingClientRect();
        if (Math.abs(after.width - current.hostWidth) > 2 ||
            Math.abs(after.height - current.hostHeight) > 2 ||
            Math.abs(guest.width - size.width) > 2 ||
            Math.abs(guest.height - size.height) > 2) {
            this.unsupported = true;
            this.note("unsupported-host");
            this.finish();
            return false;
        }
        this.note("lock", {width: size.width, height: size.height, clip, host:this.readHost(), guestLeft:guest.left});
        return true;
    }

    arm(delay) {
        if (this.timer !== null) this.win.clearTimeout(this.timer);
        this.timer = this.win.setTimeout(() => { this.timer = null; if (!this.dragging) this.commit("resize-quiet"); }, delay);
    }

    commit(reason = "release") {
        if (!this.locked || this.committing) return;
        this.note("commit", {reason, host: this.readHost()});
        if (this.disposed || !this.view.isConnected || this.view.parentElement !== this.parent ||
            typeof this.win.requestAnimationFrame !== "function") {
            this.finish();
            return;
        }
        if (this.timer !== null) this.win.clearTimeout(this.timer);
        this.timer = null;
        this.setPhase("settling");
        const token = ++this.releaseToken;
        this.releaseStage = "host";
        this.hostSettled = false;
        // Prepare one frozen frame in parallel with the host settle, never
        // during the drag. Skip no-op resizes and unsupported guests.
        const rect = this.view.getBoundingClientRect();
        const changed = Math.abs(rect.width-this.parent.clientWidth) > 4 ||
            Math.abs(rect.height-this.parent.clientHeight) > 4;
        if (changed && this.canFreeze()) this.startCapture(token);
        this.waitForStableFrames();
        this.releaseTimer = this.win.setTimeout(() => {
            if (!this.validRelease(token)) return;
            if (this.releaseStage === "cover") this.handoffCovered(token);
            else {
                this.note("native-layout-restored", {host:this.readHost(), reason:"release-timeout"});
                this.finish("release-timeout");
            }
        }, RELEASE_MAX_MS);
    }

    validRelease(token) {
        return !this.disposed && this.committing && this.releaseToken === token &&
            this.view.isConnected && this.view.parentElement === this.parent;
    }

    canFreeze() {
        try {
            return typeof this.view.capturePage === "function" &&
                typeof this.view.executeJavaScript === "function" &&
                typeof this.view.ownerDocument.createElement === "function" &&
                isChatGPT(this.view.getURL());
        } catch { return false; }
    }

    async prepareSnapshot() {
        const geometry = {};
        for (const name of ["left","top","width","height","clip-path"])
            geometry[name] = this.view.style.getPropertyValue(name);
        const image = await this.view.capturePage();
        if (!image || image.isEmpty?.() || typeof image.toDataURL !== "function")
            throw new Error("empty capture");
        const url = image.toDataURL();
        if (!url.startsWith("data:image/")) throw new Error("invalid capture");
        const doc = this.view.ownerDocument;
        const layer = doc.createElement("div");
        const img = doc.createElement("img");
        layer.className = "chatgpt-theme-sync-frozen-release";
        layer.setAttribute("aria-hidden","true");
        layer.style.cssText = "position:absolute;inset:0;overflow:hidden;z-index:90;pointer-events:auto;user-select:none;background:var(--background-primary);";
        const background = this.win.getComputedStyle(this.view).backgroundColor;
        if (background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)")
            layer.style.backgroundColor = background;
        img.alt = "";
        img.draggable = false;
        img.style.cssText = "position:absolute;display:block;max-width:none;max-height:none;margin:0;padding:0;border:0;object-fit:fill;pointer-events:none;";
        for (const [name,value] of Object.entries(geometry)) img.style.setProperty(name,value);
        img.src = url;
        layer.appendChild(img);
        if (typeof img.decode !== "function") throw new Error("decode unavailable");
        await img.decode();
        return layer;
    }

    startCapture(token) {
        this.capturePending = true;
        const complete = layer => {
            if (!this.validRelease(token) || !this.capturePending || this.releaseStage !== "host") return;
            this.capturePending = false;
            if (this.captureTimer !== null) this.win.clearTimeout(this.captureTimer);
            this.captureTimer = null;
            this.preparedSnapshot = layer;
            this.note(layer ? "snapshot-ready" : "snapshot-unavailable");
            if (this.hostSettled) this.waitForStableFrames();
        };
        this.captureTimer = this.win.setTimeout(() => complete(null), CAPTURE_MAX_MS);
        void this.prepareSnapshot().then(complete, () => complete(null));
    }

    applyFinalViewport(token, reason) {
        if (!this.validRelease(token)) return;
        if (this.releaseStage === "cover") {
            this.handoffCovered(token);
            return;
        }
        if (this.releaseStage !== "host") return;
        this.hostSettled = true;
        if (this.capturePending) return;
        if (!this.preparedSnapshot) {
            this.note("native-layout-restored", {host:this.readHost(), reason});
            this.finish(reason);
            return;
        }
        // Paint the old centered layout over the still-locked live guest.
        // Only after two stable host frames do we resize the guest behind it.
        this.snapshot = this.preparedSnapshot;
        this.preparedSnapshot = null;
        this.parent.appendChild(this.snapshot);
        this.releaseStage = "cover";
        this.note("snapshot-visible");
        this.waitForStableFrames();
    }

    handoffCovered(token) {
        if (!this.validRelease(token) || this.releaseStage !== "cover") return;
        if (this.releaseTimer !== null) this.win.clearTimeout(this.releaseTimer);
        if (this.releaseFrame !== null) this.win.cancelAnimationFrame(this.releaseFrame);
        this.releaseFrame = null;
        this.releaseStage = "guest";
        // Restore the original native geometry exactly once, behind the cover.
        // Retain only our positioning context until the cover is removed.
        const keep = [];
        for (const entry of this.saved.slice().reverse()) {
            if (entry.element === this.parent && entry.name === "position") keep.push(entry);
            else this.restoreEntry(entry);
        }
        this.saved = keep;
        this.note("native-layout-restored", {host:this.readHost(), reason:"covered"});
        this.releaseTimer = this.win.setTimeout(() => {
            if (this.validRelease(token)) this.finish("guest-reveal-timeout");
        }, GUEST_REVEAL_MAX_MS);
        this.scheduleGuestReveal();
    }

    scheduleGuestReveal() {
        if (this.releaseStage !== "guest") return;
        const token = this.releaseToken, revision = ++this.readyRevision;
        if (this.releaseFrame !== null) this.win.cancelAnimationFrame(this.releaseFrame);
        this.releaseFrame = this.win.requestAnimationFrame(() => {
            this.releaseFrame = null;
            void this.revealWhenReady(token, revision);
        });
    }

    async revealWhenReady(token, revision) {
        const valid = () => this.validRelease(token) && this.releaseStage === "guest" && revision === this.readyRevision;
        if (!valid()) return;
        const rect = this.view.getBoundingClientRect(), host = this.readHost();
        const sameGeometry = () => {
            const r = this.view.getBoundingClientRect(), h = this.readHost();
            return host && h && ["width","height","left","top"].every(k => Math.abs(h[k]-host[k]) < 0.5) &&
                ["width","height","left","top"].every(k => Math.abs(r[k]-rect[k]) < 0.5);
        };
        try {
            if (!this.canFreeze()) { this.finish("navigation"); return; }
            const args = [rect.width, rect.height, this.win.devicePixelRatio || 1];
            const result = await this.view.executeJavaScript("(" + waitForGuestViewport.toString() + ")(" + args.join(",") + ")");
            if (!valid()) return;
            if (!sameGeometry()) { this.scheduleGuestReveal(); return; }
            if (result?.ready !== true) return;
            this.releaseFrame = this.win.requestAnimationFrame(() => {
                this.releaseFrame = null;
                if (!valid()) return;
                if (!sameGeometry()) this.scheduleGuestReveal();
                else this.finish("guest-ready");
            });
        } catch {
            if (valid()) this.note("guest-readiness-unavailable");
        }
    }

    waitForStableFrames() {
        this.hostSettled = false;
        const token = this.releaseToken, revision = ++this.readyRevision;
        if (this.releaseFrame !== null) this.win.cancelAnimationFrame(this.releaseFrame);
        let previous = this.readHost(), stable = 0;
        const frame = () => {
            this.releaseFrame = null;
            if (!this.validRelease(token) || revision !== this.readyRevision) return;
            const current = this.readHost();
            if (!current) { this.finish("host-unavailable"); return; }
            if (previous && Math.abs(previous.width-current.width) < 0.5 &&
                Math.abs(previous.height-current.height) < 0.5 &&
                Math.abs(previous.left-current.left) < 0.5 && Math.abs(previous.top-current.top) < 0.5) ++stable;
            else stable = 0;
            previous = current;
            if (stable >= 2) this.applyFinalViewport(token, "stable-frames");
            else this.releaseFrame = this.win.requestAnimationFrame(frame);
        };
        this.releaseFrame = this.win.requestAnimationFrame(frame);
    }

    cancelRelease() {
        ++this.releaseToken;
        ++this.readyRevision;
        if (this.releaseFrame !== null) this.win.cancelAnimationFrame(this.releaseFrame);
        if (this.releaseTimer !== null) this.win.clearTimeout(this.releaseTimer);
        this.releaseFrame = this.releaseTimer = null;
        if (this.captureTimer !== null) this.win.clearTimeout(this.captureTimer);
        this.captureTimer = null;
        this.capturePending = false;
        this.hostSettled = false;
        this.releaseStage = null;
        this.snapshot?.remove();
        this.snapshot = null;
        this.preparedSnapshot = null;
    }

    restoreEntry({element, name, old, priority, applied}) {
        const style = element.style;
        if (style.getPropertyValue(name) !== applied || style.getPropertyPriority(name) !== "important") return;
        if (old) style.setProperty(name, old, priority);
        else style.removeProperty(name);
    }

    restoreLayout() {
        for (const entry of this.saved.reverse()) this.restoreEntry(entry);
        this.saved = [];
    }

    finish(reason = "cleanup") {
        this.cancelRelease();
        if (this.timer !== null) this.win.clearTimeout(this.timer);
        this.timer = null;
        if (this.locked) {
            this.note("finish", {reason, host: this.readHost()});
            this.ignoreUntil = this.now() + RESIZE_BURST_MS;
        }
        this.autoStarted = null;
        this.autoAction = false;
        this.lastChange = null;
        this.restoreLayout();
        this.setPhase("idle");
        // Do not force a synchronous layout on release. Let Obsidian and
        // Chromium commit the final pane geometry in their normal paint.
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.dragIntent = false;
        this.observer?.disconnect();
        for (const [type, fn] of this.listeners) this.win.removeEventListener(type, fn, true);
        this.finish();
    }
}

// Paint the embedder's real surfaces, not a screenshot or an overlay. Keep
// the original inline declarations so other sites and plugin unload are safe.
class WebviewBackground {
    constructor(view, palette) {
        this.view = view;
        this.parent = view.parentElement;
        this.palette = palette;
        this.saved = [];
        for (const element of [this.parent, view]) {
            if (!element?.style) continue;
            const style = element.style;
            for (const [name, value] of [["background-color", palette.primary], ["color-scheme", palette.mode]]) {
                const entry = { element, name, old: style.getPropertyValue(name),
                    priority: style.getPropertyPriority(name) };
                style.setProperty(name, value, "important");
                entry.applied = style.getPropertyValue(name);
                this.saved.push(entry);
            }
        }
    }

    dispose() {
        for (const {element, name, old, priority, applied} of this.saved.reverse()) {
            const style = element.style;
            if (style.getPropertyValue(name) !== applied || style.getPropertyPriority(name) !== "important") continue;
            if (old) style.setProperty(name, old, priority);
            else style.removeProperty(name);
        }
        this.saved = [];
    }
}

// Reserve space outside the guest, on the Obsidian pane itself. The guest
// viewport is genuinely shorter; no dependency on ChatGPT's private DOM.
// Prefer the outer pane so the immediate webview resize host stays intact.
class WebviewBottomClearance {
    constructor(view, pane) {
        this.view = view;
        this.pane = pane;
        this.saved = [];
        const style = pane.style;
        for (const [name, value] of [["box-sizing", "border-box"], ["padding-bottom", "12px"]]) {
            const entry = {name, old:style.getPropertyValue(name), priority:style.getPropertyPriority(name)};
            style.setProperty(name, value, "important");
            entry.applied = style.getPropertyValue(name);
            this.saved.push(entry);
        }
    }
    dispose() {
        const style = this.pane.style;
        for (const {name, old, priority, applied} of this.saved.reverse()) {
            if (style.getPropertyValue(name) !== applied || style.getPropertyPriority(name) !== "important") continue;
            if (old) style.setProperty(name, old, priority);
            else style.removeProperty(name);
        }
        this.saved = [];
    }
}

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

// Native host overlay, not a guest webview control. It moves with the pane's
// top-left edge even while SmoothResizeController locks the guest dimensions.
class HostSidebarButton {
    constructor(view, onClick, icon) {
        this.parent = view.parentElement;
        this.savedPosition = null;
        const win = view.ownerDocument.defaultView;
        if (win.getComputedStyle(this.parent).position === "static") {
            const style = this.parent.style;
            this.savedPosition = { value: style.getPropertyValue("position"), priority: style.getPropertyPriority("position") };
            style.setProperty("position", "relative", "important");
        }
        const button = view.ownerDocument.createElement("button");
        this.button = button;
        button.type = "button";
        button.className = "clickable-icon chatgpt-theme-sync-host-sidebar";
        // Avoid Obsidian's delegated aria-label tooltip retaining hover
        // state when this button disappears and subsequently reappears.
        // Keep an accessible text label, independent of the native tooltip.
        this.sidebarOpen = null;
        button.style.cssText = "position:absolute;top:6px;left:6px;z-index:100;display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:4px;background:var(--background-primary);border-radius:var(--radius-s,4px);color:var(--icon-color,var(--text-muted));";
        icon(button, "panel-left");
        const label = view.ownerDocument.createElement("span");
        label.textContent = "Open ChatGPT sidebar";
        label.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;";
        button.appendChild(label);
        // Arm a single native tooltip only after fresh pointer movement.
        // A synthetic hover caused by redisplay must not resurrect it.
        this.onHover = event => {
            if (!this.sidebarOpen && event.isTrusted && (event.movementX || event.movementY))
                button.title = "Open ChatGPT sidebar";
        };
        this.clearTooltip = () => button.removeAttribute("title");
        this.onClick = event => {
            event.stopPropagation();
            this.clearTooltip();
            button.blur();
            onClick();
        };
        button.addEventListener("pointermove", this.onHover);
        button.addEventListener("pointerleave", this.clearTooltip);
        button.addEventListener("click", this.onClick);
        this.parent.appendChild(button);
    }
    setSidebarOpen(open) {
        if (this.sidebarOpen === open) return;
        if (this.sidebarOpen !== open) {
            this.clearTooltip();
            if (open) this.button.blur();
        }
        this.sidebarOpen = open;
        this.button.style.display = open ? "none" : "flex";
        this.button.setAttribute("aria-expanded", String(open));
    }
    dispose() {
        this.clearTooltip();
        this.button.removeEventListener("pointermove", this.onHover);
        this.button.removeEventListener("pointerleave", this.clearTooltip);
        this.button.removeEventListener("click", this.onClick);
        this.button.remove();
        if (this.savedPosition) {
            const style = this.parent.style;
            if (style.getPropertyValue("position") === "relative" && style.getPropertyPriority("position") === "important") {
                if (this.savedPosition.value) style.setProperty("position", this.savedPosition.value, this.savedPosition.priority);
                else style.removeProperty("position");
            }
        }
    }
}

// Obsidian-owned controls, independent of ChatGPT's sidebar state.
class HostNavigationButtons {
    constructor(view, onAction, icon) {
        this.parent = view.parentElement;
        this.savedPosition = null;
        const doc = view.ownerDocument;
        if (doc.defaultView.getComputedStyle(this.parent).position === "static") {
            const style = this.parent.style;
            this.savedPosition = {value:style.getPropertyValue("position"), priority:style.getPropertyPriority("position")};
            style.setProperty("position", "relative", "important");
        }
        const bar = this.button = doc.createElement("div");
        bar.className = "chatgpt-theme-sync-host-navigation";
        bar.style.cssText = "position:absolute;top:6px;left:6px;z-index:100;display:flex;gap:3px;align-items:center;";
        for (const [action, name, label] of [["search","search","Search chats"],["new","square-pen","New chat"]]) {
            const button = doc.createElement("button");
            button.type = "button";
            button.className = "clickable-icon";
            button.setAttribute("aria-label", label);
            button.style.cssText = "display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:4px;background:var(--background-primary);border-radius:var(--radius-s,4px);color:var(--icon-color,var(--text-muted));";
            icon(button,name);
            button.addEventListener("click",event=>{event.stopPropagation();button.blur();onAction(action);});
            bar.appendChild(button);
        }
        this.parent.appendChild(bar);
    }
    dispose() {
        this.button.remove();
        if (this.savedPosition) {
            const style = this.parent.style;
            if (style.getPropertyValue("position") === "relative" && style.getPropertyPriority("position") === "important") {
                if (this.savedPosition.value) style.setProperty("position", this.savedPosition.value, this.savedPosition.priority);
                else style.removeProperty("position");
            }
        }
    }
}

const instanceId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
let nextSessionId = 0;
class WebviewSession {
    constructor(view) {
        this.view = view;
        this.id = ++nextSessionId;
        this.generation = 0;
        this.loading = false;
        this.detached = false;
        this.queue = Promise.resolve();
        this.cssQueue = Promise.resolve();
        this.appearanceQueue = Promise.resolve();
        this.appearanceMode = null;
        this.appearanceDebugger = null;
        this.sidebarQueue = Promise.resolve();
        this.listeners = [];
        this.key = this.signature = this.sidebarEnabled = this.headerEnabled = null;
        this.addressBar = this.resize = this.background = this.navigationURL = this.hostSidebar = this.bottomClearance = null;
        this.sidebar = null;
        this.resizePhase = "idle";
        this.resizeRevision = 0;
    }
    get sessionId() { return instanceId + ":" + this.id + ":" + this.generation; }
    get sidebarOpen() { return this.sidebar?.hidden === true; }
    invalidateSidebar() {
        this.sidebar = null;
        this.resizePhase = "idle";
        ++this.resizeRevision;
    }
    acceptSidebar(data) {
        if (this.detached || this.loading || !data || data.sessionId !== this.sessionId ||
            !Number.isInteger(data.sequence) || data.sequence < (this.sidebar?.sequence ?? -1)) return false;
        if (data.sequence === this.sidebar?.sequence) return true;
        this.sidebar = data;
        this.hostSidebar?.setSidebarOpen?.(data.hidden === true);
        return true;
    }
    // All guest sidebar commands are ordered by this one queue. Generation
    // checks prevent a late result from affecting another document.
    sidebarEffect(operation) {
        const id = this.sessionId;
        const valid = () => !this.detached && !this.loading && this.sessionId === id;
        const task = this.sidebarQueue.catch(() => {}).then(async () => {
            if (!valid()) return false;
            const result = await operation(id, valid);
            return valid() ? result : false;
        });
        this.sidebarQueue = task.catch(() => false);
        return task;
    }
    setResizePhase(phase) {
        if (this.resizePhase === phase) return;
        this.resizePhase = phase;
        const revision = ++this.resizeRevision;
        if (!this.sidebarEnabled) return;
        void this.sidebarEffect(async (id, valid) => {
            if (!valid() || revision !== this.resizeRevision || !isChatGPT(this.view.getURL())) return false;
            return this.view.executeJavaScript("(() => { const c=window.__obsidianChatGPTSidebarToggle; if(c?.sessionId===" +
                JSON.stringify(id) + ") c.setResizePhase(" + JSON.stringify(phase) + "); })()");
        }).catch(() => {});
    }
}

class ObsidianChatGPTNative extends Plugin {
    async onload() {
        const saved = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
        let migrated = false;
        if (!saved?.sidebarWarmDefault091) {
            this.settings.keepSidebarWarm = true;
            this.settings.sidebarWarmDefault091 = true;
            migrated = true;
        }
        if (saved && !Object.prototype.hasOwnProperty.call(saved, "keepSidebarWarm")) {
            this.settings.keepSidebarWarm = true;
            migrated = true;
        }
        for (const key of ["contentOnlyResize", "animatedLayoutTransitions", "launcherPrompt", "launcherPlugin", "hideUntilReady"]) {
            if (Object.prototype.hasOwnProperty.call(this.settings, key)) {
                delete this.settings[key]; migrated = true;
            }
        }
        if (migrated) await this.saveData(this.settings);
        this.views = new Map();
        this.observers = new Map();
        this.paletteCache = new WeakMap();
        this.paletteWatchers = new Map();
        this.closed = false;
        this.scanTimer = null;
        this.launcherIcon = null;
        addIcon(CHATGPT_RIBBON_ICON, CHATGPT_RIBBON_SVG);
        this.updateLauncherRibbon();
        this.addCommand({
            id:"open-chatgpt-launcher",
            name:"Open ChatGPT",
            callback:()=>void this.launchChatGPT(),
        });

        this.addSettingTab(new ThemeSettingsTab(this.app, this));
        this.addCommand({
            id: "toggle-chatgpt-sidebar-free",
            name: "Toggle sidebar-free mode / restore native navigation",
            callback: async () => {
                if (!this.settings.sidebarFreeMode) return this.setOption("sidebarFreeMode", true);
                this.settings.alwaysShowSidebarToggle = false;
                this.settings.hideChatGPTHeader = false;
                await this.setOption("sidebarFreeMode", false);
            },
        });
        this.addCommand({
            id: "toggle-chatgpt-address-bar",
            name: "Toggle ChatGPT address bar",
            callback: () => this.setOption("hideAddressBar", !this.settings.hideAddressBar),
        });
        this.addCommand({
            id: "toggle-chatgpt-header",
            name: "Toggle ChatGPT title bar",
            callback: () => this.setOption("hideChatGPTHeader", !this.settings.hideChatGPTHeader),
        });
        this.addCommand({
            id: "refresh-chatgpt-theme",
            name: "Refresh ChatGPT theme",
            callback: () => this.refresh(),
        });
        this.addCommand({
            id: "chatgpt-resize-diagnostics",
            name: "Log ChatGPT resize diagnostics",
            callback: async () => {
                const active = this.app.workspace.activeLeaf?.view?.containerEl?.querySelector("webview");
                const entry = [active, ...this.views.keys()].map(view => [view, this.views.get(view)]).find(([,state]) => state?.resize);
                if (!entry) { new Notice("No active smooth resize controller."); return; }
                const [view, state] = entry, c = state.resize;
                let guest = null;
                try {
                    if (isChatGPT(view.getURL())) guest = await view.executeJavaScript("({width:innerWidth,height:innerHeight,devicePixelRatio})");
                } catch {}
                const r = view.getBoundingClientRect();
                console.info("ChatGPT resize diagnostics", JSON.stringify({locked:c.locked, dragging:c.dragging,
                    committing:c.committing, unsupported:c.unsupported, host:c.readHost(),
                    webview:{width:r.width,height:r.height}, guest, trace:c.trace}));
                new Notice("Resize diagnostics written to Obsidian developer console.", 5000);
            },
        });
        this.addCommand({
            id: "inspect-chatgpt-webviewer",
            name: "Inspect ChatGPT Web Viewer",
            callback: () => {
                const active = this.app.workspace.activeLeaf?.view?.containerEl?.querySelector("webview");
                const candidates = [active, ...this.views.keys()].filter(Boolean);
                const target = candidates.find(view => {
                    try { return view.isConnected && isChatGPT(view.getURL()) &&
                        typeof view.openDevTools === "function"; } catch { return false; }
                });
                if (!target) { new Notice("No open ChatGPT Web Viewer found."); return; }
                const versions = typeof process !== "undefined" ? process.versions : {};
                const info = "Electron " + (versions?.electron || "unknown") +
                    " / Chromium " + (versions?.chrome || "unknown");
                console.info("Obsidian ChatGPT Native runtime:", info);
                new Notice(info, 10000);
                try { target.openDevTools(); } catch (error) {
                    console.warn("ChatGPT Web Viewer DevTools unavailable", error);
                    new Notice("Web Viewer DevTools could not be opened.");
                }
            },
        });
        this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleScan()));
        this.registerEvent(this.app.workspace.on("css-change", () => {
            // Read after Obsidian has finished applying theme variables.
            for (const doc of this.paletteWatchers.keys()) this.schedulePaletteRefresh(doc);
        }));
        this.app.workspace.onLayoutReady(() => {
            if (!this.closed) this.refresh();
        });
        this.refresh();
    }

    scheduleScan() {
        if (this.closed) return;
        if (this.scanTimer !== null) clearTimeout(this.scanTimer);
        this.scanTimer = setTimeout(() => {
            this.scanTimer = null;
            if (!this.closed) this.scan();
        }, 120);
    }

    scan() {
        if (this.closed) return;
        const docs = new Set([document]);
        // Include detached/pop-out workspace windows when supported by Obsidian.
        if (typeof this.app.workspace.iterateAllLeaves === "function") {
            this.app.workspace.iterateAllLeaves(leaf => {
                const doc = leaf.view?.containerEl?.ownerDocument;
                if (doc?.body) docs.add(doc);
            });
        }
        for (const doc of docs) {
            if (!this.observers.has(doc)) {
                const Observer = doc.defaultView.MutationObserver;
                const observer = new Observer(records => {
                    for (const record of records) {
                        for (const node of [...record.addedNodes, ...record.removedNodes]) {
                            if (node.nodeType === 1 &&
                                (node.localName === "webview" || node.querySelector?.("webview"))) {
                                this.scheduleScan();
                                return;
                            }
                        }
                    }
                });
                observer.observe(doc.body, { childList: true, subtree: true });
                this.observers.set(doc, observer);
                this.watchPalette(doc);
            }
            for (const view of doc.querySelectorAll("webview")) {
                if (typeof view.insertCSS !== "function" || typeof view.getURL !== "function") continue;
                if (!this.views.has(view)) this.attach(view);
            }
        }
        for (const [doc, observer] of this.observers) {
            if (!docs.has(doc)) {
                observer.disconnect();
                this.observers.delete(doc);
                this.unwatchPalette(doc);
            }
        }
        for (const [view, state] of this.views) {
            if (!view.isConnected || !docs.has(view.ownerDocument)) this.detach(view, state);
            else {
                if (this.settings.hideAddressBar || state.addressBar) this.updateAddressBar(view, state);
                this.updateHostSidebar(view, state);
                this.updateBottomClearance(view, state);
                this.updateSmoothResize(view, state);
                this.updateWebviewBackground(view, state);
            }
        }
    }

    attach(view) {
        const state = new WebviewSession(view);
        this.views.set(view, state);
        const on = (name, callback) => {
            view.addEventListener(name, callback);
            state.listeners.push([name, callback]);
        };
        on("did-start-navigation", event => {
            if (event.isMainFrame === false || event.isInPlace) return;
            state.generation++;
            state.loading = true;
            state.navigationURL = typeof event.url === "string" ? event.url : "";
            this.updateBottomClearance(view, state);
            this.updateWebviewBackground(view, state);
            this.restoreAddressBar(state);
            this.restoreSmoothResize(state);
            this.restoreHostSidebar(state);
            state.invalidateSidebar();
            state.sidebarQueue = Promise.resolve();
            state.headerEnabled = null;
            // A full navigation destroys the old document and its injected CSS.
            state.key = null;
            state.signature = null;
            state.appearanceMode = null;
            state.sidebarEnabled = null;
            // Media emulation is per WebContents, so clear it when leaving ChatGPT.
            if (!isChatGPT(state.navigationURL)) void this.updateGuestAppearance(view,state);
        });
        const ready = () => {
            state.loading = false;
            state.navigationURL = null;
            this.updateWebviewBackground(view, state);
            this.update(view, state);
        };
        on("console-message", event => {
            if (this.closed || state.detached || state.loading) return;
            const message = event.details?.message ?? event.message;
            if (typeof message !== "string" || !message.startsWith("chatgpt-theme-sync:sidebar")) return;
            try { if (!isChatGPT(view.getURL())) return; } catch { return; }
            if (message.startsWith("chatgpt-theme-sync:sidebar-timing:")) {
                try { console.info("ChatGPT sidebar timing", JSON.parse(message.slice("chatgpt-theme-sync:sidebar-timing:".length))); } catch {}
                return;
            }
            const prefix = "chatgpt-theme-sync:sidebar-state:";
            if (!message.startsWith(prefix)) return;
            try { state.acceptSidebar(JSON.parse(message.slice(prefix.length))); } catch {}
        });
        // The new main-frame document has committed. CSS does not need
        // to wait for executeJavaScript, the sidebar, or page hydration.
        on("load-commit", event => {
            if (event.isMainFrame !== true || !isChatGPT(event.url)) return;
            void this.applyThemeCSS(view, state, true);
        });
        on("dom-ready", ready);
        on("devtools-closed", () => {
            state.appearanceMode = null;
            void this.updateGuestAppearance(view,state);
        });
        on("did-finish-load", () => {
            state.headerEnabled = null;
            // The first install can precede ChatGPT hydration. Refresh the
            // existing controller after load without resetting user intent.
            state.sidebarEnabled = null;
            ready();
        });
        on("did-navigate-in-page", event => {
            if (event.isMainFrame !== false) {
                state.headerEnabled = null;
                this.update(view, state);
            }
        });
        on("did-fail-load", event => {
            if (event.isMainFrame !== false) ready();
        });
        this.updateWebviewBackground(view, state);
        this.update(view, state);
    }

    restoreBottomClearance(state) {
        state.bottomClearance?.dispose();
        state.bottomClearance = null;
    }

    updateBottomClearance(view, state) {
        let pane = null;
        try {
            const url = state.loading ? state.navigationURL : view.getURL();
            if (!this.closed && !state.detached && this.settings.composerClearance && isChatGPT(url)) {
                pane = view.closest('.workspace-leaf-content[data-type="webviewer"]');
                // Never change a shared pane with multiple guests.
                if (!pane?.style || pane.querySelectorAll("webview").length !== 1) pane = null;
            }
        } catch { pane = null; }
        if (state.bottomClearance?.pane === pane && pane) return;
        if (!pane && !state.bottomClearance) return;
        this.restoreSmoothResize(state);
        this.restoreBottomClearance(state);
        if (pane) state.bottomClearance = new WebviewBottomClearance(view, pane);
    }

    restoreWebviewBackground(state) {
        state.background?.dispose();
        state.background = null;
    }

    updateWebviewBackground(view, state) {
        let eligible = false;
        try {
            const url = state.loading ? state.navigationURL : view.getURL();
            eligible = !this.closed && !state.detached && this.settings.enabled &&
                this.settings.matchWebviewBackground && isChatGPT(url) &&
                view.parentElement && view.closest('.workspace-leaf-content[data-type="webviewer"]');
        } catch {}
        if (!eligible) { this.restoreWebviewBackground(state); return; }
        const palette = this.getPalette(view.ownerDocument);
        const current = state.background;
        if (current && current.parent === view.parentElement &&
            current.palette.primary === palette.primary && current.palette.mode === palette.mode) return;
        this.restoreWebviewBackground(state);
        state.background = new WebviewBackground(view, palette);
    }

    restoreHostSidebar(state) {
        state.hostSidebar?.dispose();
        state.hostSidebar = null;
    }

    updateHostSidebar(view, state) {
        let eligible = false;
        try {
            eligible = !this.closed && !state.detached && !state.loading &&
                (this.settings.sidebarFreeMode || this.settings.hideChatGPTHeader || this.settings.alwaysShowSidebarToggle) && isChatGPT(view.getURL()) &&
                view.parentElement && view.closest('.workspace-leaf-content[data-type="webviewer"]');
        } catch {}
        if (state.hostSidebar && (!eligible || state.hostSidebar.parent !== view.parentElement ||
            !state.hostSidebar.button.isConnected ||
            (state.hostSidebar instanceof HostNavigationButtons) !== Boolean(this.settings.sidebarFreeMode))) {
            // Release the resize controller before restoring host positioning.
            this.restoreSmoothResize(state);
            this.restoreHostSidebar(state);
        }
        if (eligible && !state.hostSidebar) {
            this.restoreSmoothResize(state);
            if (this.settings.sidebarFreeMode) {
                state.hostSidebar = new HostNavigationButtons(view, action => void this.navigateGuest(view, action), setIcon);
            } else {
                state.hostSidebar = new HostSidebarButton(view, () => this.toggleGuestSidebar(view), setIcon);
                state.hostSidebar.setSidebarOpen(state.sidebarOpen);
                void this.syncHostSidebar(view, state);
            }
        }
    }

    async navigateGuest(view, action) {
        const state = this.views.get(view);
        if (!state || state.detached || state.loading || !this.settings.sidebarFreeMode) return;
        const generation = state.generation;
        const valid = () => !this.closed && !state.detached && !state.loading && state.generation === generation &&
            this.settings.sidebarFreeMode && isChatGPT(view.getURL());
        try {
            if (!valid()) return;
            view.focus();
            const clicked = await view.executeJavaScript("(" + invokeNativeNavigation.toString() + ")(" + JSON.stringify(action) + ")");
            if (clicked || !valid()) return;
            if (action === "search" && typeof view.sendInputEvent === "function") {
                // Invoke the existing guest shortcut, not a new Obsidian hotkey.
                const modifiers = [process.platform === "darwin" ? "meta" : "control"];
                view.sendInputEvent({type:"keyDown", keyCode:"K", modifiers});
                view.sendInputEvent({type:"keyUp", keyCode:"K", modifiers});
            } else if (action === "new") {
                // Native control may be unmounted at narrow widths. Stay in this tab.
                await view.executeJavaScript('location.assign("https://chatgpt.com/")');
            } else new Notice("ChatGPT search is unavailable. Use the existing search shortcut.");
        } catch {
            new Notice("ChatGPT navigation is unavailable. Restore native navigation from the command palette.");
        }
    }

    async syncHostSidebar(view, state) {
        try {
            await state.sidebarEffect(async (id, valid) => {
                if (!isChatGPT(view.getURL())) return false;
                const data = await view.executeJavaScript("window.__obsidianChatGPTSidebarToggle?.snapshot?.()");
                if (valid()) state.acceptSidebar(data);
                return true;
            });
        } catch {}
    }

    async toggleGuestSidebar(view) {
        const state = this.views.get(view);
        if (!state) return;
        try {
            const ok = await state.sidebarEffect(async (id, valid) => {
                if (!isChatGPT(view.getURL())) return false;
                const result = await view.executeJavaScript("(() => { const c=window.__obsidianChatGPTSidebarToggle; if(c?.sessionId!==" +
                    JSON.stringify(id) + ") return null; return c.setOpen(true) ? c.snapshot() : null; })()");
                if (valid() && result) state.acceptSidebar(result);
                return !!result;
            });
            if (!ok && !state.detached && !state.loading) new Notice("ChatGPT sidebar is not ready yet.");
        } catch { new Notice("ChatGPT sidebar is unavailable."); }
    }

    async setHeaderControl(view, enabled) {
        try {
            if (!isChatGPT(view.getURL()) || typeof view.executeJavaScript !== "function") return false;
            return await view.executeJavaScript("(" + installHeaderHiding.toString() + ")(" + JSON.stringify(enabled) + ")");
        } catch { return false; }
    }

    restoreSmoothResize(state) {
        state.resize?.dispose();
        state.resize = null;
    }

    updateSmoothResize(view, state) {
        let eligible = false;
        try {
            eligible = !this.closed && !state.detached && !state.loading &&
                this.settings.smoothResize && isChatGPT(view.getURL()) &&
                view.closest('.workspace-leaf-content[data-type="webviewer"]') &&
                view.parentElement && view.ownerDocument.defaultView;
        } catch {}
        if (!eligible || (state.resize && state.resize.parent !== view.parentElement)) {
            this.restoreSmoothResize(state);
        }
        if (eligible && !state.resize) state.resize = new SmoothResizeController(view, phase => state.setResizePhase(phase));
    }

    restoreAddressBar(state) {
        if (!state.addressBar) return;
        const { element, display, priority } = state.addressBar;
        if (display) element.style.setProperty("display", display, priority);
        else element.style.removeProperty("display");
        state.addressBar = null;
    }

    updateAddressBar(view, state) {
        let eligible = false;
        try {
            eligible = !this.closed && !state.detached && !state.loading &&
                this.settings.hideAddressBar && isChatGPT(view.getURL());
        } catch {}
        if (!eligible) {
            this.restoreAddressBar(state);
            return;
        }
        // Obsidian owns the address bar; never hide anything inside the guest.
        const pane = view.closest('.workspace-leaf-content[data-type="webviewer"]');
        const address = pane?.querySelector(".webviewer-address");
        if (!address || address.contains(view)) {
            this.restoreAddressBar(state);
            return;
        }
        // Prefer the native browser row. Fall back to the address element if
        // the layout changes, rather than hiding unrelated pane controls.
        let target = address;
        for (let parent = address.parentElement; parent && parent !== pane; parent = parent.parentElement) {
            if (parent.contains(view) || parent.querySelector("webview")) break;
            if (parent.matches(".view-header, .webviewer-header, .webviewer-toolbar, .webviewer-navbar, .webviewer-navigation, .webviewer-nav")) {
                target = parent;
                break;
            }
            if (parent.querySelectorAll("button, .clickable-icon").length >= 2) {
                target = parent;
                break;
            }
        }
        if (state.addressBar?.element === target) return;
        this.restoreAddressBar(state);
        state.addressBar = {
            element: target,
            display: target.style.getPropertyValue("display"),
            priority: target.style.getPropertyPriority("display"),
        };
        target.style.setProperty("display", "none", "important");
    }

    watchPalette(doc) {
        if (this.paletteWatchers.has(doc)) return;
        const schedule = () => this.schedulePaletteRefresh(doc);
        const observer = new doc.defaultView.MutationObserver(schedule);
        // Accent changes can update --accent-h/s/l or CSS classes directly,
        // without emitting a workspace css-change event. Do not observe
        // arbitrary workspace descendants or the guest DOM.
        for (const el of [doc.documentElement, doc.body]) {
            if (el) observer.observe(el, {attributes:true, attributeFilter:["style","class","data-theme"]});
        }
        // Also catch replacement or text edits of host theme stylesheets.
        const styles = new doc.defaultView.MutationObserver(records => {
            const relevant = node => node?.nodeType === 1 &&
                (node.matches?.("style, link[rel=stylesheet]") || node.querySelector?.("style, link[rel=stylesheet]"));
            if (records.some(record =>
                relevant(record.target.nodeType === 3 ? record.target.parentElement : record.target) ||
                [...record.addedNodes,...record.removedNodes].some(relevant))) schedule();
        });
        if (doc.head) styles.observe(doc.head, {subtree:true, childList:true, characterData:true,
            attributes:true, attributeFilter:["href","media","disabled"]});
        // Covers native color pickers even if the theme uses CSSOM changes.
        const onColor = event => {
            if (event.target?.matches?.('input[type="color"]')) schedule();
        };
        doc.addEventListener("input",onColor,true);
        doc.addEventListener("change",onColor,true);
        this.paletteWatchers.set(doc,{observer,styles,onColor,timer:null});
    }

    unwatchPalette(doc) {
        const watcher = this.paletteWatchers.get(doc);
        if (!watcher) return;
        this.paletteWatchers.delete(doc);
        if (watcher.timer !== null) clearTimeout(watcher.timer);
        watcher.observer.disconnect();
        watcher.styles.disconnect();
        doc.removeEventListener("input",watcher.onColor,true);
        doc.removeEventListener("change",watcher.onColor,true);
        this.paletteCache.delete(doc);
    }

    schedulePaletteRefresh(doc) {
        const watcher = this.paletteWatchers.get(doc);
        if (this.closed || !watcher) return;
        if (watcher.timer !== null) clearTimeout(watcher.timer);
        watcher.timer = setTimeout(() => {
            watcher.timer = null;
            if (this.closed || this.paletteWatchers.get(doc) !== watcher) return;
            this.refreshPalette(doc);
        },80);
    }

    refreshPalette(doc) {
        if (this.closed || !doc.body) return;
        const targets = [...this.views].filter(([view,state]) => {
            try {
                return view.ownerDocument === doc && view.isConnected && !state.detached &&
                    isChatGPT(state.loading ? state.navigationURL : view.getURL());
            } catch { return false; }
        });
        const old = this.paletteCache.get(doc);
        if (!targets.length) {
            this.paletteCache.delete(doc);
            return;
        }
        const next = readPalette(doc);
        if (old && Object.keys(next).every(key => next[key] === old[key])) return;
        this.paletteCache.set(doc,next);
        for (const [view,state] of targets) {
            this.updateWebviewBackground(view,state);
            void this.applyThemeCSS(view,state,state.loading);
            void this.updateGuestAppearance(view,state);
        }
    }

    getPalette(doc) {
        let palette = this.paletteCache.get(doc);
        if (!palette) {
            palette = readPalette(doc);
            this.paletteCache.set(doc, palette);
        }
        return palette;
    }

    async remove(view, key) {
        if (!key) return;
        try {
            await view.removeInsertedCSS(key);
        } catch {
            // Guest may already have navigated or been destroyed.
        }
    }

    async setSidebarControl(view, enabled, keepWarm = false, sessionId = "", hostManaged = false) {
        if (typeof view.executeJavaScript !== "function") return false;
        try {
            if (!isChatGPT(view.getURL())) return false;
            return await view.executeJavaScript("(" + installSidebarToggle.toString() + ")(" + JSON.stringify(enabled) + "," + JSON.stringify(keepWarm) + "," + JSON.stringify(sessionId) + "," + JSON.stringify(hostManaged) + ")");
        } catch {
            return false;
        }
    }

    async clearGuestAppearance(state) {
        const owned = state.appearanceDebugger;
        state.appearanceDebugger = null;
        state.appearanceMode = null;
        if (!owned) return;
        try {
            if (owned.isAttached()) {
                await owned.sendCommand("Emulation.setEmulatedMedia",{media:"",features:[]});
                if (owned.isAttached()) owned.detach();
            }
        } catch (error) {
            console.debug("Obsidian ChatGPT Native: color scheme cleanup",error);
            try { if (owned.isAttached()) owned.detach(); } catch {}
        }
    }

    updateGuestAppearance(view,state) {
        const generation = state.generation;
        state.appearanceQueue = state.appearanceQueue.catch(()=>{}).then(async()=>{
            if (this.closed || state.detached || state.generation !== generation) return;
            try {
                const url = state.loading ? state.navigationURL : view.getURL();
                if (!isChatGPT(url) || !this.settings.enabled) {
                    await this.clearGuestAppearance(state);
                    return;
                }
                if (state.loading) return;
                const mode = this.getPalette(view.ownerDocument).mode;
                const nativeMode = view.ownerDocument.defaultView.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                // When Obsidian matches the real OS preference, no debugger
                // session is necessary. Keep DevTools and other tabs untouched.
                if (mode === nativeMode) {
                    await this.clearGuestAppearance(state);
                    return;
                }
                if (view.isDevToolsOpened?.()) return;
                if (!state.appearanceDebugger?.isAttached()) {
                    state.appearanceDebugger = null;
                    state.appearanceMode = null;
                    const debug = getGuestDebugger(view);
                    if (!debug || debug.isAttached()) {
                        if (!state.appearanceWarned) {
                            state.appearanceWarned = true;
                            console.warn("Obsidian ChatGPT Native: per-tab color scheme emulation unavailable or debugger already in use.");
                        }
                        return;
                    }
                    debug.attach("1.3");
                    state.appearanceDebugger = debug;
                }
                if (state.appearanceMode === mode) return;
                const debug = state.appearanceDebugger;
                await debug.sendCommand("Emulation.setEmulatedMedia",{
                    features:[{name:"prefers-color-scheme",value:mode}]
                });
                if (this.closed || state.detached || state.generation !== generation) {
                    await this.clearGuestAppearance(state);
                    return;
                }
                state.appearanceMode = mode;
                const actual = await view.executeJavaScript('matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"');
                if (actual !== mode) {
                    await this.clearGuestAppearance(state);
                    console.warn("Obsidian ChatGPT Native: browser color-scheme emulation did not take effect.");
                }
            } catch(error) {
                await this.clearGuestAppearance(state);
                if (!state.appearanceWarned) {
                    state.appearanceWarned = true;
                    console.warn("Obsidian ChatGPT Native: color scheme sync unavailable",error);
                }
            }
        });
        return state.appearanceQueue;
    }

    applyThemeCSS(view, state, allowLoading = false) {
        const requestedGeneration = state.generation;
        state.cssQueue = state.cssQueue.catch(() => {}).then(async () => {
            if (this.closed || state.detached || state.generation !== requestedGeneration ||
                (state.loading && !allowLoading)) return;
            let url;
            try { url = view.getURL(); } catch { return; }
            // Never inject into the previous or an unrelated document.
            if (state.loading && (!isChatGPT(url) || !isChatGPT(state.navigationURL))) return;
            const eligible = isChatGPT(url);
            const parts = [];
            if (eligible && this.settings.enabled) parts.push(makeCSS(this.getPalette(view.ownerDocument), this.settings));
            if (eligible && (this.settings.matchAccent || this.settings.matchSelection)) {
                const accents = makeAccentCSS(this.getPalette(view.ownerDocument), this.settings);
                if (accents) parts.push(accents);
            }
            if (eligible && this.settings.squareFrame) parts.push(makeFrameCSS());
            if (eligible && this.settings.hideChatGPTHeader) parts.push(makeHiddenHeaderCSS());
            if (eligible && this.settings.performanceMode) parts.push(makePerformanceCSS(this.settings.optimizeLongChats));
            if (eligible && this.settings.sidebarFreeMode) parts.push(makeSidebarFreeCSS());
            const css = parts.length ? parts.join("\n") : null;
            if (css === state.signature && (css === null || state.key)) return;

            const generation = requestedGeneration;
            const oldKey = state.key;
            if (!css) {
                state.key = null;
                state.signature = null;
                await this.remove(view, oldKey);
                return;
            }

            let newKey;
            try {
                newKey = await view.insertCSS(css, { cssOrigin: "user" });
            } catch (error) {
                // Initial scan can encounter a webview before its guest is ready;
                // dom-ready/did-finish-load will retry.
                if (!state.loading && !state.detached) {
                    console.debug("Obsidian ChatGPT Native: CSS insertion deferred", error);
                }
                return;
            }
            let stillEligible = false;
            try {
                stillEligible = (this.settings.enabled || this.settings.matchAccent || this.settings.matchSelection || this.settings.squareFrame || this.settings.performanceMode || this.settings.hideChatGPTHeader || this.settings.sidebarFreeMode) && isChatGPT(view.getURL());
            } catch {}
            if (this.closed || state.detached || state.generation !== generation || !stillEligible) {
                await this.remove(view, newKey);
                return;
            }
            state.key = newKey;
            state.signature = css;
            await this.remove(view, oldKey);
        });
        return state.cssQueue;
    }

    update(view, state) {
        // Independent queues: a slow guest script must not postpone painting.
        void this.applyThemeCSS(view, state);
        void this.updateGuestAppearance(view,state);
        const requestedGeneration = state.generation;
        state.queue = state.queue.catch(() => {}).then(async () => {
            if (this.closed || state.detached || state.loading || state.generation !== requestedGeneration) return;
            let url;
            try { url = view.getURL(); } catch { return; }
            this.updateAddressBar(view, state);
            this.updateHostSidebar(view, state);
            this.updateBottomClearance(view, state);
            this.updateSmoothResize(view, state);
            this.updateWebviewBackground(view, state);
            const chatgpt = isChatGPT(url);
            const generationBeforeSidebar = state.generation;
            const sidebarEnabled = !this.settings.sidebarFreeMode && Boolean(this.settings.alwaysShowSidebarToggle || this.settings.hideChatGPTHeader);
            const keepWarm = sidebarEnabled && Boolean(this.settings.keepSidebarWarm);
            const hostManaged = sidebarEnabled && Boolean(state.hostSidebar);
            const sidebarSignature = sidebarEnabled ? (keepWarm ? "warm" : "cold") + (hostManaged ? ":host" : ":guest") : false;
            if (chatgpt && state.sidebarEnabled !== sidebarSignature) {
                await state.sidebarEffect(async (id, valid) => {
                    if (!await this.setSidebarControl(view, sidebarEnabled, keepWarm, id, hostManaged) || !valid()) return false;
                    state.sidebarEnabled = sidebarSignature;
                    if (sidebarEnabled) {
                        const data = await view.executeJavaScript("(() => { const c=window.__obsidianChatGPTSidebarToggle; c?.setResizePhase(" +
                            JSON.stringify(state.resizePhase) + "); return c?.snapshot(); })()");
                        if (valid()) state.acceptSidebar(data);
                    } else state.invalidateSidebar();
                    return true;
                }).catch(() => false);
            }
            if (this.closed || state.detached || state.loading || state.generation !== generationBeforeSidebar) return;
            const headerEnabled = Boolean(this.settings.hideChatGPTHeader);
            if (chatgpt && state.headerEnabled !== headerEnabled) {
                if (await this.setHeaderControl(view, headerEnabled)) {
                    if (state.generation === generationBeforeSidebar) state.headerEnabled = headerEnabled;
                }
            }
            if (this.closed || state.detached || state.loading || state.generation !== generationBeforeSidebar) return;
        });
        return state.queue;
    }

    refresh() {
        if (this.closed) return;
        this.paletteCache = new WeakMap();
        this.scan();
        for (const [view, state] of this.views) this.update(view, state);
    }

    detach(view, state) {
        const detachedSessionId = state.sessionId;
        state.detached = true;
        this.restoreWebviewBackground(state);
        this.restoreSmoothResize(state);
        this.restoreBottomClearance(state);
        this.restoreHostSidebar(state);
        this.restoreAddressBar(state);
        state.generation++;
        for (const [name, callback] of state.listeners) view.removeEventListener(name, callback);
        this.views.delete(view);
        const key = state.key;
        state.key = null;
        state.signature = null;
        void this.remove(view, key);
        // Wait for any in-flight installation before cleaning up the guest.
        void Promise.allSettled([state.queue, state.sidebarQueue, state.appearanceQueue]).then(() => {
            void this.clearGuestAppearance(state);
            if (state.headerEnabled !== false && !this.views.has(view)) void this.setHeaderControl(view, false);
            if (state.sidebarEnabled !== false && !this.views.has(view)) return this.setSidebarControl(view, false, false, detachedSessionId);
        });
    }

    updateLauncherRibbon() {
        if (!this.settings.launcherEnabled) {
            this.launcherIcon?.remove();
            this.launcherIcon = null;
        } else if (!this.launcherIcon) {
            this.launcherIcon = this.addRibbonIcon(CHATGPT_RIBBON_ICON, "Open ChatGPT", () => void this.launchChatGPT());
        }
    }

    async launchChatGPT() {
        const destination=launcherDestination(this.settings);
        if (!destination) {
            new Notice("Enter a valid HTTPS ChatGPT URL in launcher settings.");
            return;
        }
        try {
            await openLauncherTab(this.app.workspace,destination);
        } catch {
            new Notice("Could not open ChatGPT. Enable the core Web Viewer plugin in Obsidian.");
        }
    }

    onunload() {
        this.closed = true;
        this.launcherIcon?.remove();
        this.launcherIcon = null;
        if (this.scanTimer !== null) clearTimeout(this.scanTimer);
        for (const observer of this.observers.values()) observer.disconnect();
        this.observers.clear();
        for (const doc of this.paletteWatchers.keys()) this.unwatchPalette(doc);
        for (const [view, state] of this.views) this.detach(view, state);
    }

    async setOption(key, value) {
        this.settings[key] = value;
        if (key === "launcherEnabled") this.updateLauncherRibbon();
        else if (!key.startsWith("launcher")) this.refresh();
        await this.saveData(this.settings);
    }
}

class ThemeSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        const { settings } = this.plugin;
        containerEl.empty();

        const heading = name => new Setting(containerEl).setName(name).setHeading();
        const toggle = (key, name, {desc, disabled = false, redraw = false} = {}) => {
            const row = new Setting(containerEl).setName(name);
            if (desc) row.setDesc(desc);
            row.addToggle(control => control.setValue(settings[key])
                .setDisabled(disabled)
                .onChange(async value => {
                    await this.plugin.setOption(key, value);
                    if (redraw) this.display();
                }));
        };

        heading("Appearance");
        toggle("enabled", "Match background", {desc:"Also sync light/dark mode when ChatGPT adapts to system.", redraw:true});
        toggle("matchSidebar", "Match sidebar", {disabled:!settings.enabled || settings.sidebarFreeMode});
        toggle("matchComposer", "Match composer", {disabled:!settings.enabled});
        toggle("composerClearance", "Web Viewer bottom clearance", {desc:"Reserve 12 px below the entire ChatGPT Web Viewer for the Obsidian status bar."});
        toggle("matchAccent", "Match accent color");
        toggle("matchSelection", "Match text selection");
        toggle("squareFrame", "Square window corners");
        toggle("solidHeader", "Solid title bar", {disabled:!settings.enabled || settings.hideChatGPTHeader});

        heading("Navigation");
        toggle("sidebarFreeMode", "Sidebar-free mode", {
            desc:"Replace the sidebar with Search and New chat buttons.", redraw:true
        });
        toggle("alwaysShowSidebarToggle", "Always show sidebar toggle", {
            disabled:settings.sidebarFreeMode
        });
        toggle("hideChatGPTHeader", "Hide ChatGPT title bar", {redraw:true});
        toggle("hideAddressBar", "Hide address bar");

        heading("Performance");
        toggle("smoothResize", "Smooth resizing", {
            desc:"Keep the chat layout stable while resizing."
        });
        toggle("matchWebviewBackground", "Match Web Viewer background", {
            desc:"Reduce white flashes.", disabled:!settings.enabled
        });
        toggle("performanceMode", "Reduce animations and blur", {redraw:true});
        toggle("keepSidebarWarm", "Keep sidebar ready", {
            desc:"Keep sidebar content loaded when closed.",
            disabled:settings.sidebarFreeMode
        });
        toggle("optimizeLongChats", "Optimize long chats", {
            desc:"Experimental; may affect scrolling.", disabled:!settings.performanceMode
        });

        heading("Launcher");
        toggle("launcherEnabled", "Show ribbon button");
        new Setting(containerEl)
            .setName("Open to")
            .addDropdown(dropdown => dropdown.addOption("home","New chat")
                .addOption("chat","Saved conversation")
                .setValue(settings.launcherMode)
                .onChange(async value => {
                    await this.plugin.setOption("launcherMode",value);
                    this.display();
                }));
        if (settings.launcherMode === "chat") {
            new Setting(containerEl)
                .setName("Conversation URL")
                .addText(text => text.setPlaceholder("https://chatgpt.com/c/...")
                    .setValue(settings.launcherURL)
                    .onChange(value => this.plugin.setOption("launcherURL",value)));
        }

        heading("Tools");
        new Setting(containerEl)
            .setName("Refresh theme")
            .addButton(button => button.setButtonText("Refresh").onClick(() => this.plugin.refresh()));
    }
}

module.exports = ObsidianChatGPTNative;
// Expose pure helpers for dependency-free tests outside Obsidian.
module.exports.isChatGPT = isChatGPT;
module.exports.makeCSS = makeCSS;
module.exports.makeAccentCSS = makeAccentCSS;
module.exports.accentForeground = accentForeground;
module.exports.readPalette = readPalette;
module.exports.makeFrameCSS = makeFrameCSS;
module.exports.makePerformanceCSS = makePerformanceCSS;
module.exports.installSidebarToggle = installSidebarToggle;
module.exports.SmoothResizeController = SmoothResizeController;
module.exports.WebviewSession = WebviewSession;
module.exports.isWorkspaceLayoutAction = isWorkspaceLayoutAction;
module.exports.makeHiddenHeaderCSS = makeHiddenHeaderCSS;
module.exports.installHeaderHiding = installHeaderHiding;
module.exports.HostSidebarButton = HostSidebarButton;
module.exports.HostNavigationButtons = HostNavigationButtons;
module.exports.makeSidebarFreeCSS = makeSidebarFreeCSS;
module.exports.invokeNativeNavigation = invokeNativeNavigation;
module.exports.WebviewBackground = WebviewBackground;
module.exports.WebviewBottomClearance = WebviewBottomClearance;

module.exports.launcherDestination = launcherDestination;
module.exports.openLauncherTab = openLauncherTab;
module.exports.getGuestDebugger = getGuestDebugger;
