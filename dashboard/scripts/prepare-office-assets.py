"""Slice the approved, image-generated art into runtime PNGs. No drawn replacements.
Run from any directory: python3 dashboard/scripts/prepare-office-assets.py (Pillow required).
"""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'design/office-style/C/production'
OUT = ROOT / 'dashboard/public/office'
NN = Image.Resampling.NEAREST
skins = ['dev-hoodie', 'designer', 'lead', 'shiba', 'cat', 'penguin', 'alien', 'robot']
objects = ['plant', 'fridge', 'sink', 'coffee', 'chair', 'chair-back', 'stool', 'printer', 'sofa', 'whiteboard', 'table', 'bookshelf', 'desk', 'desk-side', 'mat', 'door']


def cut(im, box):
    cell = im.crop(box).convert('RGBA')
    # Generated alpha contains fractional fringes. Game pixels have binary alpha.
    cell.putalpha(cell.getchannel('A').point(lambda a: 255 if a >= 160 else 0))
    bounds = cell.getchannel('A').getbbox()
    return cell.crop(bounds) if bounds else cell


props = Image.open(SOURCE / 'props-source.png')
chars = Image.open(SOURCE / 'characters-source.png')
raw = {}
for i, name in enumerate(objects):
    col, row = i % 4, i // 4
    box = (round(col * props.width / 4), round(row * props.height / 4), round((col+1)*props.width/4), round((row+1)*props.height/4))
    # The generated wide desk intentionally occupies more than one nominal cell.
    if name == 'desk': box = (8, 962, 394, 1234)
    if name == 'desk-side': box = (410, 962, 636, 1234)
    item = cut(props, box)
    ratio = min(96/item.width, 96/item.height)
    raw[f'objects/{name}'] = item.resize((max(1, round(item.width*ratio)), max(1, round(item.height*ratio))), NN)
poses = {}
for row, name in enumerate(skins):
    top, bottom = [(40,245),(245,448),(448,650),(650,841),(841,1033),(1033,1197),(1197,1367),(1367,1536)][row]
    cells = [cut(chars, (col*256, top, (col+1)*256, bottom)) for col in range(4)]
    # Shared scale per character keeps pose sizes consistent; feet anchored at y=47.
    ratio = min(30/max(c.width for c in cells), 46/max(c.height for c in cells))
    for col, cell in enumerate(cells):
        cell = cell.resize((max(1, round(cell.width*ratio)), max(1, round(cell.height*ratio))), NN)
        frame = Image.new('RGBA', (32, 48))
        frame.alpha_composite(cell, ((32-cell.width)//2, 47-cell.height))
        poses[name, col] = frame
        raw[f'poses/{name}-{col}'] = frame
# One shared 32-color palette, plus transparent alpha; ignore transparent RGB when training.
training = Image.new('RGB', (512, 512), '#ffe1c6')
x = y = 0
for item in raw.values():
    if x+item.width > 512: x=0; y+=96
    training.paste(item, (x,y), item)
    x+=item.width
palette = training.quantize(colors=32, dither=Image.Dither.NONE)
palette_colors = palette.getpalette()
(OUT/'palette.txt').write_text(''.join('#%02X%02X%02X\n'%tuple(palette_colors[i:i+3]) for i in range(0,96,3)))

def limited(im):
    rgb = im.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    rgb.putalpha(im.getchannel('A'))
    return rgb

for name in objects:
    limited(raw[f'objects/{name}']).save(OUT/f'objects/{name}.png')
for name in skins:
    front, side, back, seated = [limited(poses[name, col]) for col in range(4)]
    seated = ImageOps.mirror(seated) # atlas sitting poses face right; runtime base faces left
    sheet = Image.new('RGBA', (128,240))
    frames = [front]*4 + [side]*4 + [back]*4 + [front, seated, back, front, seated, seated, front, front]
    for i, frame in enumerate(frames):
        # Discrete one-pixel body cadence; no subpixel scaling during walking.
        sheet.alpha_composite(frame, ((i%4)*32, (i//4)*48-(1 if i<12 and i%2 else 0)))
    sheet.save(OUT/f'characters/{name}.png')
    front.save(OUT/f'characters/{name}-portrait.png')
manifest = {'style':'pastel-c', 'reference':'office-preview-v3', 'characters':{name:f'office/characters/{name}.png' for name in skins}, 'objects':{name:f'office/objects/{name}.png' for name in objects}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared 8 directional character sheets, 8 portraits, 16 objects, one shared palette.')
