# An accepted Assignment lets the peer edit files without asking, nothing more

Today every tool outside an agent's `allowed_tools` waits for per-call owner approval. For the Office, owners
wanted one confirmation per Assignment instead of a card for every file change. We decided: once the peer's owner
accepts an Assignment, `Edit`, `Write` and `NotebookEdit` are allowed inside that one conversation; `Bash` outside
the allow-list still asks, and `denied_tools` still deny.

## Why not open everything

Bash can't be confined to the working directory, so an "accept" that also opened Bash would let one click allow
`rm -rf ~` or sending data off the machine (this is a health-tech team; PHI must not leak). File edits stay inside
the agent's working directory and are reviewable with git.

## Consequences

- `sessions.policy_decision` stays the single source of truth; it gains one input (is this conversation an
  accepted Assignment) instead of a second policy path.
- The Inquiry/Assignment label is a sender claim. Only the receiving owner's click widens permissions, so
  mislabelling a request gains nothing.
