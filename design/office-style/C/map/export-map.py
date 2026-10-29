"""Export the approved image plate, pixel-identical occlusion layer and tile metadata.
Only writes map assets, manifest entries and design QA artifacts. Requires Pillow.
"""
from pathlib import Path
import subprocess

# Owner-authorized Part D map corrections. The scoped exporter preserves every
# unrelated pixel and never writes the shared manifest. Legacy export is retained
# below for historical reference / repositories without the Part D source.
_part_d_root = Path(__file__).resolve().parents[4]
_part_d_package = _part_d_root / 'design/office-style/3d'
if (_part_d_package / 'src/map-export.ts').exists():
    subprocess.run(['bun', 'src/map-export.ts'], cwd=_part_d_package, check=True)
    raise SystemExit(0)

from collections import deque
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
DESIGN = ROOT / 'design/office-style/C/map'
OUT = ROOT / 'dashboard/public/office/map'
OUT.mkdir(parents=True, exist_ok=True)
NN = Image.Resampling.NEAREST
COLS, ROWS, TILE = 56, 36, 32
SIZE = (1792, 1152)
WHITE, BLACK, RED, BLUE = (255,255,255), (0,0,0), (255,0,0), (0,0,255)
palette = [tuple(bytes.fromhex(h.strip()[1:])) for h in (ROOT/'design/office-style/C/palette.txt').read_text().splitlines() if h.strip()]
pal = Image.new('P',(1,1))
pal.putpalette([v for color in palette for v in color] + list(palette[0])*(256-len(palette)))
source = Image.open(DESIGN/'background-source.png').convert('RGB')
# A uniform hard pixel lattice; no antialiasing and no dither during palette conversion.
background = source.resize((896,576), NN).quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB').resize(SIZE, NN)
background.save(OUT/'background.png')

collision = Image.new('RGB',(COLS,ROWS), WHITE)
cd = ImageDraw.Draw(collision)
def block(x0,y0,x1,y1): cd.rectangle((x0,y0,x1,y1), fill=BLACK)
# Outside envelope and back wall face. The entrance is represented on its interior mat.
block(0,0,55,3); block(0,34,55,35); block(0,0,1,35); block(54,0,55,35)
# Manager has a full boundary and ONE opening on its upper left vertical wall.
block(40,14,54,14); block(40,28,54,28); block(40,14,40,28)
cd.rectangle((40,15,40,16),fill=WHITE)
# Left bank: table tops and continuous divider. Side chairs stay walkable.
block(9,7,14,23)
# Bottom bank: exactly eight desks, four in each row; centre divider is blocked too.
block(16,26,35,29)
# Middle pair, including the divider.
block(24,12,30,15); block(27,11,27,16)
# HR and upper-wall fixtures.
for rect in [(10,4,14,5),(6,4,7,4),(31,4,33,4),(34,3,35,5),(36,4,37,5),
             (39,3,41,7),(42,4,50,6),(52,6,53,6),(52,8,53,12),
             (36,11,36,11),(36,30,36,30)]: block(*rect)
# Pantry table and stools. No pantry wall; rug is walkable.
for rect in [(44,9,47,10),(45,11,46,11),(44,11,44,11),(48,10,48,10),(46,8,46,8)]: block(*rect)
# Manager furnishings (rug is walkable).
for rect in [(48,17,53,18),(44,18,48,20),(42,20,42,20),(45,22,47,23),
             (41,20,42,25),(47,24,53,26),(51,22,51,23),(47,27,53,27)]: block(*rect)

seats = []
def seat(id,x,y,face,extras):
    assert collision.getpixel((x,y)) == WHITE, (id,'seat blocked')
    assert all(collision.getpixel(p) == WHITE for p in extras), (id,'extra blocked',extras)
    seats.append({'id':id,'seat':{'x':x,'y':y},'face':face,'extras':[{'x':a,'y':b} for a,b in extras]})
    collision.putpixel((x,y),RED)
for i,y in enumerate([9,13,17,21]):
    seat(f'D{2*i+1}',8,y,'right',[(8,y-1),(8,y+1),(7,y)])
    seat(f'D{2*i+2}',15,y,'left',[(15,y-1),(15,y+1),(16,y)])
