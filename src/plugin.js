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
