# Obsidian ChatGPT Native

Make ChatGPT feel like a native part of your Obsidian workspace.

Obsidian ChatGPT Native transforms the ChatGPT website inside Obsidian's built-in Web Viewer. It matches your vault's theme, simplifies navigation, and makes resizing chat panes smoother, so you can work with ChatGPT alongside your notes without feeling like you've opened a separate browser.

## Features

- **Theme integration** — match Obsidian's backgrounds, accent colors, message bubbles, and text selection while preserving ChatGPT's typography and syntax highlighting.
- **Native-style navigation** — replace ChatGPT's sidebar with compact Search and New chat buttons that use Obsidian's interface styling.
- **Clean workspace** — remove the browser address bar, rounded window corners, and unnecessary title bar elements.
- **Smooth resizing** — keep conversations visually stable while resizing panes, opening sidebars, or rearranging your workspace.
- **Performance options** — reduce animations and blur, keep the optional sidebar ready, and optimize long conversations.
- **Quick access** — open a new chat or a saved conversation from the Obsidian ribbon or command palette.

This plugin uses the existing ChatGPT website, so you can continue using your account, conversations, and available ChatGPT features. No API key or separate AI service is required.

## Installation

Requires Obsidian desktop with the built-in Web Viewer core plugin enabled.

1. Obtain `main.js` and `manifest.json` from this repository.
2. Open your vault folder and navigate to `.obsidian/plugins/`. Create the directory if it does not exist.
3. Create a folder named `obsidian-chatgpt-native` and place both files inside it.

   ```text
   <your-vault>/
   └── .obsidian/
       └── plugins/
           └── obsidian-chatgpt-native/
               ├── main.js
               └── manifest.json
   ```

4. In Obsidian, open **Settings → Community plugins**, enable community plugins if necessary, and enable **Obsidian ChatGPT Native**. Restart Obsidian if the plugin does not appear.
5. Click the ChatGPT ribbon icon or run **Open ChatGPT** from the command palette. Sign in to ChatGPT normally if prompted.

No npm installation or build step is required.

## Settings

Most features are ready to use immediately. All toggles are enabled by default on new installations, and existing preferences are preserved when updating.

| Section | Options |
| --- | --- |
| Appearance | Background, sidebar, composer, accent and selection colors; square corners; solid title bar; Web Viewer bottom clearance |
| Navigation | Sidebar-free mode, optional sidebar toggle, title bar and address bar visibility |
| Performance | Smooth resizing, Web Viewer background, reduced animations and blur, sidebar preloading, long-chat optimization |
| Launcher | Ribbon button, new chat or saved conversation |
| Tools | Manually refresh theme colors |

Sidebar-free mode takes precedence over the optional compact sidebar controls. Disable sidebar-free mode to use the original ChatGPT sidebar.

For best theme matching, select **Adapt to system** in ChatGPT's appearance settings. Matching Obsidian's light/dark mode when it differs from the operating system is best-effort and depends on Electron's per-tab color-scheme emulation.

## Compatibility and privacy

- Desktop only; requires Obsidian 1.8.0 or later and the core Web Viewer.
- Changes are applied locally to ChatGPT tabs only. Other websites are unaffected.
- The plugin does not send conversation data to an external service. Smooth resizing may temporarily capture a frame in memory; it is not saved or transmitted.
- ChatGPT's interface is not a public styling API, so website updates may require plugin updates.
- Theme-mode emulation may be unavailable in some Electron runtimes or while Web Viewer DevTools is open.
- Long-chat optimization is experimental. Disable it if you experience scrolling issues.

## Updating

Replace `main.js` and `manifest.json` in the installed plugin directory, then reload the plugin and refresh the ChatGPT tab. Keep `data.json` to retain your settings.

If upgrading from the former ChatGPT Theme Sync plugin, disable it first, rename its installed folder from `chatgpt-theme-sync` to `obsidian-chatgpt-native`, and replace the two plugin files. Restart Obsidian and enable the renamed plugin. Custom hotkeys may need to be reassigned.

## Development hot reload

With the Obsidian **Hot Reload** community plugin enabled, run:

```sh
python3 deploy.py
```

This rebuilds `main.js`, copies changed runtime files into the installed
plugin directory, and creates the installed `.hotreload` marker. Existing
`data.json` is preserved. The default vault is `~/Documents/Obsidian Vault`;
use `--vault "/path/to/vault"` if needed. Hot Reload watches the installed
files, not this source checkout, so run the deploy command after edits.
No manual plugin toggle should be necessary once Hot Reload is active.

## Development

The plugin is dependency-free. Edit the source modules in `src/` and rebuild:

```sh
python3 build.py
node --test test.js
```

Test Electron-specific behavior in Obsidian. See [development history](CHANGELOG.md) for earlier implementation and release notes.

---

An independent community plugin, not affiliated with Obsidian or OpenAI.
