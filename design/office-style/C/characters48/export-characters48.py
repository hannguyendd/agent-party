"""Native 48x72 frames from newly generated, high-resolution 20-pose sources.
No 32x48 source is enlarged. All outputs share the exact approved C palette.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageDraw, ImageOps
ROOT=Path(__file__).resolve().parents[4]
DESIGN=Path(__file__).resolve().parent
OUT=ROOT/'dashboard/public/office/characters48'
OUT.mkdir(parents=True,exist_ok=True)
NN=Image.Resampling.NEAREST
SKINS=['dev-hoodie','designer','lead','shiba','cat','penguin','alien','robot']
colors=[tuple(bytes.fromhex(s[1:])) for s in (ROOT/'design/office-style/C/palette.txt').read_text().splitlines()]
pal=Image.new('P',(1,1));pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
report=[];sheets={}
old_hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'dashboard/public/office/characters').glob('*.png')}
for skin in SKINS:
 source=Image.open(DESIGN/f'{skin}-source.png').convert('RGBA')
 source.putalpha(source.getchannel('A').point(lambda a:255 if a>=160 else 0))
 alpha=source.getchannel('A');bands=[];start=None
 for y in range(source.height):
  has=alpha.crop((0,y,source.width,y+1)).getbbox() is not None
  if has and start is None:start=y
  if not has and start is not None:
   if y-start>12:bands.append((start,y))
   start=None
 if start is not None:bands.append((start,source.height))
 assert len(bands)==5,(skin,bands)
 frames=[]
 for row,(top,bottom) in enumerate(bands):
  for col in range(4):
   x0=round(col*source.width/4);x1=round((col+1)*source.width/4)
   sprite=source.crop((x0,top,x1,bottom))
   bbox=sprite.getchannel('A').getbbox();assert bbox,(skin,row,col)
   sprite=sprite.crop(bbox)
   # The generated alien's third left-walk pose faces right; normalize it to LEFT.
   if skin=='alien' and row==1 and col==2:sprite=ImageOps.mirror(sprite)
   frames.append(sprite)
 # Shared scale for all poses in a skin avoids per-frame stretching and head pumping.
 ratio=min(44/max(f.width for f in frames),68/max(f.height for f in frames))
 assert ratio<1,(skin,'must be sampled DOWN from original art')
 sheet=Image.new('RGBA',(192,360));native=[]
 for index,sprite in enumerate(frames):
  sprite=sprite.resize((max(1,round(sprite.width*ratio)),max(1,round(sprite.height*ratio))),NN)
  color=sprite.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
  color.putalpha(sprite.getchannel('A'))
  frame=Image.new('RGBA',(48,72));frame.alpha_composite(color,((48-color.width)//2,71-color.height))
  sheet.alpha_composite(frame,((index%4)*48,(index//4)*72));native.append(frame)
 sheet.save(OUT/f'{skin}.png');sheets[skin]=sheet
 # Inspect saved PNG, not just in-memory objects.
 saved=Image.open(OUT/f'{skin}.png').convert('RGBA')
 assert saved.size==(192,360) and set(saved.getchannel('A').getdata())=={0,255}
 assert all(p[:3] in colors for p in saved.getdata() if p[3])
 for i,frame in enumerate(native):
  box=frame.getchannel('A').getbbox()
  assert box and box[0]>=1 and box[2]<=47 and box[1]>=1 and box[3]==71,(skin,i,box)
 unique=[len({hashlib.sha256(native[r*4+c].tobytes()).hexdigest() for c in range(4)}) for r in range(5)]
 assert all(u>=3 for u in unique[:3]),(skin,'walking poses are not sufficiently distinct',unique)
 assert native[16].tobytes()!=native[17].tobytes(),(skin,'typing frames must differ')
 report.append({'skin':skin,'size':[192,360],'frame':[48,72],'frames':20,'source_size':list(source.size),
                'sampling':'downsampled from new image-generated art, never enlarged from old character sheets',
                'unique_poses_per_row':unique,'palette':'PASS','binary_alpha':'PASS','frame_bounds':'PASS',
                'sha256':hashlib.sha256((OUT/f'{skin}.png').read_bytes()).hexdigest()})
manifest_path=ROOT/'dashboard/public/office/manifest.json';manifest=json.loads(manifest_path.read_text())
manifest.setdefault('characters48',{}).update({skin:f'office/characters48/{skin}.png' for skin in SKINS})
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
assert old_hashes=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'dashboard/public/office/characters').glob('*.png')}
(DESIGN/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
# Full frame-review board at exact 2x, with alternating light/dark tiles for alpha QA.
board=Image.new('RGB',(4*384,2*744),'#FDF8F2');bd=ImageDraw.Draw(board)
for i,skin in enumerate(SKINS):
 bx=(i%4)*384;by=(i//4)*744
 for row in range(5):
  for col in range(4):
   bd.rectangle((bx+col*96,by+24+row*144,bx+(col+1)*96-1,by+24+(row+1)*144-1),fill='#FDF8F2' if (row+col)%2==0 else '#2C283C')
 scaled=sheets[skin].resize((384,720),NN);board.paste(scaled,(bx,by+24),scaled);bd.text((bx+8,by+6),skin,fill='#48506C')
board.save(DESIGN/'sheets-review.png')
# Compact contact sheet of front, side, back, seated, waving and typing poses.
review=Image.new('RGB',(720,8*158),'#FDF8F2');rd=ImageDraw.Draw(review)
for row,skin in enumerate(SKINS):
 rd.text((4,row*158+5),skin,fill='#48506C')
 for col,index in enumerate([1,5,9,12,15,16]):
  frame=sheets[skin].crop(((index%4)*48,(index//4)*72,(index%4+1)*48,(index//4+1)*72)).resize((96,144),NN)
  x=140+col*96;y=row*158+12
  rd.rectangle((x,y,x+95,y+143),fill='#2C283C' if col%2 else '#FDF8F2')
  review.paste(frame,(x,y),frame)
review.save(DESIGN/'poses-review.png')
print('PASS: 8 native 192x360 sheets, 20 aligned 48x72 frames each; palette C; binary alpha; distinct walk/typing poses; existing characters unchanged.')
for r in report:print(r['skin'],r['unique_poses_per_row'])
