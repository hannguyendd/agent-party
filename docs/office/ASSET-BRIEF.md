# Office — asset brief cho Codex

Brief để Codex vẽ toàn bộ hình ảnh cho **Office**: văn phòng ảo dạng game 2D, nơi agent của cả team hiện thành
nhân vật. Thuật ngữ (Office, Desk, Skin, Party, Host…) theo `CONTEXT.md` ở gốc repo.

Prompt gửi Codex viết bằng tiếng Anh (model ảnh hiểu tốt hơn); giải thích cho người đọc viết tiếng Việt.

> **Bản quyền:** mọi thiết kế phải là bản gốc. Không sao chép hay "lấy cảm hứng sát" nhân vật, tileset hay UI của
> Pokémon, Gather, Stardew Valley hay bất kỳ game nào. Chỉ dùng chung *thể loại* (top-down pixel RPG).

---

## 1. Style guide (gửi kèm MỌI prompt)

```
STYLE: original top-down 3/4 view pixel art (classic 2D RPG camera: we see the top and the front face of objects).
Grid 32x32 px. Crisp pixels, no anti-aliasing, no blur, no gradients, no dithering noise.
Limited palette of at most 32 colors, consistent across all assets; warm, friendly, modern office mood.
Light comes from the top-left. 1 px darker outline on characters and furniture (not pure black).
Transparent background (PNG with alpha). Every sprite aligned to the pixel grid, no sub-pixel offsets.
Exact pixel sizes as specified; do not upscale; do not add drop shadows outside the frame.
```

Kỹ thuật:
- Vẽ ở **tỉ lệ 1x** (1 pixel ảnh = 1 pixel game). Game tự phóng to 2x hoặc 3x bằng nearest-neighbor.
- Một file PNG cho mỗi nhóm. Spritesheet xếp lưới đều, **không có khoảng cách giữa các frame**.
- Tên file `kebab-case`, đặt vào `dashboard/public/office/<nhóm>/`.

---

## 2. Nhân vật: 8 skin

Owner chọn 1 trong 8 skin khi đăng ký agent. Nhiều agent dùng chung một skin được: phân biệt bằng tên trên đầu và
**vòng màu owner** dưới chân (code tự vẽ, không cần asset riêng cho từng màu).

| # | File | Skin | Gợi ý chi tiết |
|---|---|---|---|
| 1 | `char-dev-hoodie.png` | Người: dev áo hoodie | hoodie xanh, tai nghe đeo cổ |
| 2 | `char-designer.png` | Người: designer | tóc búi, áo len màu cam, kính tròn |
| 3 | `char-lead.png` | Người: tech lead | sơ mi xắn tay, râu ngắn, cầm cốc |
| 4 | `char-shiba.png` | Động vật: chó shiba | đứng hai chân, áo polo |
| 5 | `char-cat.png` | Động vật: mèo | mèo mướp, khăn quàng cổ |
| 6 | `char-penguin.png` | Động vật: chim cánh cụt | cà vạt nơ |
| 7 | `char-alien.png` | Alien xanh lá | đầu to, 3 mắt, áo khoác lab |
| 8 | `char-robot.png` | Robot | thân tròn, màn hình mặt hiện mắt pixel |

### Bố cục spritesheet (giống nhau cho cả 8 skin)

- Frame **32×48 px**. Chân nhân vật chạm đáy frame, nhân vật cao khoảng 40 px.
- Sheet **4 cột × 5 hàng = 128×240 px**:

| Hàng | Nội dung | 4 frame |
|---|---|---|
| 0 | Đi xuống (mặt hướng camera) | bước trái, đứng, bước phải, đứng |
| 1 | Đi sang trái | như trên |
| 2 | Đi lên (quay lưng) | như trên |
| 3 | Ngồi: xuống, trái, lên, + 1 frame "giơ tay" (chào/được chọn) | 4 frame khác nhau |
| 4 | Ngồi gõ phím hướng xuống ×2, đứng thở hướng xuống ×2 | 4 frame |

- **Không vẽ hướng phải**: code lật ngang từ hàng 1.
- Mọi frame giữ đúng khuôn mặt, màu và tỉ lệ. Đây là lỗi AI hay mắc nhất, kiểm tra kỹ trước khi nhận.

