# Obsidian ChatGPT Native

A small desktop-only Obsidian plugin for the built-in Web Viewer. It uses Electron's insertCSS API to apply the current Obsidian palette to ChatGPT's surfaces. No dependencies, npm installation, external services, or chat-content access. The optional sidebar control uses a local DOM-only script to invoke ChatGPT’s native toggle.

## Install

1. Copy main.js and manifest.json into your vault's .obsidian/plugins/obsidian-chatgpt-native/ directory.
2. Enable Obsidian ChatGPT Native in Settings > Community plugins. Reload Obsidian if it does not appear.
3. Set ChatGPT to Adapt to system. With Match background enabled, the plugin attempts per-Web Viewer color-scheme emulation when Obsidian differs from the OS. This uses Electron’s existing debugger API and is unavailable when the guest debugger is occupied (including DevTools) or the runtime does not expose it. It does not change account preferences or the system theme. Open ChatGPT in the core Web Viewer.

Settings are grouped into Appearance, Navigation, Performance, Launcher, and Tools. Colors follow Obsidian automatically, including accent and selection changes. All toggle settings are enabled for fresh installations. Sidebar-free navigation takes precedence over legacy sidebar controls. The launcher opens a new chat by default. Existing saved preferences are retained. Other sites are never targeted; disabling the plugin removes its CSS from open tabs.

## Notes

The plugin targets ChatGPT's semantic appearance tokens, preserving typography and syntax highlighting. ChatGPT's internal CSS tokens are not a public API, so future UI updates can require adjustments.

## Development

The installable plugin is still **main.js + manifest.json**; users do not need npm or a build step. For development, edit the JavaScript source modules under src/ and run `python3 build.py` to rebuild main.js, then `node --test test.js`. The bundle is a deterministic, dependency-free concatenation, so guest functions remain self-contained for Electron executeJavaScript.

Source layout: entry-header.js (defaults, URL and launcher); theme.js and surface-css.js (CSS); guest-sidebar.js (guest sidebar state machine); guest-header.js (header detection); resize.js (host resize state machine); host-background.js and host-sidebar.js (host DOM adapters); session.js (per-webview lifecycle and ordered guest bridge); plugin.js (Obsidian integration); settings.js and exports.js. Actual Electron integration requires testing inside Obsidian.

## Sidebar toggle

Enable **Always show sidebar toggle** to show a header button and an overlay sidebar at desktop widths, while leaving the native narrow layout unchanged. It invokes ChatGPT’s own sidebar action and respects its responsive layout. At desktop width the plugin owns overlay visibility independently of ChatGPT’s restored sidebar state. The root-level compact CSS is applied immediately, even before the shell or header is hydrated. A fallback header toggle is available when the native New chat control is absent. Explicit open/close actions use ChatGPT’s native toggle when needed. Narrow layouts remain native. It is independent of theme matching and is removed when disabled. The control depends on ChatGPT’s current interface selectors.

## Square outer corners

Enabled by default. Removes rounding from ChatGPT's application frame independently of color matching, while preserving rounded controls and content. Toggle it in plugin settings.

## Hide Web Viewer address bar

Optional, off by default. Hides the native address bar/toolbar only for verified ChatGPT Web Viewer pages. The bar is restored during navigation, on other sites, when the option is turned off, and on plugin unload. Use the Obsidian command **Obsidian ChatGPT Native: Toggle ChatGPT address bar** or assign it a hotkey. The host selector depends on Obsidian's internal Web Viewer markup.

## Performance mode (0.3.0)

Opt in under Settings > Obsidian ChatGPT Native > Performance. Removes expensive backdrop blur and selected sidebar shadows/transitions. It does not disable GPU acceleration, resize the guest artificially, delete conversation content, or suspend streaming. The plugin also caches theme palettes, debounces host layout scans and avoids sidebar rescans on ordinary message mutations or every resize pixel, regardless of mode.

**Optimize long conversations (experimental)** additionally applies native Chromium content-visibility to supported offscreen conversation-turn articles (not the last or focused turn). It is off by default and only active with performance mode. This may change scroll anchoring or cause late rendering; disable it if that happens. Unsupported ChatGPT layouts simply do not receive this optimization. Neither setting guarantees a fix for Electron's underlying resize/compositing overhead.

