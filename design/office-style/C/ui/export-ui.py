"""Native pixel-authored Office UI assets. Pillow only; no application-code changes.
Writes UI PNGs and adds manifest ui entries. All art pixels use pastel C palette.
"""
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[4]
DESIGN = ROOT/'design/office-style/C/ui'
OUT = ROOT/'dashboard/public/office/ui'
OUT.mkdir(parents=True,exist_ok=True)
NN=Image.Resampling.NEAREST
PALETTE=[tuple(bytes.fromhex(h[1:])) for h in (ROOT/'design/office-style/C/palette.txt').read_text().splitlines()]
INK='#48506C'; WHITE='#FEFDFB'; MINT='#9DD6B7'; GREEN='#70A65B'; PEACH='#F4B592'; LAV='#CCB2CB'; YELLOW='#FEFAE1'; DARK='#2C283C'
icons={}

def canvas(w=16,h=16):
    im=Image.new('RGBA',(w,h),(0,0,0,0)); return im,ImageDraw.Draw(im)
def box(d,b,fill=WHITE,r=0):
    if r: d.rounded_rectangle(b,radius=r,fill=fill,outline=INK,width=1)
    else: d.rectangle(b,fill=fill,outline=INK,width=1)
def poly(d,p,fill=WHITE): d.polygon(p,fill=fill,outline=INK,width=1)
def stroke(d,p,fill=WHITE):
    d.line(p,fill=INK,width=3); d.line(p,fill=fill,width=1)
def dot(d,x,y,fill=INK): d.rectangle((x,y,x+1,y+1),fill=fill)
def head(d,x,y,color=PEACH):
    d.ellipse((x,y,x+4,y+4),fill=color,outline=INK,width=1)
def person(d,x,y,color=MINT):
    head(d,x+1,y); box(d,(x,y+5,x+6,y+9),color,2)
def bell(d,pending=False,waves=False):
    dot(d,7,1,PEACH)
    poly(d,[(5,3),(10,3),(12,5),(12,10),(14,12),(1,12),(3,10),(3,5)],YELLOW)
    d.line((5,11,10,11),fill=PEACH,width=1)
    box(d,(6,13,9,14),PEACH)
    if pending:
        d.ellipse((10,0,15,5),fill=INK);d.ellipse((11,1,14,4),fill=PEACH)
    if waves:
        d.point((1,4),fill=WHITE);d.line((0,5,0,8),fill=WHITE);d.point((1,9),fill=WHITE)
        d.point((14,4),fill=WHITE);d.line((15,5,15,8),fill=WHITE);d.point((14,9),fill=WHITE)
def hand(d,arrow=False):
    poly(d,[(4,8),(3,6),(1,6),(1,9),(4,13),(9,14),(12,11),(12,4),(10,3),(9,5),(9,2),(7,1),(6,3),(6,6),(5,3),(3,3),(3,5),(4,8)],PEACH)
    if arrow:
        stroke(d,[(10,5),(14,5),(14,9)],MINT)
        poly(d,[(11,8),(15,8),(13,11)],MINT)

