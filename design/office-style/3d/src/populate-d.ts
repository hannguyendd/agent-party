import {curateE} from './curate-e';
import {readFile,writeFile} from 'node:fs/promises';import {source,footprint,tiles} from './layout';import {deskDItems,mountIds} from './props/part-d';
export const inward={north:[0,1],south:[0,-1],west:[1,0],east:[-1,0]};export const mountRotation={north:0,south:180,west:90,east:270};
export function wallFace(w:any,metadata:any){const r=footprint(metadata[w.model],w),n=inward[w.facing];if(w.faceOffset!==undefined)return {x:w.x+n[0]*w.faceOffset,z:w.z+n[1]*w.faceOffset};return {x:n[0]>0?r.x1:n[0]<0?r.x0:w.x,z:n[1]>0?r.z1:n[1]<0?r.z0:w.z};}
export async function populateD(layout:any,meta:any){const {blocked,seats}=await source();const objects=layout.objects,walls=layout.walls;const stats:any={newFurniture:[],deskItems:{},wallDecor:0,before:JSON.parse(await readFile('reports/uncovered-before-d.json','utf8')).length};
const rect=(o:any)=>footprint(meta[o.model],o),overlap=(a:any,b:any,gap=.015)=>a.x0<b.x1-gap&&a.x1>b.x0+gap&&a.z0<b.z1-gap&&a.z1>b.z0+gap;
const valid=(o:any)=>tiles(rect(o)).every(([x,z])=>blocked(x,z));
const ground=()=>objects.filter(o=>!o.walkable&&!o.mount&&!(o.y>0)).map(rect);
function add(model:string,x:number,z:number,rot=0,extra:any={}){const o={model,x,z,rot,walkable:false,...extra};if(!o.walkable&&o.mount!=='wall'&&!valid(o))throw Error('D raised object crosses walkable tile: '+JSON.stringify(o));objects.push(o);return o;}
function placeIf(model:string,x:number,z:number,rot=0){const o={model,x,z,rot};if(!valid(o)||ground().some(r=>overlap(r,rect(o))))return false;add(model,x,z,rot,{density:'d2'});stats.newFurniture.push({model,x,z,rot});return true;}
// Match the plate's broad desk banks and pantry counter runs before using small storage.
for(const z of [7.5,15.5,19.5,23.5])placeIf('desk-apron',12,z);
for(const x of [21,26,31])placeIf('desk-wing',x,28);for(const x of [16.5,35.5])placeIf('desk-return',x,28);
placeIf('counter-wide',53,9.5,90);placeIf('counter-compact',53,11.9,90);placeIf('counter-wide',42,21.5,90);placeIf('counter-wide',42,24.5,90);
// A centre extension joins the paired managers' desks without touching either aisle.
placeIf('desk-wing',27.5,14,90);
for(const [station,side] of [['M1',-1],['M2',1]])for(const o of objects.filter(o=>o.station===station&&['monitor-dual','monitor-arm'].includes(o.model))){o.x=27.5+side*(o.model==='monitor-arm'?.09:.25);o.z=14.5;if(!valid(o))throw Error('Middle monitor placement');}
// Part E: collision padding is curated as empty; no automatic per-tile furniture filling.
// Remove the earlier ad-hoc clutter. Hardware and the typing zone remain fixed.
const replace=new Set(['desk-plant','mug','water-bottle','photo-frame','figurine','monitor-riser','desk-shelf']);for(let i=objects.length-1;i>=0;i--)if(objects[i].station&&objects[i].y===.74&&replace.has(objects[i].model))objects.splice(i,1);
const sidePositions=[[-.88,-.33],[.88,-.33],[-.88,.02],[.88,.02],[-.88,.37],[.88,.37]];
stats.deskItems.HR=['mug','desk-plant','document-tray'];for(const [index,seat] of seats.filter(s=>s.id!=='HR').entries()){const desk=objects.find(o=>o.model==='desk'&&o.station===seat.id),chair=objects.find(o=>o.model==='office-chair'&&o.seatId===seat.id);const a=chair.rot*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a),hash=[...seat.id].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381),count=4+hash%3;const items=[];for(let j=0;j<count;j++){const [right,forward]=sidePositions[j],model=deskDItems[(index*2+j*3+hash)%deskDItems.length];add(model,desk.x+dx*forward+dz*right,desk.z+dz*forward-dx*right,desk.rot,{y:.74,station:seat.id,role:'desk-item'});items.push(model);}stats.deskItems[seat.id]=items;const monitor=objects.find(o=>o.model==='monitor-dual'&&o.station===seat.id),r=monitor.rot*Math.PI/180;add('sticky-notes',monitor.x+Math.sin(r)*.055+Math.cos(r)*.52,monitor.z+Math.cos(r)*.055-Math.sin(r)*.52,monitor.rot,{y:.94,station:seat.id,role:'monitor-note'});}
// Pantry accessories sit on existing counter tops, separate from their sink / coffee machine.
const counters=objects.filter(o=>o.model==='counter');const kitchen=['microwave','kettle','toaster','fruit-bowl','cup-rack','paper-towels'];for(let i=0;i<kitchen.length;i++){const base=counters[Math.floor(i/2)%counters.length],right=i===0?-.67:i%2?.61:-.61;add(kitchen[i],base.x+right,base.z-.05,base.rot,{y:.98,role:'pantry-item'});}
// Flat, restrained floor accents. No new obstacles in the main aisles.
add('rug-meeting',27.5,14.5,0,{walkable:true});add('rug-mint',49.5,31.1,0,{walkable:true});add('rug-meeting',45.5,19.5,0,{walkable:true});for(const z of [11.5,15.5,19.5])add('cable-cover',16.4,z,90,{walkable:true});for(const z of [7,8])add('floor-sticker',19.5,z,0,{walkable:true});
for(let i=0;i<10;i++)add(i===0?'sun-patch-edge':'sun-patch',3, (5.5+i*3)-.65+(i===0?.55:0),90,{y:.012,walkable:true,decal:'sunlight',panel:i});
// Wall-mounted details use the structural wall's facing and an exact room-side face plane.
function mount(model:string,w:any,tangent:number,y:number){const face=wallFace(w,meta),n=inward[w.facing];const x=n[0]===0?tangent:face.x,z=n[0]===0?face.z:tangent;add(model,x,z,mountRotation[w.facing],{mount:'wall',facing:w.facing,y,wallId:w.id});stats.wallDecor++;}
const findWall=(facing:string,t:number,room?:string)=>walls.find(w=>w.facing===facing&&w.exception!=='door'&&(!room||w.room===room)&&(()=>{const r=rect(w);return inward[facing][0]===0?t>=r.x0-1e-5&&t<=r.x1+1e-5:t>=r.z0-1e-5&&t<=r.z1+1e-5;})());
const cycle=['framed-poster','wall-shelf','calendar','corkboard','wall-clock','picture-frame'];
for(let i=0,t=3.5;t<54;t+=3,i++){if((t>18&&t<21)||t===6.5||t===21.5)continue;const wall=findWall('north',t);if(!wall)continue;const model=t===30.5||t===45.5?'air-conditioner':cycle[i%cycle.length];mount(model,wall,t,model==='air-conditioner'?2.7:1.95);}
mount('picture-frame',findWall('north',7.5),7.5,1.95);mount('company-sign',findWall('north',17.5),17.5,2.45);mount('company-sign',findWall('north',21.5),21.5,2.45);
for(const facing of ['east','south'])for(let i=0,t=3.5;t<(facing==='east'?34:54);t+=3,i++){if(facing==='east'&&t<4.5)continue;const wall=findWall(facing,t);if(wall){const model=facing==='east'&&t===18.5?'wall-whiteboard':facing==='east'&&t===24.5?'wall-tv':cycle[(i+2)%cycle.length];mount(model,wall,t,model==='wall-tv'?1.9:1.95);}}
for(let i=0,z=5.5;i<10;i++,z+=3)mount('hanging-planter',findWall('west',z),z,2.1);

for(let i=0,x=42.5;x<54;x+=3,i++)mount(cycle[(i+3)%cycle.length],findWall('north',x,'manager'),x,1.85);
for(let i=0,z=19.5;z<34;z+=3,i++)mount(cycle[(i+4)%cycle.length],findWall('west',z,'manager'),z,1.85);
await curateE(layout,meta);await writeFile('reports/d-density.json',JSON.stringify(stats,null,2)+'\n');return stats;}
