#!/bin/zsh
set -eu
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$HOME/Library/LaunchAgents/de.raum.reminders.plist" <<'RAUM_PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>de.raum.reminders</string><key>ProgramArguments</key><array><string>/Users/pauluskim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node</string><string>/Users/pauluskim/Documents/Codex/2026-10-09/files-pasted-by-the-user-ich/outputs/wochenplaner/scripts/reminder-worker.mjs</string></array><key>StartInterval</key><integer>60</integer><key>RunAtLoad</key><true/><key>StandardErrorPath</key><string>/tmp/raum-reminders.log</string></dict></plist>
RAUM_PLIST
launchctl bootout "gui/$(id -u)/de.raum.reminders" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/de.raum.reminders.plist"
/usr/bin/osascript -e 'display notification "Erinnerungen laufen jetzt auch bei geschlossenem Browser." with title "Raum"'
printf 'Erinnerungen aktiviert. In macOS Systemeinstellungen > Mitteilungen die Mitteilungen für Skripteditor/osascript zulassen.\n'
read -k 1
