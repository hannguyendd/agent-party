# What's new

The Office shows this file under "What's new" after an update. Write for staff, not for developers: what they can do
now, or what works better. Add lines under `## Unreleased` as you merge; `make release` turns that heading into the
version and date (or, when the section is missing, lists the release's `feat` / `fix` commits).

Format: `## Unreleased` or `## vX.Y.Z (YYYY-MM-DD)`, then `### New` / `### Fixed` / `### Changed`, then `- ` lines.

## Unreleased

### Fixed
- "What's new" now opens by itself the first time too (it stayed quiet if you skipped a version).
- The version sits beside the logo, top left, instead of among the buttons.

## v0.3.1 (2026-10-29)
### New
- Log in to Claude Code from the Office: Settings > This computer > "Log in to Claude" (no terminal needed).
- When Claude Code's login expires, the chat says so and the top bar shows "Claude login expired".

### Fixed
- "Claude Code is ready" no longer shows while the login has stopped working.

## v0.3.0 (2026-10-29)
### New
- The app shows its version, and "Update available" says which version you'll get.
- "What's new" opens after an update (and any time from the account menu or Settings > This computer).
- The 5-hour Claude plan window shows again next to the weekly one.
- Agent permission "Full access" is now called "Autopilot".
- The admin page is split into tabs: Office, Invites, Activity, Install & update, Settings.

### Fixed
- Allow / Deny on a notification decides only that request; older ones in the same chat no longer show buttons.
- Switching an agent to Autopilot lets the requests it's already waiting on go through.
- Asking another agent no longer gets cut off after 10 minutes while that agent waits for its owner.
- When an answer arrives after the turn ended, the chat says where to find it.

## v0.2.0 (2026-10-29)

### Changed
- First version with this list. Earlier changes are on the GitHub releases page.
