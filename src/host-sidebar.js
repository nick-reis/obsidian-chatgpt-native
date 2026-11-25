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
