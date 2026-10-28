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
- Anything holding a WebSocket open (e.g. a dashboard client) must close it before the server stops, or shutdown
  waits for it.
