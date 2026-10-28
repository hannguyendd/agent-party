# Internal Agent Fleet — ghi chú đọc hiểu

> Mục đích: tóm tắt những gì cần nhớ về repo này để sau không phải đọc lại từ đầu.
> Sơ đồ trực quan: mở [`docs/architecture.html`](./architecture.html) trong trình duyệt.
> Đọc ngày 2026-10-28, commit gốc `d31d4e0` (branch `main`).

## 1. Repo này làm gì (1 câu)

Mỗi thành viên trong team chạy các **Claude Code agent** trên máy mình; các agent **nói chuyện qua lại với nhau** bằng giao thức **A2A** (Agent-to-Agent) qua mạng **Agent Mesh** (Google `agentmesh`). Chủ agent (owner) theo dõi và điều khiển agent của mình qua **dashboard web**.

Design doc gốc: "Agent Mesh Architecture" — https://claude.ai/artifact/DWhMzELPYpbMb1n5bpgDdP (đọc trước khi đổi topology / protocol / guardrail).

## 2. Ba thành phần

| Thư mục | Chạy ở đâu | Công nghệ | Vai trò |
|---|---|---|---|
| `hub/` | 1 máy LAN luôn bật (cả team dùng chung) | `agentmesh-one` binary | Control plane + router + console. Cấp token, giữ policy |
| `node-server/` | Mỗi máy 1 cái | Python 3.12, FastAPI, Claude Agent SDK, `a2a-sdk` 1.3, SQLModel/SQLite, uv | Chạy agent, nhận/gửi A2A, API cho dashboard |
| `dashboard/` | Được node-server serve ở `/` (port 9100) | React 19, Vite, Tailwind v4, bun | UI cho owner |

Ngoài ra mỗi máy còn chạy **`agentmesh-node`** (binary của Agent Mesh, port 8080) cạnh node-server — lo identity, policy, discovery, relay. Python SDK của mesh **không publish service được**, nên bắt buộc phải có `agentmesh-node`.

## 3. Quy ước tên (quan trọng)

- Agent ID: `owner/name`, ví dụ `han/backend-agent`. Regex `[A-Za-z0-9_-]+/[A-Za-z0-9_-]+`.
- Agent tạo trên máy nào phải bắt đầu bằng `AGENTFLEET_OWNER` của máy đó.
- Tên service trên mesh không cho `/` → đổi thành `.`: `han.backend-agent`. File duy nhất lo việc này: `node-server/src/agentfleet_node/naming.py`.
- Endpoint A2A local: `http://127.0.0.1:9100/a2a/<owner>.<name>/` — **bắt buộc dấu `/` cuối**, thiếu là bị 307 và client fail.

## 4. Luồng chính

### Inbound (peer gọi agent của mình)
```
peer → agentmesh-node (relay) → /a2a/<service>/  A2AGateway
     → MeshAgentExecutor.execute       (a2a_bridge.py)
     → SessionManager.handle_inbound   (sessions.py)
     → SessionWorker.run_turn          → ClaudeSDKClient (Claude CLI)
     → reply: completed | input-required | failed | rejected
```
- Text peer được bọc `<mesh_message from="...">` (`format_prompt`) → agent coi là input không tin cậy.
- File đính kèm (inline raw part) lưu vào `<working_dir>/inbox/<contextId[:12]>/`. URL part bị từ chối.
- Vượt `max_turns_per_context` (20) → reject.

### Outbound (agent mình gọi peer)
```
Claude gọi tool mcp__mesh__send_message / share_file
  → OutboundClient.send                (a2a_bridge.py)
  → MeshDirectory.resolve              (mesh.py)
       1. agent local trên cùng máy  → gọi thẳng
       2. static_peers (dev/test)    → gọi thẳng
       3. mesh discover              → qua proxy /mesh/<peer-id>/a2a/<service>/
       không thấy                    → AgentOffline (không có hàng đợi offline)
  → HTTP blocking chờ hết lượt bên kia (tối đa outbound_timeout_s = 900s)
```

### Mapping session
- **1 conversation = 1 cặp (agent_id, contextId) = 1 SessionWorker = 1 Claude session.**
- Các lượt trong 1 session chạy tuần tự (`_turn_lock`).
- Muốn hỏi tiếp cùng cuộc hội thoại: truyền lại `context_id` (và `task_id` khi bên kia đang `input-required`).

## 5. Mesh tools agent có sẵn (`mesh_tools.py`)