Both settings apply live to ChatGPT tabs only. Disabling performance mode removes its CSS.

## Resize and sidebar stability (0.9.1 — current)

The host viewport returns directly to its real Obsidian layout at release; settling frames now only coordinate sidebar effects, not a second geometry change. The Obsidian button owns opening at every viewport width whenever compact sidebar or hidden header is enabled. Responsive native state changes cannot open a closed plugin sidebar; the closed CSS persists through breakpoint crossings. The host opener stays visible during hidden prewarming and unacknowledged opening. Desktop sidebar warming is enabled on upgrade, retains native content behind the closed overlay, and prewarms once after entering desktop layout. Narrow native modal sidebars are not prewarmed, since hidden modal focus/scroll locks could interfere with the chat. Native dismissals and close controls still work. No screenshots or external dependencies.

## Architecture refactor (0.9.0)

- A per-webview WebviewSession owns navigation generation, resize phase and the versioned sidebar bridge. Guest commands are serialized; stale session snapshots and superseded resize messages are rejected.
- Sidebar intent, observed native state, responsive layout and transition phase are separate. The 769 px breakpoint changes rendering strategy without resetting intent. Native toggles are acknowledged before another command is issued; unacknowledged requests recover to a usable control. Closing a warm desktop overlay does not unmount native content. Keep compact sidebar warm is now an independent setting, migrated from the previous Performance Mode preference.
- Smooth resize uses one fixed-viewport lock per held divider gesture, then a bounded two-stable-frame wait with the original viewport still locked, followed by one native-layout handoff. When supported, one memory-only frozen frame covers the native viewport handoff until the guest reports three matching animation frames. Capture is attempted only after release and is bounded to 120 ms; guest reveal is bounded to 350 ms. No disk writes, per-drag-frame capture, or duplicate live webview. Pausing while holding the divider does not end the gesture. Pointer release, cancellation, actual window blur and button-up motion recover the gesture. Lost pointer capture and descendant focus changes do not end a held drag. The release wait is capped at 220 ms. Unsupported geometry falls back to native layout.
- The narrow sidebar uses a short, bounded reconciliation window across breakpoint changes; resize-phase events defer native toggle commands until the host has settled. ChatGPT still owns the actual native panel and rendering.
- Refresh ChatGPT after upgrading to replace the injected guest controller. The old release notes below are historical, not the current resize or sidebar behavior.

For live validation, compare native resizing (Smooth resize off) and the simplified lock (on), with warm sidebar both off and on. Exercise 769 px crossings, repeated host sidebar open/close, a held divider pause, and sidebar toggles during settling. Use the existing resize diagnostics and guest DevTools to distinguish host layout from guest compositor glitches. Unit tests model browser events; they are not a GPU presentation guarantee.

## Smooth resize (0.5.8, experimental)

Locks the guest before divider drags and recognized sidebar-toggle clicks. A host ResizeObserver detects other continuous changes (two size changes within 60 ms) and locks at the current dimensions; isolated changes remain native. Commits the final viewport immediately on divider release, or after 48 ms of stable host size for animated changes, with a 1.2 second cap. The clipped absolute container is kept for two host animation frames (80 ms maximum) before native styles are restored, to avoid changing layout mode and guest dimensions in the same paint. This is best effort, not a GPU frame guarantee. The first two frames of unrecognized animations may still resize natively. No screenshots, guest suspension, or artificial viewport scaling. The fixed-width viewport stays horizontally centered during both expansion and contraction, clipping or exposing background on both sides instead of anchoring to the left. CSS handles the centering without additional per-frame JavaScript style writes. Vertical anchoring is unchanged. Unsupported layouts fall back to native resizing.

## Diagnose remaining paint artifacts (0.5.4)

