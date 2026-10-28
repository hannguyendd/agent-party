# tests

`conftest.FakeClaude` replaces `ClaudeSDKClient`; its behaviour is chosen by words in the prompt:

| Prompt contains | Fake does |
|---|---|
| `TOOL:<Name>` | asks permission for `<Name>` with `{"command": "make build"}`, replies `tool <Name> allowed` or `tool <Name> denied: …` |
| `SLOW` | waits until interrupted, then ends with an error result |
| `ASK` | sets the worker's `needs_input` and replies with a question (→ A2A `input-required`) |
| anything else | replies `echo: <last line of the peer message>` |

`node_factory` starts real uvicorn node servers on free ports (extra kwargs go to `Settings`); `pair()` links two
of them with `static_peers` in place of the mesh. Tests drive behaviour over HTTP the way the dashboard and peers do,
and assert on the store. Never spend real Claude calls in this suite.

- `test_world.py`: `WorldState` rules as unit tests, plus `RunningWorld` (a real world server on a free port whose
  `broadcast` is spied on) with two nodes sharing one Office.
- `test_assignment.py`: accept / decline / timeout, policy widening, contact policy, the background assign API and
  the column migration. Build nodes with `os_notifications=False`.
- `test_attachments.py`: owner attachments land in the inbox, the prompt names them, `/api/files/{id}` serves
  them, and limits (size, type, base64, empty message) return 422.
- `test_setup.py`: the web join form (files written, owner lock, restart reads `setup.json`, office connects);
  `shutil.which` is patched so no real `agentmesh-node` starts.
- `conftest.FakeCodex` replaces `runtimes.codex.SdkCodexSession` (passed as `codex_session_factory`); same prompt
  words plus `EDIT`, `ESCALATE`, `CRASH`, `USAGE` (see its docstring). Approvals go through the runtime's real
  handler from a worker thread. `test_codex_runtime.py` patches `codex_status` so no real Codex is needed;
  `test_runtime_api.py` covers the runtime field, detection and `/api/codex/setup`; `test_internal_mesh.py` the
  mesh route and the stdio proxy.
- `test_party.py`: world Party rules as units, then three nodes (`Office`) for tagging + acceptance, share
  (one copy per owner, forged updates refused), hand-off and close, and Recaps (`recap.summarize` patched).
- Anything holding a WebSocket open (e.g. a dashboard client) must close it before the server stops, or shutdown
  waits for it.
