# tests

`conftest.FakeClaude` replaces `ClaudeSDKClient`; its behaviour is chosen by words in the prompt:

| Prompt contains | Fake does |
|---|---|
| `TOOL:<Name>` | asks permission for `<Name>` with `{"command": "make build"}`, replies `tool <Name> allowed` or `tool <Name> denied: …` |
| `SLOW` | waits until interrupted, then ends with an error result |
| `ASK` | sets the worker's `needs_input` and replies with a question (→ A2A `input-required`) |
| anything else | replies `echo: <last line of the peer message>` |

`node_factory` starts real uvicorn node servers on free ports; `pair()` links two of them with `static_peers`
in place of the mesh. Tests drive behaviour over HTTP the way the dashboard and peers do, and assert on the
store. Never spend real Claude calls in this suite.
