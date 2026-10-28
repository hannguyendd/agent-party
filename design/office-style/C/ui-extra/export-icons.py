"""Twelve additional native pixel UI icons. Only assets, design QA and manifest entries."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'dashboard/public/office/ui'
DESIGN=Path(__file__).resolve().parent
INK='#48506C';WHITE='#FEFDFB';MINT='#9DD6B7';PEACH='#F4B592';LAV='#CCB2CB';GREEN='#70A65B';DARK='#2C283C'
palette={tuple(bytes.fromhex(s[1:])) for s in (ROOT/'design/office-style/C/palette.txt').read_text().splitlines()}
NN=Image.Resampling.NEAREST

def box(d,b,fill=WHITE,r=0):
 if r:d.rounded_rectangle(b,radius=r,fill=fill,outline=INK,width=1)
 else:d.rectangle(b,fill=fill,outline=INK,width=1)
def poly(d,p,fill=WHITE):d.polygon(p,fill=fill,outline=INK,width=1)
def stroke(d,p,fill=WHITE):d.line(p,fill=INK,width=3);d.line(p,fill=fill,width=1)
def bubble(d):poly(d,[(2,1),(13,1),(14,2),(14,10),(12,12),(7,12),(4,15),(4,12),(1,12),(1,2)],WHITE)

names=['attach','image','file','pantry','mention','question','search','keyboard','new-chat','people','clock','check']
arts={}
for name in names:
 im=Image.new('RGBA',(16,16));d=ImageDraw.Draw(im)
 if name=='attach':
  stroke(d,[(5,11),(10,6),(10,4),(8,3),(6,4),(2,8),(2,11),(4,14),(7,14),(13,8),(13,4),(11,1),(8,1),(6,2)],MINT)
 elif name=='image':
  box(d,(1,2,14,13),WHITE,1);d.rectangle((2,3,13,12),fill='#E6FAF5')
  d.rectangle((10,4,11,5),fill=PEACH)
  poly(d,[(2,11),(6,6),(9,10),(11,8),(13,11),(13,12),(2,12)],MINT)
 elif name=='file':
  poly(d,[(3,1),(9,1),(13,5),(13,14),(3,14)],WHITE)
  poly(d,[(9,1),(9,5),(13,5)],LAV)
  d.line((5,8,10,8),fill='#8D92A6');d.line((5,10,10,10),fill='#8D92A6');d.line((5,12,8,12),fill='#8D92A6')
 elif name=='pantry':
  box(d,(10,5,14,10),PEACH,1);box(d,(11,6,13,9),WHITE)
  poly(d,[(2,4),(11,4),(10,11),(8,13),(5,13),(3,11)],WHITE)
  d.line((3,5,10,5),fill=PEACH);stroke(d,[(1,14),(12,14)],LAV)
  d.line((5,0,4,2),fill='#658C8C');d.line((8,0,7,2),fill='#658C8C')
 elif name=='mention':
  # One @ status glyph, pixel-authored at native size.
  stroke(d,[(12,11),(14,10),(14,5),(12,2),(8,1),(4,2),(2,5),(1,9),(3,13),(6,14),(11,14)],WHITE)
  stroke(d,[(10,5),(10,10),(12,11)],MINT)
  stroke(d,[(9,4),(6,4),(4,6),(4,9),(6,11),(9,10)],MINT)
 elif name=='question':
  bubble(d)
  d.line([(6,4),(7,3),(9,3),(10,4),(10,5),(8,7),(8,8)],fill=INK,width=1)
  d.point((8,10),fill=INK)
 elif name=='search':
  box(d,(1,1,10,13),WHITE,1)
  for y in [3,5,7,9]:d.line((3,y,7,y),fill=LAV)
  d.ellipse((6,6,12,12),fill=INK);d.ellipse((7,7,11,11),fill='#E6FAF5')
  poly(d,[(11,10),(14,13),(13,14),(10,11)],MINT)
 elif name=='keyboard':
  box(d,(0,4,15,13),LAV,2);d.rectangle((2,6,13,11),fill=WHITE)
  for y in [6,8]:
   for x in [2,5,8,11]:d.line((x,y,x+1,y),fill=INK)
  d.line((4,10,11,10),fill=INK)
 elif name=='new-chat':
  bubble(d);d.line((5,6,11,6),fill=INK);d.line((8,3,8,9),fill=INK)
 elif name=='people':
  d.ellipse((1,3,6,8),fill=PEACH,outline=INK);box(d,(0,9,7,14),LAV,2)
  d.ellipse((7,5,11,9),fill=WHITE,outline=INK);box(d,(6,10,13,14),MINT,2)
  d.ellipse((10,0,15,5),fill=INK);d.ellipse((11,1,14,4),fill=GREEN)
 elif name=='clock':
  d.ellipse((1,1,14,14),fill=INK);d.ellipse((2,2,13,13),fill=WHITE)
  d.line((8,4,8,8),fill=INK);d.line((8,8,11,10),fill=INK)
  for p in [(8,2),(13,8),(8,13),(2,8)]:d.point(p,fill=PEACH)
 elif name=='check':
  poly(d,[(1,8),(3,6),(6,9),(12,2),(14,4),(6,13),(1,8)],MINT)
 else:raise ValueError(name)
 arts[name]=im
 im.save(OUT/f'{name}.png');im.resize((32,32),NN).save(OUT/f'{name}@2x.png')
manifest_path=ROOT/'dashboard/public/office/manifest.json'
manifest=json.loads(manifest_path.read_text());manifest.setdefault('ui',{})
validation=[]
for name in names:
 for suffix,size in [('',(16,16)),('@2x',(32,32))]:
  key=name+suffix;p=OUT/f'{key}.png';im=Image.open(p).convert('RGBA')
  assert im.size==size and set(im.getchannel('A').getdata())=={0,255}
  assert all(p[:3] in palette for p in im.getdata() if p[3]),key
  if suffix:assert arts[name].resize((32,32),NN).tobytes()==im.tobytes()
  manifest['ui'][key]=f'office/ui/{key}.png'
  validation.append({'file':p.name,'size':list(size),'palette':'PASS','binary_alpha':'PASS'})
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
(DESIGN/'icons-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
board=Image.new('RGB',(624,396),WHITE);bd=ImageDraw.Draw(board)
for i,name in enumerate(names):
 x=(i%4)*156;y=(i//4)*132
 bd.rectangle((x+3,y+4,x+74,y+78),fill='#FDF8F2');bd.rectangle((x+77,y+4,x+150,y+78),fill=DARK)
 art=arts[name].resize((64,64),NN)
 board.paste(art,(x+7,y+9),art);board.paste(art,(x+82,y+9),art)
 bd.text((x+6,y+90),name,fill=INK)
board.save(DESIGN/'icons-review.png')
print('PASS: 24 icon PNGs; native 16x16 / exact 32x32 nearest-neighbour; palette C; binary alpha; manifest.')
