class ThemeSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        const { settings } = this.plugin;
        containerEl.empty();

        const heading = name => new Setting(containerEl).setName(name).setHeading();
        const toggle = (key, name, {desc, disabled = false, redraw = false} = {}) => {
            const row = new Setting(containerEl).setName(name);
            if (desc) row.setDesc(desc);
            row.addToggle(control => control.setValue(settings[key])
                .setDisabled(disabled)
                .onChange(async value => {
                    await this.plugin.setOption(key, value);
                    if (redraw) this.display();
                }));
        };

        heading("Appearance");
        toggle("enabled", "Match background", {desc:"Also sync light/dark mode when ChatGPT adapts to system.", redraw:true});
        toggle("matchSidebar", "Match sidebar", {disabled:!settings.enabled || settings.sidebarFreeMode});
        toggle("matchComposer", "Match composer", {disabled:!settings.enabled});
        toggle("matchAccent", "Match accent color");
        toggle("matchSelection", "Match text selection");
        toggle("squareFrame", "Square window corners");
        toggle("solidHeader", "Solid title bar", {disabled:!settings.enabled || settings.hideChatGPTHeader});

        heading("Navigation");
        toggle("sidebarFreeMode", "Sidebar-free mode", {
            desc:"Replace the sidebar with Search and New chat buttons.", redraw:true
        });
        toggle("alwaysShowSidebarToggle", "Always show sidebar toggle", {
            disabled:settings.sidebarFreeMode
        });
        toggle("hideChatGPTHeader", "Hide ChatGPT title bar", {redraw:true});
        toggle("hideAddressBar", "Hide address bar");

        heading("Performance");
        toggle("smoothResize", "Smooth resizing", {
            desc:"Keep the chat layout stable while resizing."
        });
        toggle("matchWebviewBackground", "Match Web Viewer background", {
            desc:"Reduce white flashes.", disabled:!settings.enabled
        });
        toggle("performanceMode", "Reduce animations and blur", {redraw:true});
        toggle("keepSidebarWarm", "Keep sidebar ready", {
            desc:"Keep sidebar content loaded when closed.",
            disabled:settings.sidebarFreeMode
        });
        toggle("optimizeLongChats", "Optimize long chats", {
            desc:"Experimental; may affect scrolling.", disabled:!settings.performanceMode
        });

        heading("Launcher");
        toggle("launcherEnabled", "Show ribbon button");
        new Setting(containerEl)
            .setName("Open to")
            .addDropdown(dropdown => dropdown.addOption("home","New chat")
                .addOption("chat","Saved conversation")
                .setValue(settings.launcherMode)
                .onChange(async value => {
                    await this.plugin.setOption("launcherMode",value);
                    this.display();
                }));
        if (settings.launcherMode === "chat") {
            new Setting(containerEl)
                .setName("Conversation URL")
                .addText(text => text.setPlaceholder("https://chatgpt.com/c/...")
                    .setValue(settings.launcherURL)
                    .onChange(value => this.plugin.setOption("launcherURL",value)));
        }

        heading("Tools");
        new Setting(containerEl)
            .setName("Refresh theme")
            .addButton(button => button.setButtonText("Refresh").onClick(() => this.plugin.refresh()));
    }
}