def make(name):
    im,d=canvas()
    if name=='office':
        poly(d,[(1,5),(8,1),(14,5)],PEACH);box(d,(2,5,13,14),WHITE);box(d,(6,10,9,14),MINT)
        for x in [4,10]:box(d,(x,7,x+1,8),LAV)
    elif name=='agents': person(d,1,3,LAV);person(d,8,2,MINT)
    elif name in ['approvals','approvals-pending','notifications-on']:
        bell(d,name=='approvals-pending',name=='notifications-on')
    elif name=='directory':
        box(d,(3,1,13,14),LAV,1);d.line((5,2,5,13),fill=WHITE)
        head(d,7,4,WHITE);d.line((7,10,11,10),fill=INK)
        for y in [4,8,12]:d.line((1,y,3,y),fill=WHITE,width=1)
    elif name=='settings':
        poly(d,[(6,1),(9,1),(9,3),(11,4),(13,3),(15,6),(13,8),(13,10),(14,12),(11,14),(9,12),(7,13),(6,15),(3,13),(4,11),(3,9),(1,9),(1,6),(3,6),(4,4),(3,2),(6,1)],LAV)
        d.ellipse((5,5,10,10),fill=WHITE,outline=INK,width=1)
    elif name in ['zoom-in','zoom-out','inquiry']:
        d.ellipse((1,1,10,10),fill=INK);d.ellipse((2,2,9,9),fill=WHITE)
        poly(d,[(9,8),(14,12),(12,14),(8,9)],MINT)
        if name!='inquiry':
            d.line((4,6,7,6),fill=INK)
            if name=='zoom-in':d.line((6,4,6,8),fill=INK)
    elif name=='fit':
        poly(d,[(1,7),(7,1),(8,1),(14,7),(12,7),(12,14),(3,14),(3,7)],PEACH)
        box(d,(6,9,9,14),WHITE)
    elif name=='close':
        stroke(d,[(3,3),(12,12)]);stroke(d,[(12,3),(3,12)])
    elif name=='send':
        poly(d,[(1,6),(14,1),(10,14),(7,9),(1,6)],MINT)
        d.line((7,9,12,3),fill=INK);d.line((7,9,7,13),fill=INK)
    elif name=='stop':box(d,(3,3,12,12),PEACH,1)
    elif name in ['takeover','handback']:hand(d,name=='handback')
    elif name=='fork':
        stroke(d,[(4,13),(4,3)],MINT);stroke(d,[(4,9),(11,6),(11,3)],MINT)
        for x,y in [(4,3),(11,3),(4,13)]:d.ellipse((x-2,y-2,x+2,y+2),fill=WHITE,outline=INK)
    elif name=='inject':
        poly(d,[(2,2),(13,2),(14,3),(14,10),(12,12),(7,12),(4,15),(4,12),(1,12),(1,3)],WHITE)
        d.line((5,7,10,7),fill=INK);d.line((8,4,8,10),fill=INK)
    elif name=='assignment':
        box(d,(2,3,12,14),YELLOW,1);box(d,(5,1,9,4),LAV)
        poly(d,[(11,5),(14,5),(13,7),(12,8),(12,10),(8,14),(6,12),(10,8),(10,6)],MINT)
    elif name=='party':
        person(d,1,5,LAV);person(d,9,5,PEACH);person(d,5,1,MINT)
    elif name=='recap':
        box(d,(3,1,13,14),WHITE,1);d.line((5,2,5,13),fill=LAV)
        for y in [3,7,11]:d.line((1,y,3,y),fill=LAV)
        stroke(d,[(7,8),(9,10),(12,6)],GREEN)
    elif name=='host':
        poly(d,[(1,4),(5,7),(8,2),(11,7),(14,4),(12,13),(3,13)],YELLOW)
        d.line((4,11,11,11),fill=PEACH);dot(d,7,7,MINT)
    elif name=='desk':
        box(d,(1,7,14,10),PEACH);box(d,(2,10,3,14),LAV);box(d,(12,10,13,14),LAV)
        box(d,(4,1,11,6),INK);d.rectangle((5,2,10,4),fill=MINT);d.line((7,6,7,7),fill=INK)
    elif name=='back':
        poly(d,[(1,7),(7,1),(7,5),(14,5),(14,10),(7,10),(7,14),(1,8)],WHITE)
    elif name=='away':
        # Z-shaped sleep symbols are status pictograms, not image labels.
        for x,y,s in [(1,9,3),(5,5,4),(10,1,4)]:
            stroke(d,[(x,y),(x+s,y),(x,y+s),(x+s,y+s)],LAV)
    else:raise ValueError(name)
    return im

names=['office','agents','approvals','approvals-pending','directory','settings','zoom-in','zoom-out','fit','close','send','stop','takeover','handback','fork','inject','inquiry','assignment','party','recap','host','desk','back','notifications-on','online','away']
for name in names:
    if name=='online':
        im,d=canvas(8,8);d.ellipse((0,0,7,7),fill=INK);d.ellipse((1,1,6,6),fill=GREEN);d.point((2,2),fill=MINT)
    else:im=make(name)
    icons[name]=im
    im.save(OUT/f'{name}.png');im.resize((im.width*2,im.height*2),NN).save(OUT/f'{name}@2x.png')

# Exact nine-slice panel: 4px corner inset, one-pixel outline, stretchable empty centre.
bubble,d=canvas(24,24);d.rounded_rectangle((0,0,23,23),radius=4,fill=WHITE,outline=INK,width=1);bubble.save(OUT/'bubble.png')
tail,d=canvas(8,6);poly(d,[(0,0),(7,0),(2,5)],WHITE);d.line((1,0,6,0),fill=WHITE);tail.save(OUT/'bubble-tail.png')
for name,w,h,width in [('ring',32,16,1),('ring-selected',36,18,2)]:
    im,d=canvas(w,h);d.ellipse((1,2,w-2,h-3),outline=WHITE,width=width);im.save(OUT/f'{name}.png')

