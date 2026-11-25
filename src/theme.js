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
