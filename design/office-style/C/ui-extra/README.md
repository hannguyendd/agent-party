# Additional Office UI icons

24 transparent PNGs in `dashboard/public/office/ui/`: 12 native 16×16 icons and their exact nearest-neighbour 32×32 `@2x.png` versions.

Names: `attach`, `image`, `file`, `pantry`, `mention`, `question`, `search`, `keyboard`, `new-chat`, `people`, `clock`, `check`.

All are listed by filename stem in `manifest.json` → `ui`. Existing entries are preserved. Dark outlines are 1px #48506C, with palette C fills. Requested @, question-mark and plus symbols are icon pictograms; runtime images contain no labels.

`icons-review.png` displays each icon against #FDF8F2 and #2C283C. Labels are only on the design review board.

`export-icons.py` reproduces the PNGs and writes `icons-validation.json`. Validation checks every saved image's exact size, binary alpha, visible palette colors, and exact nearest-neighbour enlargement. Icons are drawn directly at native pixel resolution, without antialiasing or blur.

This batch changes only image assets, manifest entries and design notes/scripts.