strip,_=canvas(96,16)
for i,inset in enumerate([1,3,5]):
    frame,d=canvas(32,16)
    p=[(16,2),(30-inset,7),(30-inset,9),(16,14),(1+inset,9),(1+inset,7),(16,2)]
    d.line(p,fill=GREEN,width=1)
    d.line((13,8,18,8),fill=GREEN);d.line((16,6,16,10),fill=GREEN)
    strip.alpha_composite(frame,(i*32,0))
strip.save(OUT/'target.png')
typing,_=canvas(48,8)
for frame in range(3):
    f,d=canvas(16,8)
    for i,x in enumerate([2,7,12]):
        y=2 if i==frame else 4
        d.rectangle((x,y,x+1,y+1),fill=INK)
    typing.alpha_composite(f,(frame*16,0))
typing.save(OUT/'typing.png')

# Logo is generated with the image tool, then snapped and palette-matched at native size.
logo_source=DESIGN/'logo-source.png'
if logo_source.exists():
    source=Image.open(logo_source).convert('RGBA')
    source.putalpha(source.getchannel('A').point(lambda a:255 if a>=160 else 0))
    source=source.crop(source.getchannel('A').getbbox())
    ratio=min(30/source.width,30/source.height)
    source=source.resize((round(source.width*ratio),round(source.height*ratio)),NN)
    pal=Image.new('P',(1,1));pal.putpalette([v for c in PALETTE for v in c]+list(PALETTE[0])*(256-len(PALETTE)))
    limited=source.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');limited.putalpha(source.getchannel('A'))
    logo,_=canvas(32,32);logo.alpha_composite(limited,((32-limited.width)//2,(32-limited.height)//2))
    logo.save(OUT/'logo.png');logo.save(OUT/'favicon.png');logo.resize((64,64),NN).save(OUT/'logo@2x.png')

# Preserve every pre-existing manifest entry; add/change entries for this batch only.
manifest_path=ROOT/'dashboard/public/office/manifest.json'
manifest=json.loads(manifest_path.read_text());manifest.setdefault('ui',{})
expected={}
for name in names:
    size=(8,8) if name=='online' else (16,16)
    expected[name]=size;expected[name+'@2x']=(size[0]*2,size[1]*2)
expected.update({'bubble':(24,24),'bubble-tail':(8,6),'ring':(32,16),'ring-selected':(36,18),'target':(96,16),'typing':(48,8)})
if logo_source.exists():expected.update({'logo':(32,32),'logo@2x':(64,64),'favicon':(32,32)})
validation=[]
for name,size in expected.items():
    path=OUT/f'{name}.png';im=Image.open(path).convert('RGBA')
    assert im.size==size,(name,im.size,size)
    assert set(im.getchannel('A').getdata())=={0,255},name
    assert all(p[:3] in PALETTE for p in im.getdata() if p[3]),name
    manifest['ui'][name]=f'office/ui/{name}.png'
    validation.append({'name':name,'size':list(size),'palette':'PASS','binary_alpha':'PASS','sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
for name in names+(['logo'] if logo_source.exists() else []):
    a=Image.open(OUT/f'{name}.png').convert('RGBA');b=Image.open(OUT/f'{name}@2x.png').convert('RGBA')
    assert a.resize(b.size,NN).tobytes()==b.tobytes(),name
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
(DESIGN/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')

# QA board at 4x with both requested surface colors. Labels exist only in this design artifact.
board=Image.new('RGB',(832,576),WHITE)
bd=ImageDraw.Draw(board)
for i,name in enumerate(names):
    col,row=i%7,i//7;x,y=col*118,row*136
    bd.rectangle((x+2,y+6,x+55,y+76),fill='#FDF8F2')
    bd.rectangle((x+57,y+6,x+111,y+76),fill=DARK)
    art=icons[name].resize((icons[name].width*3,icons[name].height*3),NN)
    for bx in [x+5,x+60]:board.paste(art,(bx,y+15),art)
    bd.text((x+2,y+85),name,fill=INK)
board.save(DESIGN/'icons-review.png')
print(f'Validated {len(expected)} PNGs: exact sizes, palette C, binary transparency, exact nearest-neighbour @2x.')
