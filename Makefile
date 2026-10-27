# Agent Mesh — run targets. `make help` lists them.
#
# Device settings come from node-server/.env (AGENTFLEET_OWNER, ...); hub settings from the variables below.

SHELL := /bin/bash

NODE_DIR := node-server
DASH_DIR := dashboard
HUB_DIR  := hub

HUB_HOST ?=
HUB_PORT ?= 7400
HUB_URL  ?= http://$(if $(HUB_HOST),$(HUB_HOST),127.0.0.1):$(HUB_PORT)
DEVICE   ?=

.DEFAULT_GOAL := help
.PHONY: help install install-node install-dashboard test build serve dev dev-server dev-dashboard \
        mesh-node mesh-config hub hub-token env clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# setup

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

clean: ## Remove build output and caches (keeps data/ and node identities)
	rm -rf $(DASH_DIR)/dist $(NODE_DIR)/.pytest_cache
	find $(NODE_DIR) -name __pycache__ -type d -prune -exec rm -rf {} +