Prompt mẫu:
```
<STYLE>
Character sprite sheet, 128x240 px, grid of 4 columns x 5 rows, each frame 32x48 px, transparent background.
Character: <mô tả skin>, cute chibi proportions (big head, short body), same design in every frame.
Row 0: walking down toward camera (left step, stand, right step, stand).
Row 1: walking left (same 4-beat cycle). Row 2: walking up, back view (same cycle).
Row 3: sitting on a chair facing down, sitting facing left, sitting facing up, standing waving one hand.
Row 4: sitting typing facing down (2 frames), standing idle breathing facing down (2 frames).
Feet touch the bottom edge of each frame. No text, no frame borders.
```

---

## 3. Tileset nền: `tiles-office.png`

Ô **32×32**, sheet rộng **8 ô (256 px)**, cao tuỳ số ô. Dùng để ghép map trong Tiled.

| Nhóm | Ô cần có |
|---|---|
| Sàn văn phòng | thảm xám xanh ×3 biến thể (để lặp không lộ) |
| Sàn Pantry | gỗ sáng ×2 biến thể |
| Sàn Manager Room | thảm ấm (be/nâu) ×2 |
| Sàn lối vào + HR | gạch sáng ×2, thảm chùi chân cửa ×1 |
| Tường | mặt tường (cao 2 ô: mép trên + mặt trước), góc trong/ngoài ×4, đầu tường, tường có cửa sổ ×2, tường kính (Manager Room) ×3 |
| Vách ngăn bàn | vách thấp ngang, vách thấp dọc, đầu vách |
| Khung cửa | lỗ cửa trên tường ngang, lỗ cửa trên tường dọc |

Prompt mẫu:
```
<STYLE>
Seamless tileset, 32x32 px tiles, sheet 256 px wide, tiles packed in a grid with no gaps.
Include: <liệt kê ô theo bảng>. Floor tiles must tile seamlessly in every direction.
Walls are 2 tiles tall in 3/4 view (top edge + front face). No characters, no text.
```

---

## 4. Đồ vật: `objects-*.png`

Kích thước theo bội số 32 px. Mỗi nhóm một sheet; mỗi đồ vật nằm trong ô lưới riêng, nền trong suốt.

### `objects-desks.png`: bàn làm việc (18 bàn + máy HR dùng chung bộ này)
| Đồ vật | Kích thước | Ghi chú |
|---|---|---|
| Bàn đơn, người ngồi quay lên | 64×32 | mặt bàn, bàn phím, chuột |
| Bàn đơn, người ngồi quay xuống | 64×32 | |
| Màn hình bật / tắt | 32×32 ×2 | tắt = owner offline |
| Ghế văn phòng 4 hướng | 32×32 ×4 | |
| Ghế đẩu phụ | 32×32 | cho agent thứ 2, 3… ngồi quanh bàn |
| Đồ trên bàn | 32×32 ×6 | cốc cà phê, cây nhỏ, chồng giấy, laptop, đèn bàn, figure đồ chơi |
| Bảng tên bàn | 32×16 | trống, code in chữ D1…D16, M1, M2 |

### `objects-pantry.png`
Quầy bếp (96×64), tủ lạnh (32×64), máy pha cà phê (32×32), bồn rửa (32×32), cây nước (32×64), bàn tròn (64×64), ghế bar ×2 hướng, lò vi sóng (32×32).

### `objects-manager.png`
Bàn sếp lớn (96×64), ghế sếp, sofa 2 chỗ (64×32, 2 hướng), kệ sách (64×64), bảng trắng (64×64), cây lớn (32×64), thảm (96×64).

### `objects-decor.png`
Cây chậu ×3 kiểu (32×64), máy in (32×32), thùng rác, đồng hồ treo tường, poster ×3 (32×32, nội dung chung chung, không có logo thật), máy HR (bàn nhỏ + PC, 64×64), cửa ra vào đôi mở/đóng (64×64 ×2).

---

## 5. UI và hiệu ứng: `ui-*.png`