for i,x in enumerate([18,23,28,33]):
    seat(f'D{9+i}',x,25,'down',[(x-1,25),(x+1,25),(x,24)])
    seat(f'D{13+i}',x,30,'up',[(x-1,30),(x+1,30),(x,31)])
seat('M1',23,14,'right',[(23,13),(23,15),(25,16)])
seat('M2',31,14,'left',[(31,13),(31,15),(30,16)])
# The Manager Room's armchair behind the large desk is a claimable desk too (owner request, 2026-10-28).
seat('MGR',51,21,'down',[(50,21),(52,21),(51,20)])
seats.sort(key=lambda s: (s['id'] == 'MGR', s['id'].startswith('M'), int(s['id'][1:]) if s['id'][1:].isdigit() else 0))
entrance = (19,4)
assert collision.getpixel(entrance) == WHITE
collision.putpixel(entrance,BLUE)

# Reachability is checked on the actual exported four-color image, not a separate model.
def reachable():
    visited = {entrance}; queue = deque([entrance])
    while queue:
        x,y = queue.popleft()
        for a,b in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if 0<=a<COLS and 0<=b<ROWS and (a,b) not in visited and collision.getpixel((a,b)) != BLACK:
                visited.add((a,b)); queue.append((a,b))
    return visited
visited = reachable()
missing = {(x,y) for y in range(ROWS) for x in range(COLS) if collision.getpixel((x,y)) != BLACK} - visited
assert not missing, ('disconnected floor',sorted(missing))
collision.save(OUT/'collision.png')
(OUT/'seats.json').write_text(json.dumps(seats,indent=2)+'\n')

# Foreground is EXTRACTED from the final palette background, never independently repainted.
# Coordinates below use the 1564x1006 reference plane for easy visual auditing.
mask = Image.new('L',SIZE,0)
md = ImageDraw.Draw(mask)
def rect(x0,y0,x1,y1):
    # Snap every mask edge to the same two-pixel lattice as the background.
    b = tuple(round(v/s*o/2)*2 for v,s,o in zip((x0,y0,x1,y1),(1564,1006,1564,1006),(1792,1152,1792,1152)))
    md.rectangle(b,fill=255)
def polygon(points):
    md.polygon([(round(x/1564*1792/2)*2,round(y/1006*1152/2)*2) for x,y in points],fill=255)
# Desk front aprons and dividers; monitors and backs are limited to their actual silhouettes.
for y in [210,322,434,546]:
    rect(249,y+88,418,y+105)
    polygon([(278,y+30),(294,y+6),(303,y+6),(303,y+69),(283,y+69)])
    polygon([(359,y+6),(370,y+10),(383,y+67),(366,y+68)])
    # Main chair backs: preserve the open seat area below them.
    polygon([(211,y+33),(217,y+19),(229,y+20),(235,y+34),(230,y+64),(216,y+64)])
    polygon([(433,y+20),(445,y+20),(454,y+35),(454,y+63),(441,y+64),(434,y+48)])
rect(320,187,334,662)
# Middle paired desks, its monitors, and back portions of its two chairs.
rect(686,426,850,454); rect(761,327,775,459)
polygon([(716,365),(731,343),(739,346),(739,402),(721,404)])
polygon([(797,344),(805,348),(822,400),(805,404)])
polygon([(650,380),(655,365),(669,366),(675,381),(668,408),(653,408)])
polygon([(869,366),(882,369),(890,381),(887,408),(875,409),(869,392)])
# Bottom bank: table front edges and monitor upper bands.
rect(439,770,991,791); rect(440,835,991,850)
for x in [480,620,760,900]:
    rect(x,738,x+48,759); rect(x,793,x+48,814)
    polygon([(x+2,717),(x+5,708),(x+39,708),(x+46,717),(x+44,737),(x+2,737)])
    polygon([(x+2,839),(x+6,830),(x+40,830),(x+46,839),(x+43,861),(x+3,861)])
# HR and manager desktop fronts + monitor tops.
rect(291,152,424,168); rect(329,119,384,139)
rect(1310,711,1491,731); rect(1389,645,1445,675)
rect(1409,589,1450,611)
# Table front rim bands, including legs only where they meet the front edge.
polygon([(1234,297),(1250,305),(1280,310),(1320,307),(1349,296),(1346,310),(1320,320),(1262,322),(1238,312)])
polygon([(1257,622),(1274,636),(1320,636),(1338,624),(1335,641),(1312,650),(1275,648),(1260,637)])
# Leaves, not the entire pot/background. Color filtering in tight regions preserves crisp outlines.
leaf_regions = [(176,49,229,106),(997,53,1061,123),(1447,122,1506,185),
                (970,230,1047,303),(1168,488,1230,551),(1481,509,1518,552),
                (997,769,1066,839),(1144,574,1178,605)]
