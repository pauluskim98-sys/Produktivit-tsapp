import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
export const reminderAgent = join(
  homedir(),
  "Library",
  "LaunchAgents",
  "de.raum.reminders.plist",
);
export function reminderStatus() {
  let active = false;
  if (process.platform === "darwin" && existsSync(reminderAgent)) {
    try {
      execFileSync(
        "/bin/launchctl",
        ["print", `gui/${process.getuid?.()}/de.raum.reminders`],
        { timeout: 2000, stdio: "pipe" },
      );
      active = true;
    } catch {}
  }
  return {
    active,
    supported: process.platform === "darwin",
    installed: existsSync(reminderAgent),
  };
}
export function installCommand() {
  const node = process.execPath,
    script = join(process.cwd(), "scripts", "reminder-worker.mjs");
  const xml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>de.raum.reminders</string><key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(script)}</string></array><key>StartInterval</key><integer>60</integer><key>RunAtLoad</key><true/><key>StandardErrorPath</key><string>/tmp/raum-reminders.log</string></dict></plist>`;
  return `#!/bin/zsh\nset -eu\nmkdir -p "$HOME/Library/LaunchAgents"\ncat > "$HOME/Library/LaunchAgents/de.raum.reminders.plist" <<'RAUM_PLIST'\n${plist}\nRAUM_PLIST\nlaunchctl bootout "gui/$(id -u)/de.raum.reminders" 2>/dev/null || true\nlaunchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/de.raum.reminders.plist"\n/usr/bin/osascript -e 'display notification "Erinnerungen laufen jetzt auch bei geschlossenem Browser." with title "Raum"'\nprintf 'Erinnerungen aktiviert. In macOS Systemeinstellungen > Mitteilungen die Mitteilungen für Skripteditor/osascript zulassen.\\n'\nread -k 1\n`;
}
