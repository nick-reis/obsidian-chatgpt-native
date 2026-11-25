"""Build the installable Obsidian bundle using only the Python standard library."""
from pathlib import Path
root = Path(__file__).resolve().parent
modules = ['entry-header.js', 'theme.js', 'guest-sidebar.js', 'surface-css.js', 'resize.js', 'host-background.js', 'guest-header.js', 'guest-navigation.js', 'host-sidebar.js', 'host-navigation.js', 'session.js', 'plugin.js', 'settings.js', 'exports.js']
output = "// Generated from src/ by build.py. Edit the source modules, not this bundle.\n\n"
output += "\n\n".join((root / "src" / name).read_text().strip() for name in modules) + "\n"
(root / "main.js").write_text(output)
print("Built main.js")
