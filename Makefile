# Agent Mesh — run targets. `make help` lists them.
#
# Admin (always-on machine): `make server HUB_HOST=<ip>`, then `make hub-token DEVICE=...` per laptop.
# Staff: `curl -fsSL http://<server ip>:7500/install | bash`, then join in the browser (name, server, join token).
# Developers: `make setup` once, then `make up`.
# Device settings can also come from node-server/.env (AGENTFLEET_OWNER, ...); the web setup overrides them.

SHELL := /bin/bash

NODE_DIR := node-server
DASH_DIR := dashboard
HUB_DIR  := hub

HUB_HOST ?=
HUB_PORT ?= 7400
HUB_URL  ?= http://$(if $(HUB_HOST),$(HUB_HOST),127.0.0.1):$(HUB_PORT)
DEVICE   ?=
WORLD_PORT ?= 7500
ORG ?=

.DEFAULT_GOAL := help
.PHONY: help setup up server bundle install install-node install-dashboard test build serve dev dev-server dev-dashboard \
        mesh-node mesh-config hub hub-token world env codegraph clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# staff: one-time setup, then run

setup: ## One-time setup on a staff machine: check tools, install deps, build the dashboard
	@command -v uv >/dev/null || { echo "missing: uv (https://docs.astral.sh/uv/)"; exit 1; }
	@command -v bun >/dev/null || { echo "missing: bun (https://bun.sh)"; exit 1; }
	@command -v claude >/dev/null || echo "warning: Claude Code CLI not found; agents can't run until it is installed and logged in"
	@command -v agentmesh-node >/dev/null || echo "warning: agentmesh-node not found; the Office works, but agents can't reach other machines until it is installed"
	@$(MAKE) --no-print-directory install build
	@echo; echo "Done. Run 'make up', then open http://127.0.0.1:9100 to join the team."

up: ## Run this machine's node (dashboard + agents + mesh connection) at http://127.0.0.1:9100
	@test -d $(DASH_DIR)/dist || $(MAKE) --no-print-directory build
	@(sleep 2; command -v open >/dev/null && open http://127.0.0.1:9100 || command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:9100) >/dev/null 2>&1 &
	cd $(NODE_DIR) && uv run agentfleet-node serve

# admin: the always-on team machine

server: bundle ## Run hub + Office world server and serve the staff installer (HUB_HOST=<LAN IP> ORG="Taggle")
	@test -n "$(HUB_HOST)" || { echo "usage: make server HUB_HOST=<fixed LAN IP or hostname>"; exit 1; }
	@echo "Admin page (invite staff, see who is online): http://$(HUB_HOST):$(WORLD_PORT)/admin"
	@echo "Staff install (macOS/Linux): curl -fsSL http://$(HUB_HOST):$(WORLD_PORT)/install | bash"
	@echo "Staff install (Windows, PowerShell): irm http://$(HUB_HOST):$(WORLD_PORT)/install.ps1 | iex"
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) --no-print-directory hub & \
	$(MAKE) --no-print-directory world & \
	wait

bundle: ## Build what the staff installer serves: node package with the dashboard inside (+ this OS's agentmesh-node)
	cd $(DASH_DIR) && bun install --frozen-lockfile >/dev/null && bun run build
	rm -rf $(NODE_DIR)/src/agentfleet_node/static && cp -R $(DASH_DIR)/dist $(NODE_DIR)/src/agentfleet_node/static
	@# A build id per bundle: installed nodes compare it with the server's to offer an update.
	@printf '{"build": "%s-%s"}\n' "$$(git rev-parse --short HEAD 2>/dev/null || echo local)" "$$(date +%Y%m%d%H%M%S)" > $(NODE_DIR)/src/agentfleet_node/static/build.json
	mkdir -p dist/downloads && rm -f dist/downloads/agentfleet_node-*.whl
	cp $(NODE_DIR)/src/agentfleet_node/static/build.json dist/downloads/build.json
	cd $(NODE_DIR) && uv build --wheel --out-dir ../dist/downloads >/dev/null
	@if command -v agentmesh-node >/dev/null; then \
	  cp "$$(command -v agentmesh-node)" "dist/downloads/agentmesh-node-$$(uname -s | tr '[:upper:]' '[:lower:]')-$$(uname -m)"; fi
	@ls dist/downloads
	@echo "Other platforms: put agentmesh-node binaries in dist/downloads as agentmesh-node-<darwin|linux>-<arm64|x86_64>"

