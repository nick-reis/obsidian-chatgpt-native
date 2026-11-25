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
