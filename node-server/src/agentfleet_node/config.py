from pathlib import Path

from pydantic import Field, model_validator
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
    # Both default into data_dir, where scripts/start-mesh-node.sh reads and writes them.
    mesh_api_token_path: Path | None = None
    # Where we write the generated agentmesh-node.yaml (services = our agents).
    mesh_node_config_path: Path | None = None
    # Dev/test only: skip discovery and call peers directly, {"owner": "http://host:port"}.
    static_peers: dict[str, str] = Field(default_factory=dict)

    # Loop protection and timeouts.
    max_turns_per_context: int = 20
    max_agent_turns_per_message: int = 30
    turn_timeout_s: float = 600
    approval_timeout_s: float = 300
    manual_reply_timeout_s: float = 900
    outbound_timeout_s: float = 900

    # File sharing.
    max_inline_file_bytes: int = 5 * 1024 * 1024
    allowed_file_suffixes: list[str] = Field(
        default_factory=lambda: [".txt", ".md", ".json", ".yaml", ".yml", ".csv", ".log", ".py", ".ts", ".tsx", ".js", ".sql", ".png", ".jpg", ".pdf"]
    )

    # Claude CLI path override (default: whatever the SDK finds).
    claude_cli_path: str | None = None

    @model_validator(mode="after")
    def _default_paths(self) -> "Settings":
        if self.mesh_node_config_path is None:
            self.mesh_node_config_path = self.data_dir / "agentmesh-node.yaml"
        if self.mesh_api_token_path is None:
            self.mesh_api_token_path = self.data_dir / "mesh-api-token"
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
