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
