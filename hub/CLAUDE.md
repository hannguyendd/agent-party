# hub

Config and scripts for `agentmesh-one` (control plane, router and web console in one binary, Agent Mesh
v0.1.0-rc.x, pre-1.0). Agent Mesh docs: https://google.github.io/agentmesh/docs/ (policy fields: reference/policy).

## Policy gotchas (all found the hard way)

- `--policy-file` seeds the policy **only on first boot** of a data dir; afterwards the hub DB is the source of truth.
  Change a live hub with `POST /policies` (`Authorization: Bearer <data/admin-token>`); the POST **replaces the
  whole document**, so send every role and binding. Keep `policy.json` in sync with what you post.
- A role with no `allowed_targets` can call **no** node (proxy answers 403, node log says
  `allow_network_target`). We grant `["*"]`.
- Nodes enroll with label `owner=<name>` (written by the node server into `agentmesh-node.yaml`); without a
  matching `allowed_labels` entry enrollment fails with "Label not permitted".
- Nodes pull policy every 15 min by default: restart `agentmesh-node`s to apply a change immediately.
- Bootstrap tokens are single-use (`mint-token.sh` uses `--max-usages 1`); a node that already enrolled
  restarts from its stored identity.
- Bindings use `mesh:system:authenticated` for "any enrolled node"; bootstrap-token nodes carry no OIDC claims,
  so `group:`/`email:` members never match them.