leaf_colors = {tuple(bytes.fromhex(h)) for h in ['658C8C','70A65B','9FCA80','48506C','2C283C','48506C','71799A']}
for region in leaf_regions:
    x0,y0,x1,y1 = [round(v/s*o/2)*2 for v,s,o in zip(region,(1564,1006,1564,1006),(1792,1152,1792,1152))]
    for y in range(y0,y1,2):
        for x in range(x0,x1,2):
            if background.getpixel((x,y)) in leaf_colors: md.rectangle((x,y,x+1,y+1),fill=255)
# The front wall of manager room and the near exterior wall occlude feet behind them.
rect(1120,782,1536,811); rect(27,953,1536,982)
# Warm board-floor pixels accidentally caught at curved/rectangular mask corners
# must never become occluders. Furniture outlines and rim shading remain intact.
floor_colors = {palette[i] for i in [5,6,7,8,9,10,12]}
for y in range(0,SIZE[1],2):
    for x in range(0,SIZE[0],2):
        if mask.getpixel((x,y)) and background.getpixel((x,y)) in floor_colors:
            md.rectangle((x,y,x+1,y+1),fill=0)
foreground = background.convert('RGBA'); foreground.putalpha(mask)
# Transparent RGB is cleared for deterministic import into renderers.
clean = Image.new('RGBA',SIZE,(0,0,0,0)); clean.paste(foreground,(0,0),mask)
clean.save(OUT/'foreground.png')

# Requested 16x collision overlay, exactly 896x576, with a separate readable grid QA copy.
small_background = background.resize((896,576),NN)
small_collision = collision.resize((896,576),NN)
overlay = Image.blend(small_background,small_collision,0.5)
overlay.save(OUT/'collision@16x.png')
qa = overlay.copy(); qd = ImageDraw.Draw(qa)
for x in range(0,897,16): qd.line((x,0,x,575),fill=(108,99,124),width=1)
for y in range(0,577,16): qd.line((0,y,895,y),fill=(108,99,124),width=1)
for s in seats:
    x,y=s['seat'].values(); qd.text((x*16+1,y*16+3),s['id'],fill=(255,255,255),stroke_width=0)
qa.save(DESIGN/'collision-grid-review.png')
manifest_path=ROOT/'dashboard/public/office/manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['map']={name:f'office/map/{name}.png' for name in ['background','foreground','collision']}
manifest['map']['seats']='office/map/seats.json'
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')

# Required export invariants.
red_pixels={(x,y) for y in range(ROWS) for x in range(COLS) if collision.getpixel((x,y))==RED}
assert red_pixels=={(s['seat']['x'],s['seat']['y']) for s in seats}
assert len(red_pixels)==len(seats)==19
assert {s['id'] for s in seats}=={f'D{i}' for i in range(1,17)}|{'M1','M2','MGR'}
assert all(len(s['extras']) in range(2,5) and all((p['x'],p['y']) in visited for p in s['extras']) for s in seats)
assert set(background.getdata()) <= set(palette)
assert set(foreground.getchannel('A').getdata()) <= {0,255}
stacked=Image.alpha_composite(background.convert('RGBA'),clean)
assert stacked.tobytes()==background.convert('RGBA').tobytes()
for name,size in {'background.png':SIZE,'foreground.png':SIZE,'collision.png':(56,36),'collision@16x.png':(896,576)}.items():
    assert Image.open(OUT/name).size==size
report={'sizes':'PASS','palette_colors':len(set(background.getdata())), 'foreground':'binary alpha; exact source pixels; stack is identical to background',
        'desks':len(seats),'red_pixels':len(red_pixels),'entrance':{'x':19,'y':4}, 'reachable_walkable_tiles':len(visited),
        'unreachable_walkable_tiles':len(missing),'extras_per_desk':3,'collision_colors':['#000000','#FFFFFF','#FF0000','#0000FF']}
(DESIGN/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
