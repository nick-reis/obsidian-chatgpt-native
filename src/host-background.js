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
