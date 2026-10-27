"""Agent IDs look like ``han/backend-agent``; mesh service names allow only
dot-separated labels, so the slash becomes a dot: ``han.backend-agent``."""

import re

_LABEL = r"[A-Za-z0-9_-]+"
AGENT_ID_RE = re.compile(rf"^{_LABEL}/{_LABEL}$")


class InvalidAgentId(ValueError):
    pass


def validate_agent_id(agent_id: str) -> str:
    if not AGENT_ID_RE.match(agent_id):
        raise InvalidAgentId(f"agent ID must look like 'owner/name' using letters, digits, '_' or '-': {agent_id!r}")
    return agent_id


def to_service_name(agent_id: str) -> str:
    owner, name = validate_agent_id(agent_id).split("/")
    return f"{owner}.{name}"


def from_service_name(service: str) -> str:
    owner, sep, name = service.partition(".")
    if not sep or "." in name:
        raise InvalidAgentId(f"not an agent service name: {service!r}")
    return validate_agent_id(f"{owner}/{name}")


def owner_of(agent_id: str) -> str:
    return validate_agent_id(agent_id).split("/")[0]