Run **Obsidian ChatGPT Native: Inspect ChatGPT Web Viewer** from the command palette. It reports the host Electron/Chromium versions (also logged in the Obsidian console) and opens the guest DevTools when available. In Performance, leave screenshots off if the conversation is private, record a pane close/expand, and examine resize/layout/paint/raster events. Compare with a simple page in Web Viewer and with ChatGPT in standalone Chrome; this helps isolate guest rendering from the host compositor. No automatic recording or capture is performed.

## Match Web Viewer background (0.5.5)

Enabled by default with theme matching. Paints the host webview and its immediate container in the Obsidian primary color, with the corresponding CSS color-scheme. Guest canvas color-scheme follows the matching ChatGPT theme, with a fallback for an uninitialized root when the preferred scheme agrees. No overlays, forced repaints, screenshots, or extra resize listeners. Original host styles are restored on navigation to other sites, disable, or unload. This can cover exposed host pixels and darken the browser's default canvas; it cannot override an opaque white surface submitted by the Electron guest compositor.

## Hide ChatGPT title bar (0.6.2)

Optional. Hides known ChatGPT header variants and detects an otherwise unrecognized top-of-shell navigation row. A native Obsidian icon button overlays the top-left of the webview host and invokes the guest sidebar controller, including at narrow widths. The native icon hides while the sidebar is open and returns when it closes, using a guest visibility event rather than polling. It uses Obsidian’s aria-label tooltip only. No extra toolbar row or viewport resize is required. The option automatically enables the compact sidebar controller while the header is hidden. Restore the header using Settings or **Obsidian ChatGPT Native: Toggle ChatGPT title bar**. Header detection depends on ChatGPT's private DOM and may require adjustments after UI changes.

The content-only smooth resize experiment has been removed because continuous guest viewport resizing reintroduced lag. Smooth resize always uses the existing centered full-webview lock and staged release. Reload ChatGPT once after upgrading from 0.5.9 to ensure any old guest scripts are gone.

Solid title bar (on by default with theme matching) removes header gradients, masks, and backdrop filters; it addresses possible see-through content but cannot fix stale GPU pixels. The Electron resize investigation is documented at https://www.electronjs.org/blog/tech-talk-window-resize-behavior (Windows compositor fix, not proof of the same issue on macOS or embedded webviews). Use the existing Inspect command for live profiling.

## Resize reliability (0.6.3)

Removed experimental animated layout transitions. Suppress guest hit testing during divider dragging, use a 450 ms idle watchdog, and relock on resumed dragging. Clipping uses overflow:clip where supported and the parent is not scrolled. Release waits for stable host frames, bounded to 120 ms. **Obsidian ChatGPT Native: Log ChatGPT resize diagnostics** logs recent lock/release events and host/guest dimensions to the Obsidian developer console, without conversation text or screenshots. This measures geometry, not GPU frame presentation. Reload ChatGPT after upgrading.

## Frozen-frame release (0.6.4)

Smooth resize retains its existing drag behavior. At release, capture the old fixed viewport once using Electron capturePage, decode a temporary in-memory image, and place it at the same centered geometry over the webview. Resize the live guest behind it. After the host stabilizes, wait for the guest viewport to match for three consecutive animation frames, then remove the overlay without animation. Capture preparation is bounded to 120 ms and the final release to 300 ms; unavailable capture falls back to the previous release. New drags, navigation, blur and unload cancel stale work and remove the overlay. Captures are never saved or transmitted. Guest frame callbacks do not prove physical GPU presentation. Diagnostics now include snapshot and guest readiness events.

## Workspace action pre-capture (0.6.5)

Recognized tab/pane closures, split actions, sidebar toggles, middle-click tab close and standard Cmd/Ctrl+W pre-lock before the workspace action, and start one memory-only capture/decode in parallel with host settling. Capture is reused on release. No snapshot is displayed if dimensions never change. Unrecognized custom commands and native window resizing retain the existing burst fallback. The frozen release now starts guest readiness after one host frame and requires two consecutive matching guest frames instead of three. Large size changes have a 420 ms bounded release budget; normal ones remain 300 ms. Any late host resize invalidates readiness; no images are stretched to fill expansion gaps.

## Sidebar tooltip (0.6.6)

