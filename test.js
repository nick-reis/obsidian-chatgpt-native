const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, ...args) {
    if (request === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, Setting: class {} };
    return originalLoad.call(this, request, ...args);
};
let plugin;
try { plugin = require("./main"); } finally { Module._load = originalLoad; }
const { isChatGPT, makeCSS } = plugin;

test("restricts injection to exact HTTPS ChatGPT hosts", () => {
    for (const url of ["https://chatgpt.com/", "https://chatgpt.com/c/123", "https://chat.openai.com/"]) {
        assert.equal(isChatGPT(url), true);
    }
    for (const url of ["http://chatgpt.com/", "https://chatgpt.com.evil.test/", "https://other.test/?chatgpt.com", "https://chatgpt.com:8080", "https://user@chatgpt.com", "about:blank", ""]) {
        assert.equal(isChatGPT(url), false);
    }
});

test("matches surface colors without styling text, code, or fonts", () => {
    const css = makeCSS({ mode: "dark", primary: "#222222", secondary: "#191919", elevated: "#292929" }, { matchSidebar: true, matchComposer: true });
    assert.match(css, /--app-color-background-surface: #222222/);
    assert.match(css, /--sidebar-surface-primary: #191919/);
    assert.match(css, /--color-background-composer-surface: #292929/);
    assert.match(css, /data-theme="dark"/);
    assert.doesNotMatch(css, /font-family|--app-color-text|--text-primary|filter:|data-theme="light"/);
});

test("sidebar and composer matching are optional; light mode is scoped", () => {
    const css = makeCSS({ mode: "light", primary: "#ffffff", secondary: "#eeeeee", elevated: "#f8f8f8" }, { matchSidebar: false, matchComposer: false });
    assert.match(css, /data-theme="light"/);
    assert.doesNotMatch(css, /--sidebar-surface-primary|--color-background-composer-surface|data-theme="dark"/);
});

test("square frame only targets shell rounding", () => {
    const css = plugin.makeFrameCSS();
    assert.match(css, /--app-shell-window-radius: 0px/);
    assert.match(css, /data-app-shell-sidebar-open/);
    assert.doesNotMatch(css, /composer|button|pre\s*\{|code\s*\{/);
});

test("performance mode disables visual effects without aggressive containment by default", () => {
    const css = plugin.makePerformanceCSS();
    assert.match(css, /backdrop-filter: none/);
    assert.match(css, /transition: none/);
    assert.doesNotMatch(css, /content-visibility|display: none|animation: none/);
    assert.match(css, /#app-shell-sidebar.*animation-duration: 1ms !important/);
    assert.match(css, /animation-delay: 0s !important/);
    assert.match(css, /transition-duration: 1ms !important/);
    assert.match(css, /transition-delay: 0s !important/);
    assert.match(css, /:is\(aside\.app-shell-left-panel, #app-shell-sidebar, #browser-sidebar-popover\) \*/);
    assert.doesNotMatch(css, /--app-shell-animated-left-panel-width|width: 260px|width: 0px/);
    assert.doesNotMatch(css, /\[data-app-shell-sidebar-open\] \*/);
});

test("experimental long chat optimization keeps last and focused turns uncontained", () => {
    const css = plugin.makePerformanceCSS(true);
    assert.match(css, /content-visibility: auto/);
    assert.match(css, /contain-intrinsic-size: auto 320px/);
    assert.match(css, /:not\(:last-of-type\):not\(:focus-within\)/);
});

// Model the host layout and browser style overrides without Electron.
function resizeFixture({ collapse = false, supportsClip = false, onPhase = () => {} } = {}) {
    const makeStyle = () => {
        const values = new Map();
        return {
            getPropertyValue: name => values.get(name)?.value || "",
            getPropertyPriority: name => values.get(name)?.priority || "",
            setProperty: (name, value, priority = "") => values.set(name, { value, priority }),
            removeProperty: name => values.delete(name),
        };
    };
    let width = 700, height = 500, hostLeft = 0, hostTop = 0, nextTimer = 0, now = 0, observe;
    const timers = new Map(), listeners = new Map(), frames = new Map();
    const win = {
        performance: { now: () => now },
        CSS: {supports: () => supportsClip},
        ResizeObserver: class {
            constructor(fn) { observe = fn; }
            observe() {}
            disconnect() { observe = null; }
        },
        getComputedStyle: () => ({ position: "static" }),
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: type => listeners.delete(type),
        setTimeout: (fn, delay) => { timers.set(++nextTimer, fn); fn.delay = delay; return nextTimer; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame(fn) { frames.set(++nextTimer, fn); return nextTimer; },
        cancelAnimationFrame(id) { frames.delete(id); },
    };
    const parent = {
        style: makeStyle(), clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
        get clientWidth() { return width; }, get clientHeight() { return height; },
        getBoundingClientRect: () => ({ left: hostLeft, top: hostTop, width: collapse && view.style.getPropertyValue("position") === "absolute" ? 0 : width, height }),
    };
    const view = {
        style: makeStyle(), parentElement: parent, isConnected: true,
        ownerDocument: { defaultView: win },
        getBoundingClientRect: () => {
            const value = view.style.getPropertyValue("left");
            const match = /^calc\(50% ([+-]) ([\d.]+)px\)$/.exec(value);
            const left = match ? width / 2 + (match[1] === "-" ? -1 : 1) * Number(match[2]) : parseFloat(value) || 0;
            const dimension = (name, host) => {
                const value = view.style.getPropertyValue(name);
                if (value === "100%") return host;
                const m = /^calc\(100% ([+-]) ([\d.]+)px\)$/.exec(value);
                if (m) return host + (m[1] === "+" ? 1 : -1) * Number(m[2]);
                return parseFloat(value) || host;
            };
            return { left:hostLeft + left, top:hostTop, width: dimension("width", width),
                height: dimension("height", height) };
        },
    };
    const controller = new plugin.SmoothResizeController(view, onPhase);
    function paint() { for (const [id,fn] of [...frames]) { frames.delete(id); fn(); } }
    return { controller, view, parent, timers, listeners, frames, paint,
        moveHost(x,y=hostTop) { hostLeft=x; hostTop=y; },
        resize(w, h = height, elapsed = 100) { now += elapsed; width = w; height = h; observe?.(); },
        sidebar() { listeners.get("click")({ target: { closest: () => true } }); },
        drag() { listeners.get("pointerdown")({ button: 0, target: { closest: () => true } }); },
        release(complete = true) { listeners.get("pointerup")(); if (complete) { paint(); paint(); } },
        settle() { for (const [id,fn] of [...timers]) { timers.delete(id); fn(); } paint(); paint(); },
    };
}

test("smooth resize keeps viewport fixed until divider release and restores host styles", () => {
    const f = resizeFixture();
    f.parent.style.setProperty("overflow-x", "auto");
    f.drag();
    f.resize(450);
    f.resize(350, 400);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    assert.equal(f.view.getBoundingClientRect().height, 500);
    f.release();
    assert.equal(f.view.getBoundingClientRect().width, 350);
    assert.equal(f.view.getBoundingClientRect().height, 400);
    assert.equal(f.parent.style.getPropertyValue("overflow-x"), "auto");
    assert.equal(f.view.style.getPropertyValue("position"), "");
    assert.equal(f.timers.size, 0);
    f.controller.dispose();
    assert.equal(f.listeners.size, 0);
});

test("one-off pane changes and final drag layout changes are immediate", () => {
    const f = resizeFixture();
    f.resize(600);
    assert.equal(f.view.getBoundingClientRect().width, 600);
    assert.equal(f.timers.size, 0);
    f.drag();
    f.resize(550);
    assert.equal(f.view.getBoundingClientRect().width, 600);
    f.release();
    f.resize(540);
    assert.equal(f.view.getBoundingClientRect().width, 540);
    assert.equal(f.timers.size, 0);
    f.resize(700);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    f.controller.dispose();
});

test("smooth resize restores the viewport on dispose mid-drag", () => {
    const f = resizeFixture();
    f.drag();
    f.resize(500);
    f.controller.dispose();
    assert.equal(f.view.getBoundingClientRect().width, 500);
    assert.equal(f.parent.style.getPropertyValue("position"), "");
    assert.equal(f.listeners.size, 0);
    assert.equal(f.timers.size, 0);
});

test("smooth resize falls back if absolute positioning collapses the host", () => {
    const f = resizeFixture({ collapse: true });
    f.drag();
    assert.equal(f.controller.unsupported, true);
    assert.equal(f.view.style.getPropertyValue("position"), "");
    f.resize(450);
    assert.equal(f.view.getBoundingClientRect().width, 450);
    f.controller.dispose();
});

test("sidebar toggle locks before animation and settles after final size", () => {
    const f = resizeFixture();
    f.sidebar();
    f.resize(740, 500, 16);
    f.resize(800, 500, 16);
    f.resize(900, 500, 16);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    f.settle();
    assert.equal(f.view.getBoundingClientRect().width, 900);
    assert.equal(f.timers.size, 0);
    f.controller.dispose();
});

test("unrecognized resize bursts lock at current size, isolated changes remain native", () => {
    const f = resizeFixture();
    f.resize(720, 500, 16);
    assert.equal(f.view.getBoundingClientRect().width, 720);
    assert.equal(f.timers.size, 0);
    f.resize(740, 500, 16);
    f.resize(800, 500, 16);
    assert.equal(f.view.getBoundingClientRect().width, 740);
    f.settle();
    assert.equal(f.view.getBoundingClientRect().width, 800);
    f.resize(900, 500, 100);
    assert.equal(f.view.getBoundingClientRect().width, 900);
    assert.equal(f.timers.size, 0);
    f.controller.dispose();
});

test("divider release does not re-lock on trailing resize events", () => {
    const f = resizeFixture();
    f.drag();
    f.resize(600, 500, 16);
    f.release();
    f.resize(590, 500, 16);
    f.resize(580, 500, 16);
    assert.equal(f.view.getBoundingClientRect().width, 580);
    assert.equal(f.timers.size, 0);
    f.controller.dispose();
});

function sidebarFixture({ open = true, headerReady = false, nativeReady = true, warm = false, animatedClose = false, delayed = false, wide = true, timed = false, hostManaged = false } = {}) {
    let next = 0, observer, clicks = 0, mediaChange;
    const nativeCommands = [];
    const frames = new Map(), events = new Map(), created = [], messages = [], timers = new Map();
    let panelOpacity = "1";
    const element = () => {
        const attrs = new Map(), handlers = new Map();
        return { style: {}, isConnected: true, parentElement: null, title: "",
            setAttribute: (k,v) => attrs.set(k,v), getAttribute: k => attrs.get(k) ?? null,
            hasAttribute: k => attrs.has(k), removeAttribute: k => attrs.delete(k),
            addEventListener: (k,fn) => handlers.set(k,fn),
            click() { handlers.get("click")?.(); },
            remove() { this.parentElement = null; },
            appendChild(child) { child.parentElement = this; },
            insertBefore(child) { child.parentElement = this; },
            closest: () => null,
            matches: () => true,
            getClientRects: () => [{}],
            getBoundingClientRect: () => ({width:900,height:500,left:0,top:0,right:900,bottom:500}),
        };
    };
    const root = element(), shell = element(), header = element(), wrapper = element(), newChat = element(), native = element();
    wrapper.parentElement = header;
    newChat.parentElement = wrapper;
    shell.setAttribute("data-app-shell-sidebar-open", String(open));
    function nativeSet(value) {
        shell.setAttribute("data-app-shell-sidebar-open", String(value));
        observer?.([{type:"attributes", target:shell, attributeName:"data-app-shell-sidebar-open"}]);
    }
    native.click = () => {
        clicks++;
        const apply=()=>nativeSet(shell.getAttribute("data-app-shell-sidebar-open") !== "true");
        if (delayed) nativeCommands.push(apply);
        else apply();
    };
    const panel = element();
    panel.getBoundingClientRect = () => ({width:260,height:500,left:0,top:0,right:260,bottom:500});
    const doc = {
        documentElement: root, head: element(),
        createElement: () => { const el = element(); created.push(el); return el; },
        querySelector: selector => selector === "[data-app-shell-sidebar-open]" ? shell :
            animatedClose && selector === "aside.app-shell-left-panel" ? panel : null,
        querySelectorAll: selector => selector.includes("New chat") ? (headerReady ? [newChat] : []) : (nativeReady ? [native] : []),
        addEventListener: (k,fn) => events.set(k,fn),
        removeEventListener: k => events.delete(k),
    };
    const desktop = { matches: wide, addEventListener(type,fn) { mediaChange=fn; }, removeEventListener() { mediaChange=null; } };
    const states=[];
    const win = { matchMedia: () => desktop, console: {info: message => { if(message.startsWith("chatgpt-theme-sync:sidebar-state:")) states.push(JSON.parse(message.slice("chatgpt-theme-sync:sidebar-state:".length))); else messages.push(message); }} };
    if (animatedClose || timed) Object.assign(win, {
        innerWidth:900,innerHeight:500,
        getComputedStyle:el=>({display:el===panel?"block":"none",visibility:"visible",opacity:panelOpacity}),
        setTimeout:(fn,delay)=>{fn.delay=delay;timers.set(++next,fn);return next;},
        clearTimeout:id=>timers.delete(id)
    });
    const Mutation = class { constructor(fn) { observer = fn; } observe() {} disconnect() { observer = null; } };
    const run = new Function("window", "document", "location", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame", "enabled", "keepWarm", "hostManaged",
        "return (" + plugin.installSidebarToggle.toString() + ")(enabled,keepWarm,'',hostManaged)");
    const install = (enabled, keepWarm = warm) => run(win, doc, { protocol: "https:", hostname: "chatgpt.com", port: "" }, Mutation,
        fn => { frames.set(++next, fn); return next; }, id => frames.delete(id), enabled, keepWarm, hostManaged);
    function flush() { for (const [id,fn] of [...frames]) { frames.delete(id); fn(); } }
    assert.equal(install(true), true);
    return { install, flush, root, shell, header, messages, states, timers,
        snapshot:()=>win.__obsidianChatGPTSidebarToggle.snapshot(),
        setOpen:value=>win.__obsidianChatGPTSidebarToggle.setOpen(value),
        setResizePhase:phase=>{win.__obsidianChatGPTSidebarToggle.setResizePhase(phase);flush();},
        width(w) {desktop.matches=w>=769;mediaChange?.();flush();},
        nativeSet(value) {nativeSet(value);flush();},
        ack() {nativeCommands.shift()?.();flush();},
        pending:()=>nativeCommands.length,
        runTimer(delay) {for(const [id,fn] of [...timers]) if(fn.delay===delay){timers.delete(id);fn();}flush();},
        hidden:()=>win.__obsidianChatGPTSidebarToggle.hostButtonHidden(),
        setOpacity:value=>{panelOpacity=value;},
        button: created[0], backdrop: created[1], style: created[2],
        get clicks() { return clicks; },
        headerArrives() { headerReady = true; observer?.([{ type: "attributes", target: newChat }]); flush(); },
        nativeArrives() { nativeReady = true; observer?.([{ type: "attributes", target: native }]); flush(); },
        userClick() {
            let stopped = false;
            events.get("click")?.({ isTrusted: true, target: { closest: () => native },
                preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
            if (!stopped) native.click();
            flush();
        },
        restoreOpen() { shell.setAttribute("data-app-shell-sidebar-open", "true"); observer?.([{ type: "attributes", target: shell }]); flush(); },
    };
}

test("sidebar compact visibility is immediate even without native controls or header", () => {
    const f = sidebarFixture({ nativeReady: false });
    assert.equal(f.root.hasAttribute("data-obsidian-compact-sidebar"), true);
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "false");
    assert.equal(f.button.hasAttribute("data-obsidian-fallback"), true);
    assert.equal(f.button.parentElement, f.shell);
    assert.match(f.style.textContent, /visibility:hidden !important/);
    f.restoreOpen();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "false");
    f.headerArrives();
    assert.equal(f.button.parentElement, f.header);
    assert.equal(f.button.hasAttribute("data-obsidian-fallback"), false);
    f.install(false);
    assert.equal(f.root.hasAttribute("data-obsidian-compact-sidebar"), false);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-visible"), false);
});

test("sidebar opens on explicit request even if native state was restored open", () => {
    const f = sidebarFixture();
    f.button.click(); f.flush();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "true");
    assert.equal(f.clicks, 0);
    f.backdrop.click(); f.flush();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "false");
    assert.equal(f.clicks, 1);
    f.restoreOpen();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "false");
    f.install(false);
});

test("sidebar uses native toggle when needed and honors delayed native control", () => {
    const f = sidebarFixture({ open: false, nativeReady: false });
    f.button.click(); f.flush();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "false");
    assert.equal(f.snapshot().phase,"opening");
    f.nativeArrives(); f.flush();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "true");
    assert.equal(f.clicks, 1);
    assert.equal(f.shell.getAttribute("data-app-shell-sidebar-open"), "true");
    f.userClick();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"), "false");
    f.install(false);
});

test("sidebar reports visibility changes without reporting repeated native hydration", () => {
    const f = sidebarFixture();
    assert.equal(f.messages.join(","), "chatgpt-theme-sync:sidebar:closed");
    f.restoreOpen();
    assert.equal(f.messages.length, 1);
    f.button.click(); f.flush();
    assert.equal(f.messages[1], "chatgpt-theme-sync:sidebar:open");
    f.backdrop.click(); f.flush();
    assert.equal(f.messages[2], "chatgpt-theme-sync:sidebar:closed");
    f.install(false);
});

test("webview background matches host surfaces and restores their original styles", () => {
    function element() {
        const values = new Map();
        return { style: {
            getPropertyValue: name => values.get(name)?.value || "",
            getPropertyPriority: name => values.get(name)?.priority || "",
            setProperty: (name, value, priority = "") => values.set(name, {value, priority}),
            removeProperty: name => values.delete(name),
        } };
    }
    const parent = element(), view = element();
    view.parentElement = parent;
    parent.style.setProperty("background-color", "#fff");
    const background = new plugin.WebviewBackground(view, {primary: "#202020", mode: "dark"});
    assert.equal(parent.style.getPropertyValue("background-color"), "#202020");
    assert.equal(view.style.getPropertyValue("background-color"), "#202020");
    assert.equal(view.style.getPropertyValue("color-scheme"), "dark");
    background.dispose();
    assert.equal(parent.style.getPropertyValue("background-color"), "#fff");
    assert.equal(view.style.getPropertyValue("background-color"), "");
    assert.equal(view.style.getPropertyValue("color-scheme"), "");
});

test("guest canvas fallback respects color scheme and is optional", () => {
    const palette = {mode:"dark", primary:"#202020", secondary:"#252525", elevated:"#303030"};
    const css = plugin.makeCSS(palette, {matchWebviewBackground:true});
    assert.match(css, /color-scheme: dark !important/);
    assert.match(css, /html:not\(/);
    assert.doesNotMatch(css, /prefers-color-scheme: dark/);
    assert.doesNotMatch(plugin.makeCSS(palette, {matchWebviewBackground:false}), /color-scheme/);
});

test("locked webview stays horizontally centered during expansion and contraction", () => {
    const f = resizeFixture();
    f.drag();
    assert.equal(f.view.getBoundingClientRect().left, 0);
    f.resize(900);
    assert.equal(f.view.getBoundingClientRect().left, 100);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    f.resize(500);
    assert.equal(f.view.getBoundingClientRect().left, -100);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    f.release();
    assert.equal(f.view.getBoundingClientRect().left, 0);
    assert.equal(f.view.getBoundingClientRect().width, 500);
    assert.equal(f.view.style.getPropertyValue("left"), "");
    f.controller.dispose();
});

test("sidebar animation centers the locked viewport too", () => {
    const f = resizeFixture();
    f.sidebar();
    f.resize(800, 500, 16);
    assert.equal(f.view.getBoundingClientRect().left, 50);
    f.resize(900, 500, 16);
    assert.equal(f.view.getBoundingClientRect().left, 100);
    f.settle();
    assert.equal(f.view.getBoundingClientRect().left, 0);
    assert.equal(f.view.getBoundingClientRect().width, 900);
    f.controller.dispose();
});

test("centered release restores native position and clipping atomically", () => {
    const f = resizeFixture();
    f.drag();
    f.resize(900);
    f.release(false);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    assert.equal(f.view.getBoundingClientRect().left, 100);
    assert.equal(f.view.style.getPropertyValue("position"), "absolute");
    assert.equal(f.parent.style.getPropertyValue("overflow-x"), "hidden");
    assert.equal(f.controller.phase,"settling");
    f.paint();
    assert.equal(f.view.style.getPropertyValue("position"), "absolute");
    f.paint();
    assert.equal(f.view.style.getPropertyValue("position"), "");
    assert.equal(f.view.getBoundingClientRect().width, 900);
    assert.equal(f.timers.size, 0);
    f.controller.dispose();
});

test("pending release is cancelled on new drag or dispose", () => {
    const f = resizeFixture();
    f.drag();
    f.resize(900);
    f.release(false);
    f.drag();
    f.resize(800);
    assert.equal(f.view.getBoundingClientRect().width, 700);
    assert.equal(f.frames.size, 0);
    f.release(false);
    f.controller.dispose();
    assert.equal(f.view.getBoundingClientRect().width, 800);
    assert.equal(f.view.style.getPropertyValue("position"), "");
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
});

test("solid header styling is optional and scoped", () => {
    const palette={mode:"dark",primary:"#202020",secondary:"#252525",elevated:"#303030"};
    const css=plugin.makeCSS(palette,{solidHeader:true});
    assert.match(css,/#page-header.*background-image:none/);
    assert.match(css,/#page-header.*mask-image:none/);
    assert.doesNotMatch(plugin.makeCSS(palette,{solidHeader:false}),/mask-image/);
});

test("hidden title bar CSS includes known headers and detected toolbar marker", () => {
    const css = plugin.makeHiddenHeaderCSS();
    assert.match(css, /#page-header/);
    assert.match(css, /#thread-header/);
    assert.match(css, /data-obsidian-hidden-toolbar/);
    assert.match(css, /#obsidian-chatgpt-sidebar-toggle/);
    assert.doesNotMatch(css, /#prompt-textarea/);
    assert.match(css, /conversation-title-button/);
    assert.match(css, /:not\(:is\(aside \*, nav \*, article \*/);
    assert.match(css, /#thread-bottom \*, form \*/);
});

test("header detector marks a bounded top navigation row and restores it", () => {
    const attrs = new Map();
    const shell = { getBoundingClientRect: () => ({width:800,top:0}), querySelectorAll: () => [control] };
    const row = {
        parentElement: shell, isConnected: true,
        matches: () => false, querySelector: () => null,
        getBoundingClientRect: () => ({width:800,height:48,top:0}),
        setAttribute: (k,v) => attrs.set(k,v),
        removeAttribute: k => attrs.delete(k)
    };
    const control = { parentElement: row, closest: () => null, hasAttribute: () => false };
    const doc = {documentElement:{},querySelector: () => shell};
    const win = {};
    const Mutation = class { observe() {} disconnect() {} };
    const run = new Function("window","document","location","MutationObserver","requestAnimationFrame","cancelAnimationFrame","enabled",
        "return ("+plugin.installHeaderHiding.toString()+")(enabled)");
    const act = enabled => run(win,doc,{protocol:"https:",hostname:"chatgpt.com",port:""},Mutation,()=>1,()=>{},enabled);
    assert.equal(act(true),true);
    assert.equal(attrs.has("data-obsidian-hidden-toolbar"),true);
    assert.equal(act(false),true);
    assert.equal(attrs.has("data-obsidian-hidden-toolbar"),false);
});

test("host sidebar button uses native icon, dispatches clicks and restores parent", () => {
    const map = new Map(), handlers = new Map();
    const style = {getPropertyValue:k=>map.get(k)?.v||"",getPropertyPriority:k=>map.get(k)?.p||"",
        setProperty:(k,v,p)=>map.set(k,{v,p}),removeProperty:k=>map.delete(k)};
    const button = {style:{},setAttribute(){}, addEventListener:(k,f)=>handlers.set(k,f),
        removeEventListener:k=>handlers.delete(k), remove(){this.removed=true;},
        appendChild(el){this.label=el;}, blur(){this.blurred=true;},
        removeAttribute(k){delete this[k];}};
    const parent = {style,appendChild(el){this.child=el;}};
    const view = {parentElement:parent,ownerDocument:{defaultView:{getComputedStyle:()=>({position:"static"})},
        createElement:tag=>tag==="button"?button:{style:{}}}};
    let clicks=0, iconName;
    const host=new plugin.HostSidebarButton(view,()=>clicks++,(el,name)=>{iconName=name;});
    assert.equal(parent.child,button);
    assert.equal(iconName,"panel-left");
    assert.equal(button.title,undefined);
    assert.equal(button.label.textContent,"Open ChatGPT sidebar");
    handlers.get("pointermove")({isTrusted:true,movementX:1,movementY:0});
    assert.equal(button.title,"Open ChatGPT sidebar");
    host.setSidebarOpen(true);
    assert.equal(button.title,undefined);
    assert.equal(button.blurred,true);
    assert.equal(button.style.display,"none");
    host.setSidebarOpen(false);
    assert.equal(button.style.display,"flex");
    handlers.get("pointermove")({isTrusted:true,movementX:0,movementY:0});
    assert.equal(button.title,undefined);
    handlers.get("pointermove")({isTrusted:false,movementX:1,movementY:0});
    assert.equal(button.title,undefined);
    handlers.get("pointermove")({isTrusted:true,movementX:1,movementY:0});
    assert.equal(button.title,"Open ChatGPT sidebar");
    handlers.get("pointerleave")();
    assert.equal(button.title,undefined);
    assert.equal(style.getPropertyValue("position"),"relative");
    handlers.get("click")({stopPropagation(){}});
    assert.equal(clicks,1);
    host.dispose();
    assert.equal(button.removed,true);
    assert.equal(style.getPropertyValue("position"),"");
    assert.equal(handlers.size,0);
});


test("divider dragging keeps pointer releases in host and restores pointer events", () => {
    const f = resizeFixture({supportsClip:true});
    f.view.style.setProperty("pointer-events","auto");
    f.drag();
    assert.equal(f.view.style.getPropertyValue("pointer-events"),"none");
    assert.equal(f.parent.style.getPropertyValue("overflow-x"),"clip");
    f.resize(450);
    f.listeners.get("pointermove")({buttons:0});
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.view.style.getPropertyValue("pointer-events"),"none");
    f.paint();f.paint();
    assert.equal(f.view.getBoundingClientRect().width,450);
    assert.equal(f.view.style.getPropertyValue("pointer-events"),"auto");
    assert.equal(f.parent.style.getPropertyValue("overflow-x"),"");
    assert.equal(f.controller.locked,false);
    f.controller.dispose();
});

test("pausing a held drag never commits; missing release recovers on button-up motion", () => {
    const f=resizeFixture();
    f.drag();f.resize(550);f.settle();
    assert.equal(f.controller.dragging,true);
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.timers.size,0);
    f.resize(450,500,1000);
    f.listeners.get("pointermove")({buttons:1});
    assert.equal(f.view.getBoundingClientRect().width,700);
    f.listeners.get("pointermove")({buttons:0});
    f.paint();f.paint();
    assert.equal(f.controller.phase,"idle");
    assert.equal(f.view.getBoundingClientRect().width,450);
    f.controller.dispose();
});

test("release waits for stable host frames after trailing size changes", () => {
    const f=resizeFixture();
    f.drag();f.resize(800);f.release(false);f.paint();
    f.resize(900,500,16);
    f.paint();
    assert.equal(f.controller.committing,true);
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.view.getBoundingClientRect().left,100);
    f.paint();
    assert.equal(f.controller.locked,false);
    assert.equal(f.view.getBoundingClientRect().width,900);
    assert.equal(f.controller.trace.some(e=>e.event==="release-host-changed"),true);
    assert.equal(f.view.style.getPropertyValue("position"),"");
    f.controller.dispose();
});

test("stalled frame callbacks cannot retain clipping after release", () => {
    const f=resizeFixture();
    f.drag();f.resize(600);f.release(false);
    const timeout=[...f.timers.values()][0];
    assert.equal(timeout.delay,220);
    timeout();
    assert.equal(f.controller.locked,false);
    assert.equal(f.frames.size,0);
    assert.equal(f.view.getBoundingClientRect().width,600);
    f.controller.dispose();
});

// The real guest bridge is asynchronous; allow promise continuations to run
// without sleeping or relying on the real browser.
async function flushPromises() {
    for (let i=0; i<8; i++) await Promise.resolve();
}
test("unsupported capture uses the single native handoff without a guest round trip",()=>{
    const phases=[];
    const f=resizeFixture({onPhase:p=>phases.push(p)});
    f.view.capturePage=()=>{throw new Error("must not capture");};
    f.view.executeJavaScript=()=>{throw new Error("must not execute guest JS");};
    f.drag();f.resize(450);f.release(false);
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.controller.phase,"settling");
    f.paint();f.paint();
    assert.deepEqual(phases,["locked","dragging","settling","idle"]);
    assert.equal(f.controller.locked,false);
    assert.equal(f.timers.size,0);
    f.controller.dispose();
});
test("new drag invalidates prior settling frames",()=>{
    const f=resizeFixture();
    f.drag();f.resize(450);f.release(false);f.paint();
    f.drag();f.resize(600);f.paint();f.paint();
    assert.equal(f.controller.dragging,true);
    assert.equal(f.view.getBoundingClientRect().width,700);
    f.release();
    assert.equal(f.view.getBoundingClientRect().width,600);
    assert.equal(f.controller.phase,"idle");
    f.controller.dispose();
});
test("workspace action prelocks once without capturing an image",()=>{
    const f=resizeFixture();
    const target={closest:selector=>selector.includes(".workspace-tab-header-inner-close-button")?{}:null};
    f.listeners.get("pointerdown")({button:0,target});
    f.listeners.get("click")({target});
    f.resize(1300,500,16);
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.controller.trace.filter(e=>e.event==="lock").length,1);
    f.settle();
    assert.equal(f.view.getBoundingClientRect().width,1300);
    assert.equal(f.controller.phase,"idle");
    f.controller.dispose();
});
test("middle-click and keyboard close prelock any affected webview",()=>{
    const f=resizeFixture();
    f.listeners.get("pointerdown")({button:1,target:{closest:s=>s===".workspace-tab-header"?{}:null}});
    f.resize(900,500,16);
    assert.equal(f.view.getBoundingClientRect().width,700);
    f.settle();
    f.listeners.get("keydown")({key:"w",metaKey:true});
    f.resize(500,500,16);
    assert.equal(f.view.getBoundingClientRect().width,900);
    f.settle();
    assert.equal(f.view.getBoundingClientRect().width,500);
    f.controller.dispose();
});
test("no-op workspace action leaves no lock or styles",()=>{
    const f=resizeFixture();
    f.sidebar();f.settle();
    assert.equal(f.controller.locked,false);
    assert.equal(f.view.style.getPropertyValue("position"),"");
    assert.equal(f.timers.size,0);
    f.controller.dispose();
});
test("workspace close and split menus are recognized without matching unrelated items",()=>{
    const target=label=>({closest:s=>s.includes(".menu-item")?{textContent:label}:null});
    assert.equal(plugin.isWorkspaceLayoutAction(target("Close tab")),true);
    assert.equal(plugin.isWorkspaceLayoutAction(target("Close all tabs")),true);
    assert.equal(plugin.isWorkspaceLayoutAction(target("Split right")),true);
    assert.equal(plugin.isWorkspaceLayoutAction(target("Close dialog")),false);
    assert.equal(plugin.isWorkspaceLayoutAction(target("Open note")),false);
});

test("warm sidebar stays natively open between repeated visual toggles", () => {
    const f=sidebarFixture({open:false,warm:true});
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-warm"),false);
    f.button.click();f.flush();
    assert.equal(f.clicks,1);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-warm"),true);
    assert.match(f.style.textContent,/data-obsidian-sidebar-warm.*aside\.app-shell-left-panel \{ opacity:0 !important/);
    f.userClick();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"),"false");
    assert.equal(f.shell.getAttribute("data-app-shell-sidebar-open"),"true");
    assert.equal(f.clicks,1);
    f.button.click();f.flush();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"),"true");
    f.backdrop.click();f.flush();
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"),"false");
    assert.equal(f.clicks,1);
    f.install(false);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-warm"),false);
});
test("disabling warm sidebar restores normal sidebar lifecycle without reload", () => {
    const f=sidebarFixture({warm:true});
    f.button.click();f.flush();f.backdrop.click();f.flush();
    assert.equal(f.clicks,0);
    f.install(true,false);f.flush();
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-warm"),false);
    f.button.click();f.flush();f.backdrop.click();f.flush();
    assert.equal(f.clicks,1);
    assert.equal(f.shell.getAttribute("data-app-shell-sidebar-open"),"false");
    f.install(false);
});

test("host icon waits for two visually closed guest frames",()=>{
    const f=sidebarFixture({warm:true,animatedClose:true});
    f.button.click();f.flush();f.userClick();
    assert.equal(f.hidden(),true);
    assert.equal(f.messages.at(-1),"chatgpt-theme-sync:sidebar:open");
    f.flush();f.flush();
    assert.equal(f.hidden(),true);
    f.setOpacity("0");f.flush();
    assert.equal(f.hidden(),true);
    f.flush();
    assert.equal(f.hidden(),false);
    assert.equal(f.messages.at(-1),"chatgpt-theme-sync:sidebar:closed");
    assert.equal(f.timers.size,0);
    f.install(false);
});
test("reopening cancels pending icon reveal and close timeout recovers",()=>{
    const f=sidebarFixture({warm:true,animatedClose:true});
    f.button.click();f.flush();f.userClick();
    f.button.click();f.flush();
    assert.equal(f.hidden(),true);
    assert.equal(f.timers.size,0);
    assert.equal(f.messages.filter(m=>m.endsWith(":closed")).length,1);
    f.userClick();
    const timeout=[...f.timers.values()][0];
    timeout();
    assert.equal(f.hidden(),false);
    assert.equal(f.messages.at(-1),"chatgpt-theme-sync:sidebar:closed");
    f.install(false);
});

test("launcher home only opens a URL, ignoring removed automation settings",()=>{
    const dest=plugin.launcherDestination({launcherMode:"home",launcherPrompt:"Hello",launcherPlugin:"@Professor Toy"});
    assert.equal(dest.url,"https://chatgpt.com/");
    assert.equal(Object.keys(dest).join(","),"url");
});
test("restricts injection for launcher URLs to ChatGPT",()=>{
    const dest=plugin.launcherDestination({launcherMode:"chat",launcherURL:" https://chatgpt.com/c/123 ",launcherPrompt:"ignored"});
    assert.equal(dest.url,"https://chatgpt.com/c/123");
    assert.equal(Object.keys(dest).join(","),"url");
    assert.equal(plugin.launcherDestination({launcherMode:"chat",launcherURL:"https://chatgpt.com.evil.test/"}),null);
    assert.equal(plugin.launcherDestination({launcherMode:"chat",launcherURL:""}),null);
});
test("launcher opens a fresh Web Viewer tab and cleans up failed tabs",async ()=>{
    let tabType, state, detached=false;
    const leaf={view:{getViewType:()=>"webviewer"},setViewState:async value=>{state=value;},detach(){detached=true;}};
    const workspace={getLeaf:type=>{tabType=type;return leaf;}};
    assert.equal(await plugin.openLauncherTab(workspace,{url:"https://chatgpt.com/"}),leaf);
    assert.equal(tabType,"tab");
    assert.equal(state.type,"webviewer");
    assert.equal(state.active,true);
    assert.equal(state.state.navigate,true);
    assert.equal(state.state.url,"https://chatgpt.com/");
    leaf.setViewState=async()=>{throw Error("unavailable");};
    try {await plugin.openLauncherTab(workspace,{url:"https://chatgpt.com/"});} catch {}
    assert.equal(detached,true);
});
test("launcher explicitly reveals and activates its new leaf",async()=>{
    let revealed,active;
    const leaf={setViewState:async()=>{}};
    await plugin.openLauncherTab({getLeaf:()=>leaf,revealLeaf:async l=>{revealed=l;},
        setActiveLeaf:l=>{active=l;}},{url:"https://chatgpt.com/"});
    assert.equal(revealed,leaf);
    assert.equal(active,leaf);
});

test("header detector hides a replacement row while the old row stays connected",()=>{
    const rows=[],controls=[],frames=new Map();let observer,next=0;
    const shell={getBoundingClientRect:()=>({width:800,top:0}),querySelectorAll:()=>controls};
    function addRow() {
        const attrs=new Set();
        const row={isConnected:true,parentElement:shell,matches:()=>false,querySelector:()=>null,
            getBoundingClientRect:()=>({width:800,height:48,top:0}),
            setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k),attrs};
        const control={parentElement:row,hasAttribute:()=>false,
            closest:()=>attrs.has("data-obsidian-hidden-toolbar")?row:null};
        rows.push(row);controls.push(control);return row;
    }
    const old=addRow(),win={},doc={documentElement:{},querySelector:()=>shell};
    const Mutation=class{constructor(fn){observer=fn;}observe(){}disconnect(){}};
    const run=new Function("window","document","location","MutationObserver","requestAnimationFrame","cancelAnimationFrame","enabled",
        "return ("+plugin.installHeaderHiding.toString()+")(enabled)");
    const act=enabled=>run(win,doc,{protocol:"https:",hostname:"chatgpt.com",port:""},Mutation,
        fn=>{frames.set(++next,fn);return next;},id=>frames.delete(id),enabled);
    act(true);
    assert.equal(old.attrs.has("data-obsidian-hidden-toolbar"),true);
    const replacement=addRow();
    observer([{type:"childList",addedNodes:[{nodeType:1,querySelector:()=>controls.at(-1)}]}]);
    for(const [id,fn] of [...frames]){frames.delete(id);fn();}
    assert.equal(replacement.attrs.has("data-obsidian-hidden-toolbar"),true);
    act(false);
    assert.equal(old.attrs.size,0);
    assert.equal(replacement.attrs.size,0);
});

test("open sidebar intent survives repeated breakpoint crossings",()=>{
    const f=sidebarFixture({open:false,warm:true});
    f.setOpen(true);f.flush();
    assert.equal(f.snapshot().desired,true);
    for (const w of [750,900,700,1100]) {
        f.width(w);
        assert.equal(f.snapshot().desired,true);
        assert.equal(f.snapshot().layout,w>=769?"compact":"native");
    }
    f.install(false);
});
test("closed warm sidebar does not reopen when crossing into native layout",()=>{
    const f=sidebarFixture({open:true,warm:true});
    assert.equal(f.snapshot().desired,false);
    f.width(700);f.flush();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.snapshot().native,false);
    f.width(900);f.flush();
    assert.equal(f.snapshot().desired,false);
    f.install(false);
});
test("resize defers native commands and preserves desired state through hydration",()=>{
    const f=sidebarFixture({open:true,warm:true});
    f.setOpen(true);f.flush();
    f.setResizePhase("dragging");f.width(700);
    f.nativeSet(false);
    assert.equal(f.snapshot().desired,true);
    assert.equal(f.snapshot().native,false);
    assert.equal(f.clicks,0);
    f.setResizePhase("settling");
    assert.equal(f.clicks,0);
    f.setResizePhase("idle");f.flush();
    assert.equal(f.clicks,1);
    assert.equal(f.snapshot().native,true);
    assert.equal(f.snapshot().desired,true);
    f.install(false);
});
test("rapid explicit requests wait for delayed native acknowledgement",()=>{
    const f=sidebarFixture({open:false,delayed:true});
    f.setOpen(true);f.setOpen(true);f.setOpen(false);
    assert.equal(f.clicks,1);
    assert.equal(f.pending(),1);
    f.ack();
    assert.equal(f.clicks,2);
    assert.equal(f.snapshot().desired,false);
    f.ack();
    assert.equal(f.snapshot().native,false);
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.pending(),0);
    f.install(false);
});
test("session ignores stale guest snapshots and commands after navigation",async()=>{
    const s=new plugin.WebviewSession({});
    const id=s.sessionId;
    const visible=[];
    s.hostSidebar={setSidebarOpen:v=>visible.push(v)};
    assert.equal(s.acceptSidebar({sessionId:id,sequence:2,hidden:true}),true);
    assert.equal(s.acceptSidebar({sessionId:id,sequence:1,hidden:false}),false);
    assert.deepEqual(visible,[true]);
    let resolve;
    const pending=s.sidebarEffect(()=>new Promise(r=>resolve=r));
    await flushPromises();
    s.generation++;s.invalidateSidebar();
    resolve(true);
    assert.equal(await pending,false);
    assert.equal(s.acceptSidebar({sessionId:id,sequence:3,hidden:true}),false);
    assert.equal(s.acceptSidebar({sessionId:s.sessionId,sequence:1,hidden:false}),true);
    assert.deepEqual(visible,[true,false]);
});
test("session coalesces superseded resize effects and serializes commands",async()=>{
    const calls=[];
    const view={getURL:()=>"https://chatgpt.com/",executeJavaScript:async code=>calls.push(code)};
    const s=new plugin.WebviewSession(view);s.sidebarEnabled=true;
    s.setResizePhase("locked");s.setResizePhase("dragging");
    await s.sidebarQueue;
    assert.equal(calls.length,1);
    assert.match(calls[0],/dragging/);
    s.setResizePhase("settling");s.setResizePhase("idle");
    await s.sidebarQueue;
    assert.equal(calls.length,2);
    assert.match(calls[1],/idle/);
});

test("breakpoint handoff hides a stale warm native panel until narrow layout settles",()=>{
    const f=sidebarFixture({open:true,warm:true,timed:true});
    f.width(700);
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.clicks,0);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-reconciling"),true);
    f.runTimer(96);f.flush();
    assert.equal(f.clicks,1);
    assert.equal(f.snapshot().native,false);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-reconciling"),false);
    f.install(false);
    assert.equal(f.timers.size,0);
});
test("missing native toggle times out and restores the host open control",()=>{
    const f=sidebarFixture({open:false,nativeReady:false,timed:true});
    f.setOpen(true);
    assert.equal(f.snapshot().phase,"opening");
    assert.equal(f.hidden(),false);
    f.runTimer(750);
    f.runTimer(900);
    assert.equal(f.hidden(),false);
    assert.equal(f.snapshot().desired,false);
    f.install(false);
    assert.equal(f.timers.size,0);
});

test("host mode prewarms desktop sidebar without hiding the host opener",()=>{
    const f=sidebarFixture({open:false,warm:true,hostManaged:true,delayed:true});
    assert.equal(f.clicks,1);
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    assert.equal(f.button.parentElement,null);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-host-managed"),true);
    f.ack();f.flush();
    assert.equal(f.snapshot().native,true);
    assert.equal(f.root.hasAttribute("data-obsidian-sidebar-warm"),true);
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"),"false");
    assert.equal(f.hidden(),false);
    f.setOpen(true);f.flush();
    assert.equal(f.clicks,1);
    assert.equal(f.hidden(),true);
    assert.equal(f.snapshot().phase,"open");
    f.userClick();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    assert.equal(f.snapshot().native,true);
    f.install(false);
});
test("closed host sidebar remains closed and button visible across rapid narrow hydration",()=>{
    const f=sidebarFixture({open:true,warm:true,hostManaged:true,timed:true});
    f.setResizePhase("dragging");
    for (const w of [700,900,720,850,600]) {
        f.width(w);f.nativeSet(true);
        assert.equal(f.snapshot().desired,false);
        assert.equal(f.hidden(),false);
        assert.equal(f.root.getAttribute("data-obsidian-sidebar-intent"),"false");
        assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"),"false");
        assert.equal(f.root.hasAttribute("data-obsidian-compact-sidebar"),true);
    }
    assert.equal(f.clicks,0);
    f.setResizePhase("idle");f.runTimer(96);f.flush();
    assert.equal(f.snapshot().native,false);
    assert.equal(f.hidden(),false);
    // A late React native OPEN must not become plugin intent.
    f.nativeSet(true);f.flush();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    f.width(900);f.runTimer(96);f.flush();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    assert.equal(f.snapshot().native,true);
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-visible"),"false");
    f.install(false);
});
test("failed narrow native close never reveals a sidebar or hides its host button",()=>{
    const f=sidebarFixture({open:true,warm:true,hostManaged:true,wide:false,timed:true,delayed:true});
    assert.equal(f.clicks,1);
    f.runTimer(750);f.flush();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    assert.equal(f.root.getAttribute("data-obsidian-sidebar-intent"),"false");
    f.nativeSet(true);
    assert.equal(f.clicks,1);
    f.setOpen(true);f.flush();
    assert.equal(f.hidden(),true);
    f.install(false);
});
test("host-managed native opener cannot change closed intent",()=>{
    const f=sidebarFixture({open:true,warm:true,hostManaged:true});
    f.userClick();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    f.setOpen(true);
    f.userClick();
    assert.equal(f.snapshot().desired,false);
    assert.equal(f.hidden(),false);
    f.install(false);
});

test("sidebar-free CSS hides only navigation and collapses the rail", () => {
    const css = plugin.makeSidebarFreeCSS();
    assert.match(css, /--app-shell-left-panel-width:0px/);
    assert.match(css, /#app-shell-sidebar/);
    assert.match(css, /#browser-sidebar-popover/);
    assert.doesNotMatch(css, /role=dialog|#prompt-textarea|article|@media/);
});
test("native navigation invokes existing controls without touching composer", () => {
    let clicks = 0;
    const button = {disabled:false,getAttribute:()=>null,closest:()=>null,click:()=>clicks++};
    const doc = {querySelectorAll:s=>s.includes("search-chats-button")?[button]:[]};
    const run = new Function("document","location","action","return ("+plugin.invokeNativeNavigation.toString()+")(action)");
    const location = {protocol:"https:",hostname:"chatgpt.com",port:""};
    assert.equal(run(doc,location,"search"),true);
    assert.equal(run(doc,location,"new"),false);
    assert.equal(run(doc,{...location,hostname:"example.com"},"search"),false);
    assert.equal(clicks,1);
});

test("lost pointer capture and descendant blur never end a held drag", () => {
    const f = resizeFixture();
    f.drag(); f.resize(500);
    f.listeners.get("lostpointercapture")({buttons:0});
    f.listeners.get("blur")({target:{}});
    f.listeners.get("pointerup")({buttons:1});
    f.settle();
    assert.equal(f.controller.dragging,true);
    assert.equal(f.view.getBoundingClientRect().width,700);
    f.resize(420);
    f.release();
    assert.equal(f.view.getBoundingClientRect().width,420);
    assert.equal(f.controller.trace.filter(e=>e.event==="native-layout-restored").length,1);
    f.controller.dispose();
});
test("release keeps clipping and centering through multiple trailing host changes", () => {
    const f = resizeFixture();
    f.drag(); f.resize(600); f.release(false);
    f.paint(); f.resize(560,500,16); f.paint(); f.resize(520,500,16); f.paint();
    assert.equal(f.controller.committing,true);
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.view.getBoundingClientRect().left,-90);
    assert.equal(f.controller.trace.some(e=>e.event==="native-layout-restored"),false);
    f.paint();
    assert.equal(f.view.getBoundingClientRect().width,520);
    assert.equal(f.controller.trace.filter(e=>e.event==="native-layout-restored").length,1);
    f.controller.dispose();
});

test("release waits for host position as well as size without ResizeObserver events", () => {
    const f=resizeFixture();
    f.drag(); f.resize(500); f.release(false);
    f.paint(); f.moveHost(40); f.paint();
    assert.equal(f.controller.committing,true);
    assert.equal(f.view.getBoundingClientRect().width,700);
    f.paint(); f.paint();
    assert.equal(f.controller.locked,false);
    assert.equal(f.view.getBoundingClientRect().left,40);
    assert.equal(f.view.getBoundingClientRect().width,500);
    f.controller.dispose();
});

// Simulate the release-only frozen frame without accessing a real chat.
function frozenResizeFixture() {
    const f = resizeFixture();
    const layers = [];
    let captures = 0;
    const pending = [];
    const element = () => ({
        style:{setProperty(k,v){this[k]=v;}}, setAttribute(){},
        appendChild(child){this.child=child;},
        remove(){const i=layers.indexOf(this);if(i>=0) layers.splice(i,1);},
        decode:async()=>{},
    });
    f.view.ownerDocument.createElement = element;
    f.parent.appendChild = layer => layers.push(layer);
    f.view.getURL = ()=>"https://chatgpt.com/";
    f.view.capturePage = async()=>{++captures;return {toDataURL:()=>"data:image/png;base64,AA==" };};
    f.view.executeJavaScript = ()=>new Promise(resolve=>pending.push(resolve));
    return {...f,layers,pending,captures:()=>captures};
}
test("frozen old viewport remains visible until the resized guest is ready",async()=>{
    const f=frozenResizeFixture();
    f.drag(); f.resize(900); f.paint();
    assert.equal(f.captures(),0);
    f.release(false); await flushPromises();
    assert.equal(f.captures(),1);
    f.paint(); f.paint();
    assert.equal(f.layers.length,1);
    assert.equal(f.layers[0].child.style.left,"calc(50% - 350px)");
    assert.equal(f.layers[0].child.style["clip-path"],"inset(0 2px)");
    assert.equal(f.view.getBoundingClientRect().width,700);
    f.paint(); f.paint();
    assert.equal(f.view.getBoundingClientRect().width,900);
    assert.equal(f.layers.length,1);
    assert.equal(f.controller.committing,true);
    f.paint();
    assert.equal(f.pending.length,1);
    f.pending[0]({ready:true}); await flushPromises();
    assert.equal(f.layers.length,1);
    f.paint();
    assert.equal(f.layers.length,0);
    assert.equal(f.controller.phase,"idle");
    assert.equal(f.controller.trace.filter(e=>e.event==="native-layout-restored").length,1);
    f.controller.dispose();
});
test("late guest readiness cannot remove a newer cover after a new drag",async()=>{
    const f=frozenResizeFixture();
    f.drag(); f.resize(500); f.release(false); await flushPromises();
    f.paint(); f.paint(); f.paint(); f.paint(); f.paint();
    assert.equal(f.pending.length,1);
    f.drag();
    assert.equal(f.layers.length,0);
    f.resize(400);
    f.pending[0]({ready:true}); await flushPromises(); f.paint();
    assert.equal(f.controller.dragging,true);
    assert.equal(f.view.getBoundingClientRect().width,500);
    f.controller.dispose();
    assert.equal(f.layers.length,0);
    assert.equal(f.timers.size,0);
});
test("capture failure preserves normal stable-host release",async()=>{
    const f=frozenResizeFixture();
    f.view.capturePage=async()=>{throw Error("capture unavailable");};
    f.drag(); f.resize(500); f.release(false); await flushPromises();
    f.paint(); f.paint();
    assert.equal(f.layers.length,0);
    assert.equal(f.view.getBoundingClientRect().width,500);
    assert.equal(f.controller.phase,"idle");
    f.controller.dispose();
});
test("guest timeout removes the cover even if the guest never replies",async()=>{
    const f=frozenResizeFixture();
    f.drag();f.resize(500);f.release(false);await flushPromises();
    f.paint();f.paint();f.paint();f.paint();f.paint();
    assert.equal(f.layers.length,1);
    const deadline=[...f.timers.values()].find(fn=>fn.delay===350);
    assert.ok(deadline); deadline();
    assert.equal(f.layers.length,0);
    assert.equal(f.controller.phase,"idle");
    assert.equal(f.view.getBoundingClientRect().width,500);
    f.controller.dispose();
});

test("fixed viewport suppresses decorative edges without changing border widths",()=>{
    const f=resizeFixture();
    f.view.style.setProperty("border-left-color","red");
    f.view.style.setProperty("border-left-width","1px");
    f.view.style.setProperty("box-shadow","0 0 1px black");
    f.view.style.setProperty("clip-path","inset(0 1px)");
    f.drag();f.resize(900);
    assert.equal(f.view.style.getPropertyValue("clip-path"),"inset(0 2px)");
    assert.equal(f.view.getBoundingClientRect().width,700);
    assert.equal(f.view.style.getPropertyValue("border-left-color"),"transparent");
    assert.equal(f.view.style.getPropertyValue("border-left-width"),"1px");
    assert.equal(f.view.style.getPropertyValue("box-shadow"),"none");
    f.release();
    assert.equal(f.view.style.getPropertyValue("border-left-color"),"red");
    assert.equal(f.view.style.getPropertyValue("box-shadow"),"0 0 1px black");
    assert.equal(f.view.style.getPropertyValue("clip-path"),"inset(0 1px)");
    f.controller.dispose();
});
test("sidebar-free shell matches the conversation canvas rather than sidebar background",()=>{
    const css=plugin.makeCSS({mode:"dark",primary:"#222222",secondary:"#191919",elevated:"#292929"},{matchSidebar:true,sidebarFreeMode:true});
    assert.match(css,/--app-color-background-shell: #222222/);
    assert.match(css,/--app-color-background-surface-under: #222222/);
    assert.match(plugin.makeSidebarFreeCSS(),/border-inline-color:transparent/);
});


test("accent and selection use the actual appearance tokens independently",()=>{
    const palette={mode:"dark",primary:"#1c1c1c",accent:"#7654cc",accentHover:"#8967df",selection:"rgba(118, 84, 204, 0.3)"};
    const selection=plugin.makeAccentCSS(palette,{matchAccent:false,matchSelection:true});
    assert.match(selection,/--color-background-text-selection: rgba\(118, 84, 204, 0\.3\)/);
    assert.match(selection,/html \*::selection/);
    assert.doesNotMatch(selection,/--color-background-composer-primary|--color-background-user-message/);
    const accent=plugin.makeAccentCSS(palette,{matchAccent:true,matchSelection:false});
    assert.match(accent,/--color-background-composer-primary: #664aac/);
    assert.match(accent,/--color-text-composer-primary: #ffffff/);
    assert.match(accent,/--codex-base-accent: #7654cc/);
    assert.match(accent,/--color-background-accent-solid-hover: #8967df/);
    assert.match(accent,/--color-background-user-message: #45356b/);
    assert.match(accent,/--color-text-user-message: #ffffff/);
    assert.match(accent,/--user-message-background-luminance: 0\./);
    assert.match(accent,/--app-color-icon-accent: #[0-9a-f]{6}/);
    assert.match(accent,/html\[data-theme\]/);
    assert.doesNotMatch(accent,/::selection|--color-background-text-selection|--blue-\d+|font-family|--text-primary|--theme-submit-btn-bg/);
    assert.equal(plugin.makeAccentCSS(palette,{matchAccent:false,matchSelection:false}),"");
});
test("accent roles maintain foreground contrast and distinct bubble shades",()=>{
    assert.equal(plugin.accentForeground("#101010"),"#ffffff");
    assert.equal(plugin.accentForeground("#eeeeee"),"#000000");
    const css=plugin.makeAccentCSS({mode:"light",primary:"#ffffff",accent:"#ffee00"},{matchAccent:true});
    assert.match(css,/--color-text-composer-primary: #ffffff/);
    assert.doesNotMatch(css,/--color-background-composer-primary: #fffcd9/);
    assert.match(css,/--color-text-user-message: #000000/);
    assert.match(css,/--color-background-user-message: #fffcd9/);
});

test("host palette watcher tracks root/body attributes and cleans up",()=>{
    const watched=[], disconnected=[], listeners=new Map();
    class Observer {
        constructor(callback){this.callback=callback;}
        observe(el,options){watched.push({el,options,observer:this});}
        disconnect(){disconnected.push(this);}
    }
    const doc={documentElement:{},body:{},head:{},defaultView:{MutationObserver:Observer},
        addEventListener:(type,callback)=>listeners.set(type,callback),
        removeEventListener:(type)=>listeners.delete(type)};
    const instance=Object.create(plugin.prototype);
    instance.paletteWatchers=new Map();instance.paletteCache=new WeakMap();
    const changes=[];
    instance.schedulePaletteRefresh=d=>changes.push(d);
    instance.watchPalette(doc);
    assert.equal(watched.length,3);
    assert.equal(watched[0].el,doc.documentElement);
    assert.equal(watched[1].el,doc.body);
    assert.deepEqual(watched[1].options.attributeFilter,["style","class","data-theme"]);
    assert.equal(watched[1].options.subtree,undefined);
    watched[1].observer.callback([]);
    listeners.get("input")({target:{matches:()=>true}});
    assert.deepEqual(changes,[doc,doc]);
    instance.watchPalette(doc);
    assert.equal(watched.length,3);
    instance.unwatchPalette(doc);
    assert.equal(disconnected.length,2);
    assert.equal(listeners.size,0);
    assert.equal(instance.paletteWatchers.size,0);
});

test("composer action resolves the current brighter accent even under a local theme override",()=>{
    const settings={matchAccent:true};
    const palette={mode:"dark",primary:"#1c1c1c",accent:"#7654cc"};
    for (const accent of ["#7654cc","#26b58a"]) {
        const css=plugin.makeAccentCSS({...palette,accent},settings);
        const bubble=css.match(/--color-background-user-message: (#[0-9a-f]{6})/)[1];
        const composer=css.match(/--color-background-composer-primary: (#[0-9a-f]{6})/)[1];
        const rule=css.match(/html \.bg-composer-primary, html \.text-composer-primary \{[^}]+\}/)[0];
        assert.notEqual(composer,bubble);
        assert.ok(rule.includes("--color-background-composer-primary: "+composer+" !important"));
        assert.ok(rule.includes("--color-text-composer-primary: #ffffff !important"));
    }
    assert.doesNotMatch(plugin.makeAccentCSS({...palette,selection:"#654321"},{matchSelection:true}),/\.bg-composer-primary/);
});

test("color scheme cleanup only detaches the owned guest debugger",async()=>{
    const calls=[];
    const debug={isAttached:()=>true,sendCommand:async(...args)=>calls.push(args),detach:()=>calls.push("detach")};
    const instance=Object.create(plugin.prototype);
    const state={appearanceDebugger:debug,appearanceMode:"light"};
    await instance.clearGuestAppearance(state);
    assert.deepEqual(calls,[["Emulation.setEmulatedMedia",{media:"",features:[]}],"detach"]);
    assert.equal(state.appearanceDebugger,null);
    assert.equal(state.appearanceMode,null);
    await instance.clearGuestAppearance(state);
    assert.equal(calls.length,2);
});

test("host bottom clearance reserves space in the pane and restores existing styles", () => {
    const map = new Map([["padding-bottom", {v:"5px", p:""}]]);
    const style = {getPropertyValue:k=>map.get(k)?.v||"",getPropertyPriority:k=>map.get(k)?.p||"",
        setProperty:(k,v,p)=>map.set(k,{v,p}),removeProperty:k=>map.delete(k)};
    const pane = {style}, view = {};
    const clearance = new plugin.WebviewBottomClearance(view, pane);
    assert.equal(style.getPropertyValue("padding-bottom"), "12px");
    assert.equal(style.getPropertyPriority("padding-bottom"), "important");
    assert.equal(style.getPropertyValue("box-sizing"), "border-box");
    clearance.dispose();
    assert.equal(style.getPropertyValue("padding-bottom"), "5px");
    assert.equal(style.getPropertyValue("box-sizing"), "");
});

test("host bottom clearance does not overwrite styles changed by another owner", () => {
    const map = new Map();
    const style = {getPropertyValue:k=>map.get(k)?.v||"",getPropertyPriority:k=>map.get(k)?.p||"",
        setProperty:(k,v,p)=>map.set(k,{v,p}),removeProperty:k=>map.delete(k)};
    const clearance = new plugin.WebviewBottomClearance({}, {style});
    style.setProperty("padding-bottom", "30px", "important");
    clearance.dispose();
    assert.equal(style.getPropertyValue("padding-bottom"), "30px");
});
