"""Owner attachments: files go to the agent's inbox, the agent is told where, and the dashboard can fetch them."""

import base64

import httpx

from conftest import FakeClaude
from test_two_nodes import add_agent, wait_for

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


async def test_start_with_attachments_saves_them_and_tells_the_agent(node_factory):
    async with node_factory("han", os_notifications=False) as a:
        await add_agent(a, "han/dev")
        async with httpx.AsyncClient(base_url=a.url) as c:
            r = await c.post("/api/conversations", json={
                "agent_id": "han/dev",
                "text": "what is in these?",
                "files": [
                    {"name": "screen.png", "media_type": "image/png", "data": b64(PNG)},
                    {"name": "notes.md", "media_type": "text/markdown", "data": b64(b"# hi")},
                ],
            })
            assert r.status_code == 200, r.text
            conv_id = r.json()["id"]
            [owner_msg] = [m for m in a.node.store.list_messages(conv_id) if m.role == "owner"]
            files = owner_msg.data["files"]
            assert [f["name"] for f in files] == ["screen.png", "notes.md"]
            assert all(f["path"].startswith("inbox/") for f in files)
            assert (a.workdir / files[0]["path"]).read_bytes() == PNG

            # The agent's prompt names the saved paths.
            await wait_for(lambda: any("inbox/" in p for f in FakeClaude.instances for p in f.prompts))

            # The dashboard fetches the image inline.
            r = await c.get(f"/api/files/{files[0]['id']}")
            assert r.status_code == 200 and r.content == PNG
            assert r.headers["content-type"] == "image/png" and r.headers["content-disposition"].startswith("inline")
            assert (await c.get("/api/files/nope")).status_code == 404


async def test_inject_attachments_and_limits(node_factory):
    async with node_factory("han", os_notifications=False, max_inline_file_bytes=10) as a:
        await add_agent(a, "han/dev")
        async with httpx.AsyncClient(base_url=a.url) as c:
            conv_id = (await c.post("/api/conversations", json={"agent_id": "han/dev", "text": "hello"})).json()["id"]
            ok = await c.post(f"/api/conversations/{conv_id}/inject", json={"files": [{"name": "a.txt", "data": b64(b"tiny")}]})
            assert ok.status_code == 200, ok.text
            too_big = await c.post(f"/api/conversations/{conv_id}/inject", json={"files": [{"name": "b.txt", "data": b64(b"x" * 50)}]})
            assert too_big.status_code == 422 and "limit" in too_big.text
            bad_type = await c.post(f"/api/conversations/{conv_id}/inject", json={"files": [{"name": "run.sh", "data": b64(b"rm")}]})
            assert bad_type.status_code == 422 and "not allowed" in bad_type.text
            bad_b64 = await c.post(f"/api/conversations/{conv_id}/inject", json={"files": [{"name": "c.txt", "data": "%%%"}]})
            assert bad_b64.status_code == 422
            empty = await c.post(f"/api/conversations/{conv_id}/inject", json={"text": "  "})
            assert empty.status_code == 422
            info = (await c.get("/api/node")).json()["files"]
            assert info["max_bytes"] == 10 and ".png" in info["suffixes"]
