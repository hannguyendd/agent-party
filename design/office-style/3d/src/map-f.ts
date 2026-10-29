import {PNG} from 'pngjs';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const dest='../../../dashboard/public/office/map/',before='src/map-before-f/';
const load=async(p:string)=>PNG.sync.read(await readFile(p));
const sha=(b:any)=>createHash('sha256').update(b).digest('hex');
export async function applyMapF(){
const old=await load(before+'background.png'),oldFg=await load(before+'foreground.png');const bg=PNG.sync.read(PNG.sync.write(old)),fg=PNG.sync.read(PNG.sync.write(oldFg));
const palette=new Set<string>();for(let i=0;i<old.data.length;i+=4)palette.add([...old.data.subarray(i,i+3)].join(','));
const put=(x:number,y:number,rgb:number[],front=false)=>{if(x<1312||x>=1728||y<894||y>=1096)throw Error('Part F plate write outside lower manager room');if(!palette.has(rgb.join(',')))throw Error('New 2D palette color '+rgb);const i=(y*1792+x)*4;bg.data.set([...rgb,255],i);fg.data.set(front?[...rgb,255]:[0,0,0,0],i);};
// Use the upper room floor, not the cooler hall floor under the removed partition.
for(let y=894;y<1096;y++)for(let x=1312;x<1728;x++){const sx=1392+x%80,sy=832+y%48,j=(sy*1792+sx)*4;put(x,y,[...old.data.subarray(j,j+3)]);}
// Keep the existing palm sprite. Its mint backdrop is not part of the plant.
for(let y=986;y<1086;y++)for(let x=1644;x<1722;x++){const j=(y*1792+x)*4,rgb=[...old.data.subarray(j,j+3)];if(['157,214,183','253,224,194','248,224,208','101,140,140'].includes(rgb.join(',')))continue;const lx=x-1644,ly=y-986;if(lx<8||lx>72||ly<12||ly>98)continue;put(x,y,rgb,oldFg.data[j+3]===255);}
const C={outline:[72,80,108],shadow:[140,112,128],peach:[253,205,170],light:[253,224,194],edge:[245,204,178],rose:[202,159,166],mint:[157,214,183],mintShade:[101,140,140],lavender:[204,178,203],lavShade:[141,146,166],white:[254,253,251]};
const rect=(x:number,y:number,w:number,h:number,c:number[],front=false)=>{for(let b=y;b<y+h;b+=2)for(let a=x;a<x+w;a+=2)for(let j=0;j<2;j++)for(let i=0;i<2;i++)put(a+i,b+j,c,front);};
const raised=(x:number,y:number,w:number,h:number,c:number[],front=false)=>{if(x<1536||x+w>1632||y<928||y+h>1056)throw Error('Meeting furniture exceeds existing blocked rectangle');rect(x,y,w,h,c,front);};
// Lavender rug leaves a full floor margin before the palm, so no pot clips its corner.
rect(1540,932,88,120,C.lavShade);rect(1542,934,84,116,C.lavender);rect(1540,934,88,116,C.lavender);
function rounded(x:number,y:number,w:number,h:number,color:number[],radius=4,front=false){for(let b=0;b<h;b+=2)for(let a=0;a<w;a+=2){const cx=a<radius?radius:a>=w-radius?w-radius-2:a,cy=b<radius?radius:b>=h-radius?h-radius-2:b;if((a-cx)**2+(b-cy)**2>radius**2)continue;raised(x+a,y+b,2,2,color,front);}}
function chair(x:number,y:number,lav:boolean,flip:boolean){const color=lav?C.lavender:C.mint,shade=lav?C.lavShade:C.mintShade;
rounded(x+2,y+4,20,26,C.shadow,4);rounded(x+2,y,18,20,C.outline,4);rounded(x+4,y+2,14,16,color,4);raised(x+6,y+2,8,2,C.light);raised(x+(flip?16:4),y+6,2,10,shade);
rounded(x,y+16,22,12,C.outline,4);rounded(x+2,y+16,18,8,color,4);raised(x+4,y+24,14,2,shade);raised(x+2,y+28,4,4,C.outline,true);raised(x+16,y+28,4,4,C.outline,true);}
chair(1538,958,false,false);chair(1610,958,true,true);chair(1538,1000,true,false);chair(1610,1000,false,true);
// Native 2-pixel lattice: a new compact meeting table, no copied lounge sprites.
raised(1560,952,48,86,C.shadow);rounded(1562,948,44,82,C.outline,8);rounded(1564,950,40,76,C.peach,8);raised(1570,952,28,2,C.light);raised(1566,962,2,54,C.edge);raised(1598,966,2,48,C.light);raised(1564,1022,40,4,C.edge);raised(1564,1028,40,6,C.rose,true);raised(1564,1034,4,8,C.outline,true);raised(1600,1034,4,8,C.outline,true);
raised(1572,964,16,12,C.outline);raised(1574,964,12,10,C.white);raised(1574,968,12,2,C.lavShade);raised(1592,1000,8,10,C.outline);raised(1594,1000,4,8,C.white);
let changed=0;for(let i=0;i<bg.data.length;i+=4){const x=i/4%1792,y=Math.floor(i/4/1792),different=[0,1,2,3].some(c=>bg.data[i+c]!==old.data[i+c]||fg.data[i+c]!==oldFg.data[i+c]);if(different){changed++;if(x<1312||x>=1728||y<894||y>=1096)throw Error('Unrelated plate pixel changed');}}
await writeFile(dest+'background.png',PNG.sync.write(bg));await writeFile(dest+'foreground.png',PNG.sync.write(fg));
const frozen={};for(const n of ['collision.png','collision@16x.png','seats.json']){const expected=await readFile(before+n),actual=await readFile(dest+n);if(!expected.equals(actual))throw Error('Part F changed frozen '+n);frozen[n]=sha(actual);}
const x0=1248,y0=416,w=512,h=704,review=new PNG({width:w*3,height:h+32});review.data.fill(245);for(let i=3;i<review.data.length;i+=4)review.data[i]=255;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=((y0+y)*1792+x0+x)*4;for(let pane=0;pane<3;pane++){const i=((y+32)*review.width+pane*w+x)*4;review.data.set((pane===0?old:bg).data.subarray(j,j+4),i);if(pane===2&&[0,1,2,3].some(c=>old.data[j+c]!==bg.data[j+c]))review.data.set([215,87,125,255],i);}}
for(const n of ['manager-room-before-after-f.png','map-before-after-diff.png'])await writeFile('previews/'+n,PNG.sync.write(review));
const report={revision:'f',changedPixels:changed,raisedMeetingTiles:'x=48..50, y=29..32',paletteColors:palette.size,frozen,unrelatedPixels:'unchanged',collisionOverlay:'Frozen by owner instruction; intentionally not recomposited against the edited plate.'};await writeFile('reports/part-f-map.json',JSON.stringify(report,null,2)+'\n');const d=JSON.parse(await readFile('reports/map-d12.json','utf8'));return {...d,...report};
}
