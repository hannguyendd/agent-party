import json
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Node server settings, read from env vars prefixed AGENTFLEET_ or a .env file."""

    model_config = SettingsConfigDict(env_prefix="AGENTFLEET_", env_file=".env", extra="ignore")

    # Who owns this device; agent IDs created here must start with "<owner>/".
    owner: str = "me"

    host: str = "127.0.0.1"
    port: int = 9100
    data_dir: Path = Path("./data")

    # Local agentmesh-node API (see Agent Mesh node API reference).
    mesh_node_url: str = "http://127.0.0.1:8080"
    mesh_api_token: str | None = None
    mesh_api_token_path: Path | None = None
    # Where we write the generated agentmesh-node.yaml (services = our agents).
    mesh_node_config_path: Path = Path("./data/agentmesh-node.yaml")
    # Team world server for the Office view, e.g. ws://192.168.1.10:7500/world/ws (unset: Office disabled).
    world_url: str | None = None
    # Hub (agentmesh-one) URL; when set, the node server runs agentmesh-node itself (meshproc.py).
    hub_url: str | None = None
    # Dev/test only: skip discovery and call peers directly, {"owner": "http://host:port"}.
    static_peers: dict[str, str] = Field(default_factory=dict)

    # Loop protection and timeouts.
    max_turns_per_context: int = 20
    max_agent_turns_per_message: int = 30
    turn_timeout_s: float = 600
    approval_timeout_s: float = 300
    manual_reply_timeout_s: float = 900
    outbound_timeout_s: float = 900
    # How long an Assignment waits for the receiving owner to accept before it is declined.
    assignment_accept_timeout_s: float = 900
    # Pop an OS notification when an Assignment arrives and no dashboard tab is open.
    os_notifications: bool = True

    # File sharing.
    max_inline_file_bytes: int = 5 * 1024 * 1024
    allowed_file_suffixes: list[str] = Field(
        default_factory=lambda: [".txt", ".md", ".json", ".yaml", ".yml", ".csv", ".log", ".py", ".ts", ".tsx", ".js", ".sql", ".png", ".jpg", ".pdf"]
    )

    # Claude CLI path override (default: whatever the SDK finds).
    claude_cli_path: str | None = None

    @property
    def setup_path(self) -> Path:
        """Choices made in the web setup (owner, hub, world); they override env vars on startup."""
        return self.data_dir / "setup.json"

    def apply_setup_file(self) -> "Settings":
        if self.setup_path.exists():
            try:
                saved = json.loads(self.setup_path.read_text())
            except ValueError:
                return self
            for key in ("owner", "hub_url", "world_url"):
                if saved.get(key):
                    setattr(self, key, saved[key])
        return self

    @property
    def db_path(self) -> Path:
        return self.data_dir / "node.db"

    @property
    def public_base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def read_mesh_token(self) -> str | None:
        if self.mesh_api_token:
            return self.mesh_api_token
        if self.mesh_api_token_path and self.mesh_api_token_path.exists():
            return self.mesh_api_token_path.read_text().strip()
        return None
