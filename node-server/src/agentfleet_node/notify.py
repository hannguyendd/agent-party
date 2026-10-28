"""Wake the owner when an Assignment needs them (CONTEXT.md "Woken").

Best effort, as agreed: an open dashboard tab shows a browser notification itself (it sees the approval event);
when no tab is open, the node pops an OS notification on this machine. Focus / Do Not Disturb may hide either.
"""

import logging
import platform
import shutil
import subprocess

log = logging.getLogger(__name__)


def os_notify(title: str, body: str) -> bool:
    """Fire-and-forget desktop notification. Returns False when this platform has no way to show one."""
    system = platform.system()
    try:
        if system == "Darwin":
            script = f"display notification {_applescript(body)} with title {_applescript(title)} sound name \"Glass\""
            subprocess.Popen(["osascript", "-e", script], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        if system == "Linux" and shutil.which("notify-send"):
            subprocess.Popen(["notify-send", "-a", "Agent Mesh", title, body], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        if system == "Windows":
            ps = (
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;"
                "$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(1);"
                f"$t.GetElementsByTagName('text')[0].AppendChild($t.CreateTextNode({_ps(title + ': ' + body)})) > $null;"
                "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Agent Mesh').Show("
                "[Windows.UI.Notifications.ToastNotification]::new($t))"
            )
            subprocess.Popen(["powershell", "-NoProfile", "-Command", ps], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
    except OSError as e:
        log.warning("OS notification failed: %s", e)
    return False


def _applescript(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _ps(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"