| Tool | Làm gì |
|---|---|
| `list_agents` | Liệt kê agent: local + static peers + mesh discovery |
| `send_message` | Gửi tin cho agent khác, chờ trả lời |
| `share_file` | Gửi file trong working dir (chặn path thoát ra ngoài) |
| `needs_input` | Đánh dấu câu trả lời là câu hỏi → A2A `input-required` |

Mesh tools và `ToolSearch` luôn được phép.

## 6. Guardrails (đừng phá)

1. **Tool policy** — nguồn sự thật duy nhất: `sessions.policy_decision` → `allow` / `deny` / `ask`.
   - Thứ tự: `denied_tools` → deny; mesh tool / ToolSearch / `allowed_tools` → allow; còn lại → ask owner.
   - `ask` hết hạn (`approval_timeout_s` = 300s) → **deny**.
   - Áp dụng qua **cả hai** đường: hook `PreToolUse` **và** `can_use_tool`. Lý do: Claude CLI tự duyệt lệnh read-only (vd `ls`) và bỏ qua `can_use_tool` → chỉ hook mới chặn được.
   - Pattern `Bash(prefix*)` không bao giờ match lệnh nối chuỗi (`;`, `&&`, `|`, `` ` ``, `$(`, `<`, `>`, xuống dòng).
   - Mặc định allow: `Read`, `Bash(ls*)`, `Bash(rg *)`, `Bash(grep *)`, `Bash(git status*|log*|diff*)`.
   - CLI hiện tại **không có tool `Glob`/`Grep`** → tìm kiếm qua Bash.
2. **Chống loop**: `max_turns_per_context`=20, `max_agent_turns_per_message`=30, `turn_timeout_s`=600.
3. **Peer không tin cậy**: ID người gửi lấy từ metadata `agentfleet.from_agent` — **chỉ là lời khai, mesh không xác thực**.
4. **File**: chỉ inline, ≤ 5MB, whitelist đuôi file, không bao giờ execute.
5. **Audit log chỉ metadata** (`store.redact` bỏ key chứa text/content/body/prompt/input/message). Bối cảnh health-tech: PHI không được vào audit.

## 7. Owner controls (dashboard)

| Nút | API | Hiệu ứng |
|---|---|---|
| Inject | `POST /api/conversations/{id}/inject` | Đang chạy: chèn prompt vào lượt hiện tại. Rảnh: chạy lượt local, peer không thấy |
| Stop | `/interrupt` | `client.interrupt()` → inbound chuyển sang chờ owner |
| Take over | `/takeover` | mode = manual, ngắt lượt; tin peer tới sẽ chờ owner trả lời tay |
| Reply | `/reply` | Owner trả lời peer bằng tay (409 nếu không ai đang chờ) |
| Hand back | `/handback` | mode = auto, agent chạy tiếp |
| Fork | `/fork` | Copy Claude session ra conversation local mới |
| Approve/Deny | `POST /api/approvals/{id}` | Quyết định tool đang chờ |

Chờ owner quá `manual_reply_timeout_s` (900s) → trả peer câu "owner did not respond in time".

## 8. Trạng thái conversation

`idle` → `running` → (`awaiting_approval` | `awaiting_owner` | `interrupted` | `error` | `idle`). Có enum `done` nhưng code hiện chưa set. Mode: `auto` | `manual`. Direction: `inbound` | `outbound` | `local`.

## 9. Dữ liệu (SQLite `data/node.db`, WAL)

Bảng: `agents`, `conversations` (unique `agent_id+context_id`), `messages` (role: peer/agent/owner/tool/system; kind: text/tool_use/tool_result/status/file), `approvals`, `files`, `audit_log`.
Xoá agent = soft delete (`enabled=False`).

**Invariant**: mọi ghi đều qua `store.Store` — vừa lưu SQLite vừa publish event lên `EventBus` → WebSocket `/api/ws` → dashboard. Ghi vòng qua Store thì dashboard không thấy gì.

Event types: `hello`, `agent`, `agent_removed`, `conversation`, `message`, `delta` (text đang stream, không lưu DB), `approval`, `mesh`.

## 10. Dashboard

- `src/api.ts` là **bản mirror viết tay** của `api.py` + `models.py` + event trong `store.py`. Đổi backend phải đổi cả hai trong cùng commit.
- `src/useLiveState.ts`: store duy nhất — REST snapshot + WS event qua 1 reducer (`applyEvent`), tự reconnect có backoff. Component không tự mở socket.
- Điều hướng bằng React state (`View` trong `App.tsx`), không có router.
- Màu dùng token trong `index.css` (tự đổi dark mode).

## 11. Cấu hình (`AGENTFLEET_*` env / `.env`, file `config.py`)

| Biến | Mặc định |
|---|---|
| `OWNER` | `me` |
| `HOST` / `PORT` | `127.0.0.1` / `9100` |
| `DATA_DIR` | `./data` |
| `MESH_NODE_URL` | `http://127.0.0.1:8080` |
| `MESH_API_TOKEN_PATH` | — (thường `./data/mesh-api-token`) |
| `STATIC_PEERS` | `{}` (dev/test: bỏ qua mesh) |
| `MAX_INLINE_FILE_BYTES` | 5 MB |

## 12. Chạy

```sh
# Hub (1 lần, máy luôn bật)
make hub HUB_HOST=<lan ip>
make hub-token DEVICE="han laptop"      # token dùng 1 lần, gửi riêng cho từng người

# Mỗi máy
make install
make env OWNER=<tên>
# lưu token vào node-server/data/bootstrap-token
make serve                               # node-server + dashboard: http://127.0.0.1:9100
make mesh-node HUB_HOST=<lan ip>         # agentmesh-node

# Dev
make dev     # hot reload :5173
make test    # pytest, dùng FakeClaude, không tốn tiền Claude
make build   # build dashboard (chạy tsc -b)
```

"Done" = `make test` + `make build` pass. Đổi mesh/A2A/session thì chạy thêm real-stack smoke (xem `node-server/CLAUDE.md`).

## 13. Gotchas (đã dính rồi mới biết)

- **Thêm/xoá agent xong phải restart `agentmesh-node`** — nó chỉ đọc `services` lúc khởi động. Dashboard hiện banner khi `config_dirty`.
- `a2a-sdk` 1.3 dùng **protobuf**, không phải pydantic: `HasField`, `msg.metadata.update(...)`, `MessageToDict`, enum kiểu `TaskState.TASK_STATE_COMPLETED`. Ví dụ cũ trên mạng không áp dụng.
- Hub: `--policy-file` chỉ seed ở **lần boot đầu**; sau đó DB của hub là nguồn sự thật. Đổi policy bằng `POST /policies` (thay **toàn bộ** document).
- Policy thiếu `allowed_targets` → mọi call bị 403. Thiếu `allowed_labels: owner=*` → enroll fail "Label not permitted".
- Node pull policy 15 phút/lần → restart node để áp ngay.
- Kết thúc lượt: dựa vào `ResultMessage`. Prompt inject giữa lượt có thể bị gộp vào cùng result → timer `INJECT_GRACE_S` = 3s chốt lượt. Chỉ sửa khi đã test với CLI thật.
- Test: `FakeClaude` hành xử theo từ khoá trong prompt (`TOOL:<Name>`, `SLOW`, `ASK`, còn lại echo). Không bao giờ gọi Claude thật trong test.

## 14. Known gaps (v1)

- Danh tính người gửi không được mesh xác thực.
- Outbound là HTTP blocking cả lượt → lượt dài qua relay có thể bị cắt.
- Chưa có upload file lớn qua hub, chưa có MCP adapter độc lập.
- Dashboard API chưa phân trang message.
- v1 chỉ LAN, hub http thường, không hàng đợi offline.

## 15. Bản đồ file backend (`node-server/src/agentfleet_node/`)

| File | Dòng | Nội dung |
|---|---|---|
| `sessions.py` | 461 | SessionWorker/Manager, policy, approval, takeover, fork — **file lõi** |
| `a2a_bridge.py` | 290 | A2AGateway, MeshAgentExecutor (inbound), OutboundClient |
| `api.py` | 257 | REST `/api/*` + WebSocket `/api/ws` |
| `store.py` | 220 | Store + EventBus + redact |
| `mesh.py` | 154 | MeshDirectory: discover/resolve, sinh `agentmesh-node.yaml` |
| `models.py` | 136 | Bảng SQLModel + enum |
| `mesh_tools.py` | 106 | 4 MCP tool in-process |
| `app.py` | 66 | `build_node` wiring, mount `/a2a` và dashboard |
| `config.py` | 58 | Settings |
| `files.py` | 57 | Kiểm tra/lưu file |
| `naming.py` | 33 | `/` ↔ `.` |
| `cli.py` | 30 | `serve`, `mesh-config` |