# setup pieces

install: install-node install-dashboard ## Install all dependencies

install-node: ## Install node-server Python deps (uv)
	cd $(NODE_DIR) && uv sync

install-dashboard: ## Install dashboard deps (bun)
	cd $(DASH_DIR) && bun install

env: ## Create node-server/.env for this device (OWNER=<name>)
	@test -n "$(OWNER)" || { echo "usage: make env OWNER=<your name>"; exit 1; }
	@test ! -f $(NODE_DIR)/.env || { echo "$(NODE_DIR)/.env already exists"; exit 1; }
	@printf 'AGENTFLEET_OWNER=%s\nAGENTFLEET_MESH_API_TOKEN_PATH=./data/mesh-api-token\n' "$(OWNER)" > $(NODE_DIR)/.env
	@echo "wrote $(NODE_DIR)/.env"

# checks

test: ## Run node-server tests
	cd $(NODE_DIR) && uv run pytest

build: ## Build the dashboard into dashboard/dist (served by the node server)
	cd $(DASH_DIR) && bun run build

# device

serve: build ## Run the node server with the built dashboard (http://127.0.0.1:9100)
	cd $(NODE_DIR) && uv run agentfleet-node serve

dev: ## Run node server + dashboard dev server with hot reload (http://localhost:5173)
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) --no-print-directory dev-server & \
	$(MAKE) --no-print-directory dev-dashboard & \
	wait

dev-server:
	cd $(NODE_DIR) && uv run agentfleet-node serve

dev-dashboard:
	cd $(DASH_DIR) && bun dev

mesh-node: ## Run this device's agentmesh-node (HUB_URL=http://<hub>:7400)
	cd $(NODE_DIR) && HUB_URL=$(HUB_URL) ./scripts/start-mesh-node.sh

mesh-config: ## Regenerate and print agentmesh-node.yaml from this device's agents
	cd $(NODE_DIR) && uv run agentfleet-node mesh-config

# hub (always-on machine)

hub: ## Run the hub (HUB_HOST=<fixed LAN IP or hostname>)
	@test -n "$(HUB_HOST)" || { echo "usage: make hub HUB_HOST=<fixed LAN IP or hostname>"; exit 1; }
	cd $(HUB_DIR) && HUB_HOST=$(HUB_HOST) HUB_PORT=$(HUB_PORT) ./start-hub.sh

hub-token: ## Mint a single-use join token for a device (DEVICE="han laptop")
	@test -n "$(DEVICE)" || { echo 'usage: make hub-token DEVICE="han laptop"'; exit 1; }
	cd $(HUB_DIR) && HUB_PORT=$(HUB_PORT) ./mint-token.sh "$(DEVICE)"

world: ## Run the Office world server (one per team, on the hub machine; port WORLD_PORT, default 7500)
	cd $(NODE_DIR) && uv run agentfleet-node world --port $(WORLD_PORT) --downloads ../dist/downloads --org "$(ORG)" --hub-data ../hub/data --hub-port $(HUB_PORT)

codegraph: ## Refresh the codegraph index (.codegraph/, local only)
	codegraph sync .

clean: ## Remove build output and caches (keeps data/ and node identities)
	rm -rf $(DASH_DIR)/dist $(NODE_DIR)/.pytest_cache
	find $(NODE_DIR) -name __pycache__ -type d -prune -exec rm -rf {} +