The native sidebar button clears its tooltip and focus when hidden or clicked. A single browser tooltip is armed only by fresh pointer movement after redisplay, preventing stale hover state. A visually hidden text label preserves accessibility. Resize behavior is unchanged.

## Instant sidebar in Performance Mode (0.6.7)

Performance Mode disables sidebar shell transitions and keyframe animations, and bypasses the animated width of the desktop compact sidebar using the existing 260 px fallback as its fixed open width. Other modes and host smooth resize are unchanged.

## Sidebar rendering fix (0.6.8)

Replaces 0.6.7 forced sidebar widths and animation cancellation with 1 ms transition/keyframe durations and zero delays, scoped to the sidebar and its descendants/pseudo-elements. Native sizing, animation names, and completion events are preserved. JavaScript-driven animations may still require a live DOM inspection. Host resizing is unchanged.

## Warm compact sidebar (0.6.9)

Performance Mode keeps the native desktop compact sidebar open after its first opening. Closing through the native control, backdrop or Escape changes only the plugin overlay visibility. The hidden sidebar retains native dimensions and is clipped, invisible and noninteractive. The first open may still require native initialization; narrow/mobile viewports and normal mode retain native lifecycle. No forced width, background polling or conversation capture. Refresh ChatGPT on upgrade.

## Sidebar visibility and timing (0.6.10)

Warm desktop sidebar closure uses only outer-panel opacity and inertness instead of changing descendant visibility or clipping the full panel. Native narrow layout is unchanged. In Performance Mode, opening records five bounded geometry/style samples in the Obsidian console under ChatGPT sidebar timing. No chat text, history, network payloads or screenshots are collected. The samples distinguish native/narrow state, width, visibility, and opacity; they do not prove GPU presentation.

## Sidebar close handoff (0.6.11)

The native Obsidian button remains hidden until the guest panel/backdrop is visually closed for two consecutive frames. The guest reports the settled state to the host; explicit host synchronization also respects a pending close. Reopening cancels the pending reveal. A 900 ms fallback prevents a lost button if the native DOM is ambiguous or animation frames stall. Resize and performance CSS are unchanged.

## ChatGPT launcher (0.8.0)

Enable the optional ribbon button under Obsidian ChatGPT Native → ChatGPT launcher. Choose Home / new chat or a specific conversation URL. Each launch opens a fresh core Web Viewer tab. The command palette also has Open ChatGPT. Automatic prompt and plugin selection have been removed, including old saved prompt/plugin settings. Header navigation fixes from previous releases remain.

## Loading rollback (0.8.1)

Removed the 0.8.0 startup masking experiment and restored the previous Web Viewer scan, navigation, CSS injection and background behavior. The simplified URL-only launcher remains; automatic prompts and plugin selection are still removed. Existing background matching and smooth resize are unchanged.

## Early background paint (0.8.3)

Theme CSS now uses a separate queue from sidebar/header scripts and is attempted at main-frame ChatGPT load-commit, then retried at normal readiness events. The unclassified document root uses the Obsidian palette without waiting for a system color-scheme media query. The existing Match Web Viewer background setting controls the root fallback. No loading cover, opacity change, delayed reveal, global native theme change, or styling of other sites. Electron may still show its native blank surface before the first document commits; live flash reduction is unverified.

### Sidebar-free mode

Enable **Sidebar-free mode** in settings to hide the native navigation at every width. Two host buttons open ChatGPT's own search and start a new chat in the same tab. The existing ChatGPT search shortcut is unchanged; no new shortcut is registered. The old compact-sidebar controller and prewarming are disabled in this mode. Use the command **Toggle sidebar-free mode / restore native navigation** to leave this mode and restore the original header and sidebar controls.

### Accent and text selection

**Match accent color** (off by default) follows Obsidian's interactive accent and hover color for ChatGPT's Codex appearance roles, using the inspected semantic tokens for controls, links, icons, focus indicators and tinted message bubbles. Bubble luminance and contrasting foregrounds are computed together. **Match text selection** (on by default) uses Obsidian's text selection color including transparency. Both are independent of the background/theme matching toggle and reuse the existing theme refresh event. No guest observers, account preference changes or extra resize handling.
