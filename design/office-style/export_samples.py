"""Export generated style concepts as limited-palette pixel-art samples."""
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent
sources = json.loads((ROOT / 'sources.json').read_text())
NN = Image.Resampling.NEAREST
for letter, spec in sources.items():
    out = ROOT / letter
    office = Image.open(spec['office']).convert('RGB').resize((896, 576), NN)
    original = Image.open(spec['cast']).convert('RGB')
    bg = {'A': (250, 244, 232), 'B': (242, 246, 250), 'C': (253, 248, 242)}[letter]
    cast = Image.new('RGB', (336, 64), bg)
    for index in range(8):
        bounds = [(0, 248), (252, 480), (484, 714), (716, 957),
                  (960, 1193), (1195, 1445), (1447, 1702), (1705, 1983)]
        left, right = bounds[index]
        cell = original.crop((round(left * original.width / 1983), 0,
                              round(right * original.width / 1983), original.height))
        background = Image.new('RGB', cell.size, cell.getpixel((0, 0)))
        diff = ImageChops.difference(cell, background)
        mask = diff.convert('L').point(lambda v: 255 if v > 42 else 0)
        # Ignore neighboring sprite fragments at the edges of generated cast cells.
        seen = set()
        largest = []
        mp = mask.load()
        for yy in range(mask.height):
            for xx in range(mask.width):
                if not mp[xx, yy] or (xx, yy) in seen:
                    continue
                todo = deque([(xx, yy)])
                seen.add((xx, yy))
                component = []
                while todo:
                    x, y = todo.popleft()
                    component.append((x, y))
                    for nx, ny in ((x-1,y), (x+1,y), (x,y-1), (x,y+1)):
                        if 0 <= nx < mask.width and 0 <= ny < mask.height and mp[nx, ny] and (nx, ny) not in seen:
                            seen.add((nx, ny))
                            todo.append((nx, ny))
                if len(component) > len(largest):
                    largest = component
        box = (min(x for x,y in largest), min(y for x,y in largest),
               max(x for x,y in largest)+1, max(y for x,y in largest)+1) if largest else mask.getbbox()
        if box:
            cell = cell.crop(box)
        scale = min(32 / cell.width, 48 / cell.height)
        size = (max(1, round(cell.width * scale)), max(1, round(cell.height * scale)))
        cell = cell.resize(size, NN)
        pixels = cell.load()
        for y in range(cell.height):
            for x in range(cell.width):
                rgb = pixels[x, y]
                if min(rgb) > 222 and max(rgb) - min(rgb) < 25:
                    pixels[x, y] = bg
        cast.paste(cell, (index * 42 + (42 - cell.width) // 2, 56 - cell.height))
    # Both assets share one palette; no dithering introduces intermediate colors.
    training = Image.new('RGB', (896, 576), bg)
    training.paste(office.resize((448, 288), NN), (0, 0))
    training.paste(cast.resize((896, 170), NN), (0, 288))
    palette = training.quantize(colors=28, method=Image.Quantize.MEDIANCUT,
                                dither=Image.Dither.NONE)
    entries = palette.getpalette()
    entries[84:96] = [112,166,91, 159,202,128, 247,187,144, 206,130,98]
    # Repeat valid entries to prevent unused black palette slots affecting matching.
    entries[96:] = entries[:3] * ((768 - 96) // 3)
    palette.putpalette(entries)
    office = office.quantize(palette=palette, dither=Image.Dither.NONE)
    cast = cast.quantize(palette=palette, dither=Image.Dither.NONE)
    office.resize((1792, 1152), NN).save(out / 'office.png')
    cast.save(out / 'cast.png')
    cast.resize((1344, 256), NN).save(out / 'cast@4x.png')
    used = sorted(set(office.getdata()) | set(cast.getdata()))
    colors = palette.getpalette()
    (out / 'palette.txt').write_text(''.join('#%02X%02X%02X\n' % tuple(colors[i*3:i*3+3]) for i in used))
    (out / 'prompts.txt').write_text('Generated with the built-in image_gen tool.\n\n' +
                                  '\n\n'.join(k.upper() + '\n' + v for k, v in spec['prompts'].items()))
    print(letter, 'office', (1792, 1152), 'cast', cast.size, 'colors', len(used))