| File | Nội dung | Kích thước |
|---|---|---|
| `ui-ring.png` | Vòng elip dưới chân, **màu trắng** (code nhuộm theo màu owner) + vòng "đang được chọn" có viền đậm | 32×16 ×2 |
| `ui-label.png` | Nền bảng tên trên đầu, 9-slice (bo góc, nửa trong suốt) | 24×12 |
| `ui-bubble.png` | Bong bóng thoại 9-slice + đuôi bong bóng + 3 frame chấm `…` nhảy | 24×24 + 8×8 + 16×8 ×3 |
| `ui-status.png` | Icon trạng thái trên đầu, 16×16 mỗi icon: đang làm (bánh răng hoặc `…`), chờ duyệt `!`, đang gọi owner (chuông), lỗi `×`, owner vắng (`z`), xong (dấu tick), Assignment chờ nhận (bìa kẹp hồ sơ) | 16×16 ×7 |
| `ui-host.png` | Biểu tượng Host của Party (vương miện nhỏ hoặc ngôi sao) | 16×16 |
| `ui-party.png` | Vòng tròn đứt nét trên sàn bao quanh nhóm Party, 9-slice | 48×48 |
| `ui-target.png` | Dấu đích trên sàn khi click để di chuyển, 3 frame co giãn | 32×32 ×3 |
| `ui-menu.png` | Khung menu ngữ cảnh 9-slice + icon 16×16: **Inquiry** (kính lúp), **Assignment** (cờ lê/bìa hồ sơ), **Mời vào Party** (người +), **Về bàn** (ngôi nhà), **Mở conversation** (bong bóng), **Recap** (cuốn sổ có dấu tick), **Giao host** (vương miện có mũi tên) | 24×24 + 16×16 ×7 |
| `ui-card.png` | Khung thẻ xác nhận "Nhận / Từ chối" Assignment, 9-slice, 2 nút | 32×32 + 48×16 ×2 |
| `app-icon.png` | Icon cho thông báo trình duyệt / OS | 128×128 và 64×64 |

Lưu ý: UI vẫn là pixel art, nhưng **chữ do code render**. Không vẽ chữ vào ảnh.

---

## 6. Map: để dev dựng bằng Tiled, Codex không vẽ

Bố cục theo văn phòng thật, nới rộng để agent không kẹt nhau. Khoảng **56×36 ô** (1792×1152 px ở 1x).

```
      [HR] 🚪                                  HR: khu mở, 1 máy · cửa ra vào ngay bên phải HR
D1 | D2                ┌───────────────┐
D3 | D4                │    Pantry     │       Pantry có tường
D5 | D6    M1 | M2     ├───────────────┤
D7 | D8                │ Manager Room  │
      D9 | D10| D11| D12│               │       D9–D16 sát tường Manager Room
      D13| D14| D15| D16│               │
```

- Mỗi cặp `X | X` = 2 bàn ghép qua vách ngăn. Mỗi bàn chiếm cụm khoảng **5×4 ô**, đủ cho ghế chính và 3–5 ghế đẩu quanh bàn.
- Lối đi chính rộng **3 ô**.
- Agent mới online xuất hiện ở **cửa cạnh HR**.
- Party tụ ở đâu cũng được, kể cả quanh một bàn.

Cần sửa bố cục thì sửa sơ đồ này trước, rồi mới dựng Tiled.

---

## 7. Công nghệ sẽ dùng asset

- **Office UI:** Phaser 3, nhúng vào dashboard React như một view `office`. Spritesheet nạp bằng `load.spritesheet`
  (frame 32×48), tileset và map bằng Tiled JSON (`.tmj`).
- **World server:** lệnh `agentfleet-node world` (FastAPI + WebSocket) trong `node-server`, chạy trên máy hub
  (`make world`). Giữ vị trí, owner có mặt, Party; bàn đã nhận lưu SQLite. Không giữ nội dung tin nhắn (ADR 0001).

### Triển khai

```
MÁY SERVER (1 bản, IP LAN cố định):  agentmesh-one :7400  +  world server :7500
MÁY MỖI USER:                         agentmesh-node :8080 +  node-server :9100 (agent, Claude CLI, dashboard + Office)
Trình duyệt user mở:                  http://127.0.0.1:9100  → node-server máy mình → world server
```

- Agent chạy trên máy user (cần source code và Claude CLI ở đó); server chỉ nối mạng và giữ trạng thái Office.
- Máy user cấu hình `AGENTFLEET_WORLD_URL=ws://<ip server>:7500` trong `node-server/.env`.
- Máy server: IP LAN cố định, mở port 7400 và 7500 cho LAN.

## 8. Thứ tự giao asset (gợi ý)

1. **Style test:** 1 skin (`char-dev-hoodie`) + 6 ô sàn/tường + 1 bàn. Duyệt style xong mới làm tiếp.
2. 7 skin còn lại.
3. Tileset + bàn (đủ để dựng map).
4. Pantry, Manager Room, decor.
5. UI và hiệu ứng.

## 9. Checklist nhận asset

- [ ] Đúng kích thước pixel, nền trong suốt, không viền/khoảng cách giữa frame
- [ ] Cùng bảng màu với style test
- [ ] Nhân vật giữ nguyên mặt và màu ở mọi frame
- [ ] Sàn lặp không lộ đường nối
- [ ] Không có chữ, logo, hay nhân vật của game khác
