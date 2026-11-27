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
