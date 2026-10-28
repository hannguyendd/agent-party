"""Reproduce the fantasy Office batch. Requires Pillow, writes assets/design/manifest only.
New 48x72 and 32x48 rasters are sampled directly from high-resolution source poses;
portraits are never resized from the 48x72 runtime frame. No antialiasing/dithering.
"""
from pathlib import Path
from collections import deque
import hashlib
import json
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[4]
DESIGN=Path(__file__).resolve().parent
PUBLIC=ROOT/'dashboard/public/office'
SHEETS=PUBLIC/'characters48';PORTRAITS=PUBLIC/'characters'
IDS=['mage','knight','ranger','healer','rogue','berserker','slime','dragon']
LABELS={'mage':'Coffee Mage','knight':'Keyboard Knight','ranger':'Paper Ranger','healer':'Band-Aid Healer','rogue':'Donut Rogue','berserker':'Debug Viking','slime':'Crowned Slime','dragon':'Cardigan Dragon'}
BEFORE=json.loads((DESIGN/'before.json').read_text())
PALETTE=[tuple(bytes.fromhex(s[1:])) for s in (ROOT/'design/office-style/C/palette.txt').read_text().splitlines()]
NN=Image.Resampling.NEAREST
pal=Image.new('P',(1,1));pal.putpalette([v for c in PALETTE for v in c]+list(PALETTE[0])*(256-len(PALETTE)))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
canonical_sha=lambda data:hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def native(sprite,size,ratio=None):
    """Rasterize directly at the requested native pixel grid; hard binary silhouette."""
    w,h=size
    if ratio is None:ratio=min((w-2)/sprite.width,(h-2)/sprite.height)
    scaled=sprite.resize((max(1,round(sprite.width*ratio)),max(1,round(sprite.height*ratio))),NN)
    color=scaled.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
    color.putalpha(scaled.getchannel('A'))
    result=Image.new('RGBA',size)
    result.alpha_composite(color,((w-color.width)//2,h-1-color.height))
    return result

def main_component(im):
    """Remove detached unrequested motion doodles; held props stay attached to body."""
    a=im.getchannel('A');points={(x,y) for y in range(im.height) for x in range(im.width) if a.getpixel((x,y))}
    components=[]
    while points:
        start=points.pop();q=deque([start]);part=[start]
        while q:
            x,y=q.popleft()
            for dx,dy in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:
                p=(x+dx,y+dy)
                if p in points:points.remove(p);q.append(p);part.append(p)
        components.append(part)
    if not components:return im
    largest=max(components,key=len)
    # Keep any substantial disconnected body component too (e.g. a boot).
    mask=Image.new('L',im.size)
    for part in components:
        if len(part)>=len(largest)*0.12:
            for p in part:mask.putpixel(p,255)
    im.putalpha(mask)
    return im

report=[];all_frames={};source_info={}
for id in IDS:
    path=DESIGN/f'{id}-source.png'
    if id=='slime':path=DESIGN/'slime-corrected-source.png'
    source=Image.open(path).convert('RGBA')
    source.putalpha(source.getchannel('A').point(lambda a:255 if a>=176 else 0))
    a=source.getchannel('A');runs=[];start=None
    for y in range(source.height):
        occupied=a.crop((0,y,source.width,y+1)).getbbox() is not None
        if occupied and start is None:start=y
        if not occupied and start is not None:
            if y-start>source.height/25:runs.append((start,y))
            start=None
    if start is not None:runs.append((start,source.height))
    assert len(runs)==5,(id,'expected five body bands',runs)
    # Split in empty gaps, retaining the hat, floating heart and smoke in their own cells.
    boundaries=[0]+[(runs[i][1]+runs[i+1][0])//2 for i in range(4)]+[source.height]
    raw=[]
    for row in range(5):
        for col in range(4):
            cell=source.crop((round(col*source.width/4),boundaries[row],round((col+1)*source.width/4),boundaries[row+1]))
            if id in ['knight','ranger','rogue','berserker']:cell=main_component(cell)
            box=cell.getchannel('A').getbbox();assert box,(id,row,col)
            raw.append(cell.crop(box))
    ratio=min(44/max(f.width for f in raw),68/max(f.height for f in raw))
    assert ratio<1
    frames=[native(f,(48,72),ratio) for f in raw]
    sheet=Image.new('RGBA',(192,360))
    for i,frame in enumerate(frames):sheet.alpha_composite(frame,((i%4)*48,(i//4)*72))
    sheet.save(SHEETS/f'{id}.png')
    # Native portrait is rasterized independently at 32x48 from the high-res front stand.
    portrait=native(raw[1],(32,48))
    portrait.save(PORTRAITS/f'{id}-portrait.png')
    all_frames[id]=frames
    source_info[id]={'row_bands':runs,'row_boundaries':boundaries,'scale':ratio}
    checks=[]
    for name,size in [(f'characters48/{id}.png',(192,360)),(f'characters/{id}-portrait.png',(32,48))]:
        saved=Image.open(PUBLIC/name)
        assert saved.mode=='RGBA' and saved.size==size,(name,saved.size)
        assert set(saved.getchannel('A').getdata())=={0,255}
        assert all(p[:3] in PALETTE for p in saved.getdata() if p[3]),name
        assert all(p[:3]!=(0,0,0) for p in saved.getdata() if p[3])
        checks.append({'path':f'dashboard/public/office/{name}','size':list(size),'sha256':sha(PUBLIC/name),'palette':'PASS','alpha':'binary 0/255'})
    bounds=[]
    for i,f in enumerate(frames):
        box=f.getchannel('A').getbbox()
        assert box and box[0]>=1 and box[2]<=47 and box[1]>=1 and box[3]==71,(id,i,box)
        assert not f.getchannel('A').crop((0,71,48,72)).getbbox()
        bounds.append(list(box))
    hashes=[hashlib.sha256(f.tobytes()).hexdigest() for f in frames]
    walking=[len(set(hashes[r*4:r*4+4])) for r in range(3)]
    assert min(walking)>=3,(id,'duplicate walking cycle',walking)
    assert hashes[0]!=hashes[2] and hashes[4]!=hashes[6] and hashes[8]!=hashes[10]
    assert hashes[16]!=hashes[17],(id,'duplicate typing')
    # Typing poses must differ below the face, not merely blink.
    assert frames[16].crop((0,40,48,71)).tobytes()!=frames[17].crop((0,40,48,71)).tobytes(),(id,'typing hands/base do not differ')
    report.append({'id':id,'label':LABELS[id],'files':checks,'frame_size':[48,72],'frame_count':20,
                   'native_portrait':'32x48 rasterized directly from high-resolution front pose, no blur or 48px up/downscale',
                   'one_scale_all_poses':ratio,'frame_bounds':bounds,'contact_y':70,'last_row_71':'transparent',
                   'unique_walk_frames':walking,'typing_frames_distinct':True,'typing_lower_body_distinct':True,
                   'frame_hashes':hashes})

# Slime stride silhouettes must actually squash wider/shorter than the stand pose.
slime_squash=[]
for row in range(3):
    dims=[]
    for f in all_frames['slime'][row*4:row*4+4]:
        b=f.getchannel('A').getbbox();dims.append((b[2]-b[0],b[3]-b[1]))
    for stride in [0,2]:
        assert dims[stride][0]>dims[1][0] and dims[stride][1]<dims[1][1],('slime squash',row,dims)
    slime_squash.append({'row':row,'dimensions':dims,'wider_shorter_strides':True})

# Add new IDs without rewriting any existing entry/value or section.
manifest_path=PUBLIC/'manifest.json';manifest=json.loads(manifest_path.read_text())
manifest.setdefault('characters48',{}).update({id:f'office/characters48/{id}.png' for id in IDS})
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
rest=json.loads(json.dumps(manifest))
for id in IDS:rest['characters48'].pop(id,None)
assert rest==BEFORE['manifest'],'An existing manifest entry changed'
preservation=[]
for rel,old_hash in BEFORE['files'].items():
    current=sha(ROOT/rel)
    preservation.append({'path':rel,'before':old_hash,'after':current,'unchanged':old_hash==current})
assert all(r['unchanged'] for r in preservation),'An existing asset changed'

# Pose board: six required views for each new character, exact 2x.
review=Image.new('RGB',(720,1264),'#FDF8F2');rd=ImageDraw.Draw(review)
for row,id in enumerate(IDS):
    rd.text((4,row*158+5),id,fill='#48506C')
    for col,index in enumerate([1,5,9,12,15,16]):
        frame=all_frames[id][index].resize((96,144),NN);x=140+col*96;y=row*158+12
        rd.rectangle((x,y,x+95,y+143),fill='#2C283C' if col%2 else '#FDF8F2');review.paste(frame,(x,y),frame)
review.save(DESIGN/'poses-review.png')
old_ids=list(BEFORE['manifest']['characters48'])
assert len(old_ids)==8
cast=Image.new('RGB',(1536,336),'#FDF8F2');d=ImageDraw.Draw(cast)
for row,bg in enumerate(['#FDF8F2','#2C283C']):
    d.rectangle((0,row*168,1535,(row+1)*168-1),fill=bg)
    for col,id in enumerate(old_ids+IDS):
        if id in all_frames:frame=all_frames[id][1]
        else:frame=Image.open(PUBLIC/'characters48'/f'{id}.png').convert('RGBA').crop((48,0,96,72))
        d.text((col*96+4,row*168+5),id,fill='#48506C' if row==0 else '#FEFDFB')
        frame=frame.resize((96,144),NN);cast.paste(frame,(col*96,row*168+24),frame)
cast.save(DESIGN/'cast-review.png')
# Full twenty-frame review sheets are also retained for QA.
full=Image.new('RGB',(1536,1488),'#FDF8F2');fd=ImageDraw.Draw(full)
for n,id in enumerate(IDS):
    x=(n%4)*384;y=(n//4)*744;fd.text((x+6,y+5),id,fill='#48506C')
    for row in range(5):
        for col in range(4):
            fd.rectangle((x+col*96,y+24+row*144,x+(col+1)*96-1,y+24+(row+1)*144-1),fill='#2C283C' if (row+col)%2 else '#FDF8F2')
            art=all_frames[id][row*4+col].resize((96,144),NN);full.paste(art,(x+col*96,y+24+row*144),art)
full.save(DESIGN/'sheets-review.png')
validation={'status':'PASS','new_ids':IDS,'sheets':8,'portraits':8,'total_frames':160,'palette':'design/office-style/C/palette.txt',
            'existing_assets_unchanged':True,'existing_asset_count':len(preservation),'existing_files':preservation,
            'original_eight_sheets_unchanged':True,'original_eight_portraits_unchanged':True,
            'rest_of_manifest_unchanged':True,'manifest_rest_hash_before':canonical_sha(BEFORE['manifest']),
            'manifest_rest_hash_after':canonical_sha(rest),'slime_squash':slime_squash,'sources':source_info,'characters':report}
(DESIGN/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print('PASS: eight 192x360 sheets, eight native 32x48 portraits, 160 frames, fixed y=70 contact, palette, binary alpha, distinct walks/typing.')
print(f'PASS: all {len(preservation)} pre-existing assets hash-identical; all existing manifest entries unchanged.')
