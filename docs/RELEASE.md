# Releasing a new version

How a change reaches staff computers. Written for people and for agents: every step is a command.

## In one line

```sh
make release            # or: make release BUMP=minor | BUMP=major | BUMP=0.6.0
```

Then, on the office server: Ctrl+C, `git pull`, `make server`. Every open Office shows **Update available**.

## What happens

1. **`scripts/release.sh`** (what `make release` runs), on your machine:
   - refuses if there are uncommitted changes, if the tag already exists (locally or on GitHub), or if the new
     version isn't newer;
   - shows `0.4.1 -> 0.4.2` and asks to confirm (`--yes` skips the question, `--dry-run` only prints);
   - bumps the version in `node-server/pyproject.toml` (+ `uv.lock`) and `dashboard/package.json`;
   - commits `chore(release): v0.4.2`, tags `v0.4.2`, pushes the branch and the tag.
2. **GitHub Actions** (`.github/workflows/release.yml`) starts on the tag:
   - checks the tag matches the version in `pyproject.toml`;
   - runs the node-server tests and the dashboard lint;
   - builds the dashboard and the node package with the dashboard inside (`build.json` = the tag);
   - writes the installers for this release (`python -m agentfleet_node.installer`): `install.sh`, `install.ps1`,
     `uninstall.sh`, `uninstall.ps1`, already pointing at this release's download folder;
   - publishes a GitHub Release `v0.4.2` with the package, the installers and `SHA256SUMS`.

   Watch it at `https://github.com/<repo>/actions`; when green the release is at
   `https://github.com/<repo>/releases/tag/v0.4.2`.
3. **Office server**: `git pull && make server`.
   - With **bun** installed, `make bundle` builds the package from the checkout (as before).
   - **Without bun**, it downloads the released package for the checkout's version from GitHub
     (`scripts/fetch-release.sh`, checksum checked). So the server only needs **uv** and **agentmesh-one**.
   - Either way it serves `/install`, and every Office compares its build with the server's and offers the update.

## For an agent asked to "release"

1. Make sure the work is committed and `make test` + `make build` pass.
2. `make release BUMP=patch` (use `./scripts/release.sh patch --yes` when there is no terminal to answer).
3. Report the version and the Actions link the script printed. Watch the run with `gh run watch` if `gh` is set up.
4. Tell the admin to run `git pull && make server` on the office server.

Don't edit versions by hand or push tags yourself: the script keeps the version, the tag and the package in step.

## Version numbers

`MAJOR.MINOR.PATCH`. Patch: fixes and small UI changes. Minor: new features. Major: a change that needs every
computer to update together (for example a protocol change between nodes and the office server).

## Where staff install from

| Source | Command | When |
|---|---|---|
| Office server | `curl -fsSL http://<server>:7500/install \| bash` (Windows: `irm http://<server>:7500/install.ps1 \| iex`) | Normal case |
| GitHub release | `curl -fsSL https://github.com/<repo>/releases/download/vX.Y.Z/install.sh \| bash -s -- --server <server>:7500` (Windows: `$env:AGENTMESH_SERVER='<server>:7500'; irm https://github.com/<repo>/releases/download/vX.Y.Z/install.ps1 \| iex`) | The computer can't download from the office server |

The admin page's invite message contains both, for the exact version the server serves (never "latest", so staff
and server match). The installer from the office server also falls back to GitHub by itself when its own download
fails. GitHub only solves the download: afterwards the computer must still reach the office server (7500) and the
hub (7400) on the office network.

The repository is public, so anyone can download the package. That's fine: it contains no secrets (no admin key,
no tokens, no data); the single-use join token from the admin is what lets a computer into the office.

## Checking a release by hand

```sh
gh release view v0.4.2                     # assets: wheel, install.sh, install.ps1, uninstall.*, SHA256SUMS
curl -fsSL https://github.com/<repo>/releases/download/v0.4.2/install.sh | head -20
```

Test an install without touching your own: `HOME=<scratch dir> AGENTFLEET_PORT=<free port> AGENTMESH_NO_OPEN=1
AGENTMESH_AUTOSTART=off bash install.sh --server <server>:7500`.

## If something goes wrong

| Problem | Fix |
|---|---|
| `release.sh`: "commit or stash your changes first" | Commit (or stash) and run it again. |
| `release.sh`: "tag vX already exists" | That version is out; release the next one. |
| Actions run failed (tests, lint) | Fix on the branch and release the next patch version. The failed tag has no Release; leave it. |
| `make server` without bun: "No GitHub release vX yet" | Release that version first, or install bun on the server to build it there. |
| Staff: "Could not download the node package" | Open the server address (or the GitHub link) in that computer's browser; if it fails there too, it's the network (guest Wi-Fi, VPN, firewall). |
