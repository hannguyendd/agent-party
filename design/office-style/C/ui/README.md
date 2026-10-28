# Office UI chrome assets

Delivery directory: `dashboard/public/office/ui/`. All 61 PNGs are listed by filename stem under `manifest.json` → `ui`. Existing manifest sections and entries are preserved.

## Icons

Every icon below is 16×16 with a matching `@2x.png` at 32×32, except `online.png`, which is 8×8 with `online@2x.png` at 16×16 as requested.

| Icon | Filename |
|---|---|
| Office building | office.png |
| Two agents | agents.png |
| Approvals bell | approvals.png |
| Pending approvals bell with dot | approvals-pending.png |
| Address book | directory.png |
| Gear | settings.png |
| Zoom in | zoom-in.png |
| Zoom out | zoom-out.png |
| Fit / house | fit.png |
| Close | close.png |
| Send / paper plane | send.png |
| Stop | stop.png |
| Take over / hand | takeover.png |
| Hand back / hand with arrow | handback.png |
| Fork / branch | fork.png |
| Inject / bubble with plus | inject.png |
| Inquiry / magnifier | inquiry.png |
| Assignment / wrench on clipboard | assignment.png |
| Party / three heads | party.png |
| Recap / notebook with check | recap.png |
| Host / crown | host.png |
| Desk | desk.png |
| Back / left arrow | back.png |
| Notifications / bell with waves | notifications-on.png |
| Online dot | online.png |
| Away / sleep pictogram | away.png |

## Logo and game UI

| File | Size | Details |
|---|---|---|
| logo.png | 32×32 | Office building and speech bubble |
| logo@2x.png | 64×64 | Exact nearest-neighbour enlargement |
| favicon.png | 32×32 | Same art as logo |
| bubble.png | 24×24 | Nine-slice: 4px insets on each side; 4px corner radius, 1px #48506C outline |
| bubble-tail.png | 8×6 | Upper edge joins panel without a dark seam |
| ring.png | 32×16 | Palette-white ellipse, 1px stroke |
| ring-selected.png | 36×18 | Palette-white ellipse, 2px stroke |
| target.png | 96×16 | Three horizontal 32×16 frames; #70A65B floor marker |
| typing.png | 48×8 | Three horizontal 16×8 frames; staggered three-dot indicator |

All visible pixels use only `design/office-style/C/palette.txt`. White is the palette's `#FEFDFB`; no #FFFFFF was added. Alpha is binary, with no antialiasing, gradients, smoothing, dithering or semitransparent edges. Sleep Zs and typing dots are the explicitly requested pictograms; there are no labels or words in runtime images.

Icons and geometric game UI were authored directly at native pixel size. Logo artwork was generated with the built-in image_gen tool, then thresholded, palette-matched and exported at native size. Its prompt and source are preserved here.

`export-ui.py` (Pillow) reproduces the batch, validates dimensions, visible palette colors, alpha, and exact nearest-neighbour @2x exports, and updates only UI manifest entries. It records the complete inventory and SHA-256 hashes in `validation.json`.

`icons-review.png` shows icons against #FDF8F2 and #2C283C. Labels are present only on this design QA board.

No application code, character assets, object assets, or map assets were changed by this batch.
