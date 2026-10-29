import {curateF} from './layout-f';
import {populateD} from './populate-d';
import {d12Furniture} from './d12-plan';
import {PNG} from 'pngjs';import {readFile,writeFile} from 'node:fs/promises';
export const faceRotation={down:0,right:90,up:180,left:270};
export function footprint(meta:any,o:any){const a=o.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a);const points=[[meta.min[0],meta.min[2]],[meta.min[0],meta.max[2]],[meta.max[0],meta.min[2]],[meta.max[0],meta.max[2]]].map(([x,z])=>[o.x+c*x*(o.scale?.[0]??1)+s*z*(o.scale?.[2]??1),o.z-s*x*(o.scale?.[0]??1)+c*z*(o.scale?.[2]??1)]);return {x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),z0:Math.min(...points.map(p=>p[1])),z1:Math.max(...points.map(p=>p[1]))};}
export function tiles(rect:any){const a=[];for(let z=Math.floor(rect.z0+1e-5);z<=Math.floor(rect.z1-1e-5);z++)for(let x=Math.floor(rect.x0+1e-5);x<=Math.floor(rect.x1-1e-5);x++)a.push([x,z]);return a;}
export async function source(){const map=PNG.sync.read(await readFile('../../../dashboard/public/office/map/collision.png'));const seats=JSON.parse(await readFile('../../../dashboard/public/office/map/seats.json','utf8'));const blocked=(x:number,z:number)=>x>=0&&x<map.width&&z>=0&&z<map.height&&[0,1,2].every(c=>map.data[(z*map.width+x)*4+c]===0);return {map,seats,blocked};}
export async function buildLayout(meta:any){const {blocked,seats}=await source();const objects:any[]=[],walls:any[]=[],occupied:any[]=[],adjustments:any[]=[];
const fits=(model:string,x:number,z:number,rot=0)=>tiles(footprint(meta[model],{x,z,rot})).every(([tx,tz])=>blocked(tx,tz));
const overlap=(a:any,b:any)=>a.x0<b.x1-.03&&a.x1>b.x0+.03&&a.z0<b.z1-.03&&a.z1>b.z0+.03;
function put(model:string,x:number,z:number,rot=0,extra:any={}){if(!extra.walkable&&!fits(model,x,z,rot))throw Error(`Unsafe ${model} at ${x},${z}`);const o={model,x,z,rot,walkable:false,...extra};objects.push(o);if(!extra.walkable&&!extra.y)occupied.push(footprint(meta[model],o));return o;}
function fit(model:string,x:number,z:number,rot=0,region=[2,4,54,34],extra:any={}){const candidates=[];for(let pz=region[1]+.5;pz<region[3];pz+=.5)for(let px=region[0]+.5;px<region[2];px+=.5)candidates.push([px,pz]);candidates.sort((a,b)=>Math.hypot(a[0]-x,a[1]-z)-Math.hypot(b[0]-x,b[1]-z));for(const [px,pz] of candidates){const fp=footprint(meta[model],{x:px,z:pz,rot});if(fits(model,px,pz,rot)&&!occupied.some(r=>overlap(r,fp))){if(Math.hypot(px-x,pz-z)>.5)adjustments.push({model,desired:[x,z],actual:[px,pz]});return put(model,px,pz,rot,extra);}}throw Error(`No collision-safe placement for ${model} in ${region}`);}
for(const seat of seats.filter(s=>s.id!=='HR')){const rot=faceRotation[seat.face],a=rot*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a),x=seat.seat.x+.5,z=seat.seat.y+.5;const chair=put('office-chair',x,z,rot,{walkable:true,seatId:seat.id,exception:'seat-chair'});let distance=1.05;while(distance<7&&!fits('desk',x+dx*distance,z+dz*distance,(rot+180)%360))distance+=.05;if(distance>=7)throw Error('No desk in front of '+seat.id);const desk=put('desk',Number((x+dx*distance).toFixed(3)),Number((z+dz*distance).toFixed(3)),(rot+180)%360,{station:seat.id});if(distance>1.1)adjustments.push({seat:seat.id,deskDistance:Number(distance.toFixed(2)),reason:'nearest forward desk position wholly on blocked tiles'});chair.station=seat.id;
const local=(model:string,forward:number,right:number,y:number)=>put(model,desk.x+dx*forward+dz*right,desk.z+dz*forward-dx*right,desk.rot,{y,station:seat.id});
local('monitor-dual',.25,0,.74);local('monitor-arm',.4,0,.74);local('keyboard',-.33,0,.74);local('mouse',-.33,.48,.74);local('desk-plant',.15,-.83,.74);local('mug',-.28,.84,.74);local('pc-tower',.06,.8,0);local('power-strip',.2,-.5,.06);local('cable-tray',.39,0,.56);
const decor=['water-bottle','photo-frame','figurine','monitor-riser','desk-shelf'];const id=seats.indexOf(seat);if(id<5)local(decor[id],0,id%2?.78:-.78,.74);
}
// Join the approved workstation tops into long facing banks without entering an aisle.
const pairs=[['D1','D2'],['D3','D4'],['D5','D6'],['D7','D8'],['D9','D13'],['D10','D14'],['D11','D15'],['D12','D16']];
for(const [left,right] of pairs){const a=objects.find(o=>o.model==='office-chair'&&o.seatId===left),b=objects.find(o=>o.model==='office-chair'&&o.seatId===right);const cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;const dx=Math.sign(b.x-a.x),dz=Math.sign(b.z-a.z);if(dx){put('desk-long',cx-.95,cz,90,{bank:left+'-'+right});put('desk-long',cx+.95,cz,90,{bank:left+'-'+right});}else put('desk-long',cx,cz,0,{bank:left+'-'+right});
for(const [station,side] of [[left,-1],[right,1]])for(const o of objects.filter(o=>o.station===station&&['monitor-dual','monitor-arm'].includes(o.model))){const distance=o.model==='monitor-arm'?.09:.25;o.x=cx+dx*side*distance;o.z=cz+dz*side*distance;if(!fits(o.model,o.x,o.z,o.rot))throw Error('Bank monitor exceeds blocked footprint');}put('cable-tray',cx,cz,dx?90:0,{y:.58});}
// The architectural outline follows the existing perimeter and manager-room blocked runs.
function wall(model:string,x:number,z:number,rot:number,facing:string,extra:any={}){if(!fits(model,x,z,rot))throw Error(`Unsafe wall ${model} ${x},${z}`);walls.push({id:`${facing}-${model}-${x}-${z}`,model,x,z,rot,facing,walkable:false,...extra});}
for(let x=2;x<54;x++){if(![18,19,20].includes(x))wall('wall-straight',x+.5,3.5,0,'north');wall('wall-straight',x+.5,34.5,0,'south');}
for(let z=4;z<34;z++){wall('window-wall',1.5,z+.5,90,'west',{panelGap:(z-4)%3===2,faceOffset:.09});wall('wall-straight',54.5,z+.5,90,'east');}
for(const [x,z] of [[54.5,3.5],[1.5,34.5],[54.5,34.5]])wall('wall-column',x,z,0,z<10?'north':'south');walls.push({id:'entrance-door',model:'door-glass-double',x:19.5,z:4.5,rot:0,facing:'north',walkable:true,exception:'door',opening:'entrance'});wall('wall-half',18.25,3.5,0,'north');wall('wall-half',20.75,3.5,0,'north');
for(let x=40;x<54;x++){wall('glass-wall',x+.5,14.5,0,'north',{room:'manager'});}for(let z=17;z<34;z++)wall('glass-wall',40.5,z+.5,90,'west',{room:'manager'});wall('glass-post',40.5,14.5,0,'west',{room:'manager'});wall('glass-post',40.5,17.15,0,'west',{room:'manager',doorway:true});
walls.push({id:'manager-door',model:'door-glass',x:40.5,z:16,rot:90,facing:'west',room:'manager',walkable:true,exception:'door',opening:'manager'});
// Ground furniture stays in its existing blocked region; no obstacle is invented on open floor.
const reception=put('reception-desk',12.3,5.45,180,{role:'hr-desk',station:'HR'});put('office-chair',13.5,4.5,0,{seatId:'HR',station:'HR',walkable:true,exception:'seat-chair'});put('monitor-single',13.5,5.45,180,{y:.88,role:'hr-monitor',station:'HR'});put('keyboard',13.5,5.2,180,{y:.88,role:'hr-keyboard',station:'HR'});put('mug',11.3,5.42,180,{y:.88,role:'desk-item',station:'HR'});put('desk-plant',12,5.65,180,{y:.88,role:'desk-item',station:'HR'});put('document-tray',12.6,5.6,180,{y:.88,role:'desk-item',station:'HR'});
fit('cabinet',6.5,4.5,0,[2,4,16,6]);const fridge=fit('fridge',40.5,6,0,[39,4,43,8]);
const counters=[];for(const x of [44,46,48])counters.push(fit('counter',x,5,0,[42,4,51,6]));put('sink',counters[0].x,counters[0].z,0,{y:.98});put('coffee-machine',counters[1].x,counters[1].z,0,{y:.98});put('jar',counters[2].x,counters[2].z,0,{y:.98});
fit('round-table',46.5,10.5,0,[43,8,51,14]);fit('bench',46.5,14.5,0,[43,13,53,15]);fit('shelf',34.5,5,0,[30,4,39,6]);
put('sofa',46.5,19.5,0,{area:'manager-lounge'});fit('armchair',47,22.5,90,[44,21,50,25]);fit('coffee-table',50.5,25.5,0,[47,24,54,28]);fit('floor-lamp',53.5,18.5,0,[48,17,54,21]);const shelf=fit('bookshelf',53,26.5,270,[47,24,54,29]);put('printer',shelf.x,shelf.z,270,{y:1.9});
fit('gaming-chair',36.5,30.5,270,[35,29,38,32]);fit('stool',27.5,16.5,0,[24,15,31,17]);fit('plant-large',11.5,9.5,0,[9,7,15,24]);fit('plant-small',27.5,11.5,0,[24,10,31,13]);
put('door-mat',19.5,6,0,{walkable:true});put('rug-lavender',47,10.5,0,{walkable:true});put('rug-mint',49.5,20,0,{walkable:true});put('card-mat',33.5,20.5,0,{walkable:true});put('ludo-mat',21,20.5,0,{walkable:true});
for(const o of d12Furniture)put(o.model,o.x,o.z,o.rot,{area:o.area});
// Retain the corner prototype in the kit library without forcing another obstacle into the room.
wall('wall-corner',1.5,3.5,0,'north');
for(let z=4;z<34;z++)for(let x=2;x<54;x++)put(x>=41&&z>=15?'floor-manager':'floor-tile',x+.5,z+.5,0,{walkable:true});
const layout={version:1,grid:{cols:56,rows:36},palette:'pastel',objects,walls,notes:{seatChairs:'User-approved nonblocking visual exception on exactly the seats.json tiles',managerDoorway:{x:40.5,z:[15,17]},foldingFurniture:'Built but unplaced; see REQUESTS-3D.md'}};
await populateD(layout,meta);await curateF(layout,meta);
await writeFile('reports/layout-adjustments.json',JSON.stringify(adjustments,null,2)+'\n');return layout;}
