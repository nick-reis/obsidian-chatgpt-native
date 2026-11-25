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
