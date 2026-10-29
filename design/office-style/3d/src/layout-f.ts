import {readFile,writeFile} from 'node:fs/promises';
import {source,footprint,tiles,faceRotation} from './layout';
export async function curateF(layout:any,meta:any){
const {seats,blocked}=await source(),objects=layout.objects;const valid=(o:any)=>tiles(footprint(meta[o.model],o)).every(([x,z])=>blocked(x,z));
const add=(model:string,x:number,z:number,rot=0,extra:any={})=>{const o={model,x,z,rot,walkable:false,...extra};if(!o.walkable&&!valid(o))throw Error('F raised footprint crosses walkable floor: '+JSON.stringify(o));objects.push(o);return o;};
// Rebuild stations from the seat axes, not from the drawn depths of the plate.
for(let i=objects.length-1;i>=0;i--){const o=objects[i];if(o.station||o.seatId||o.model==='cable-tray'&&!o.station||['desk-long','desk-wing','desk-return','desk-apron','reception-desk'].includes(o.model)||['bench-item','bench-hardware','shared-item'].includes(o.role)||o.model==='printer'||o.model==='armchair'||o.area==='manager-extension'&&o.model!=='floor-palm'||o.model==='rug-mint'&&o.z>30)objects.splice(i,1);}
// Bring the two existing visitor chairs with the now shallower manager desk.
const visitors=objects.filter(o=>o.model==='guest-chair');for(const [i,o] of visitors.entries()){const candidate={...o,x:i?50.5:51.5,z:i?24.65:23.95,rot:i?135:180};if(!valid(candidate))throw Error('Manager visitor-chair adjustment');Object.assign(o,candidate);}
const specs=[];
for(const [index,seat] of seats.entries()){
const r=faceRotation[seat.face],a=r*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a),sx=seat.seat.x+.5,sz=seat.seat.y+.5;
const local=(d:number,right=0)=>[Number((sx+dx*d+dz*right).toFixed(5)),Number((sz+dz*d-dx*right).toFixed(5))];
add(index%2?'office-chair-lavender':'office-chair',sx,sz,r,{seatId:seat.id,station:seat.id,walkable:true,exception:'seat-chair'});
const compact=seat.id==='MGR',hr=seat.id==='HR',deskId='desk-'+seat.id;
const deskPos=local(hr?1:1.25,hr?-.5:0),model=hr?'reception-desk':compact?'workstation-desk-compact':'workstation-desk';
add(model,...deskPos,(r+180)%360,{station:seat.id,role:'station-desk',id:deskId,desktopY:.74,compact:compact||hr});
const item=(model:string,d:number,right:number,y=.74,role='station-hardware')=>{const [x,z]=local(d,right);return add(model,x,z,(r+180)%360,{station:seat.id,y,role,support:deskId});};
item(compact||hr?'monitor-compact':'monitor-dual',1.2,0,.74,'station-monitor');
if(!compact&&!hr)item('monitor-arm',1.36,0);
item(compact?'keyboard-compact':'keyboard',.77,0);
item('mouse-compact',.77,compact||hr?.32:.47);
item('pc-tower',hr?1:1.25,compact?.24:hr?-.62:.64,0,'station-tower');
if(!compact&&!hr)item('cable-tray',hr?1:1.55,hr?-.4:0,.56,'station-underdesk');
const choices=compact?[['mug',1.67,-.22],['desk-cactus',1.67,.25]]:hr?[['mug',.75,-.72],['desk-cactus',1.25,-.75],['document-tray',1,-1.08]]:[['mug',.74,-.69],['notebook',1.7,-.66],['desk-cactus',1.7,.67],['pen-cup',.72,.7]];
for(const [id,d,right] of choices)item(id,d,right,.74,'desk-item');
specs.push({id:seat.id,desk:model,monitor:compact||hr?'monitor-compact':'monitor-dual',monitorDistance:1.2,nearEdge:hr?.55:.55,width:hr?1.8:compact?.92:1.8,depth:hr?.9:1.4,exception:compact?'MGR front approach is only one blocked tile wide; compact desk and single display.':hr?'HR right-end entry gap forces a left-biased reception desk; display stays on the seat axis.':undefined});
}
// Cabinet/planter spines occupy the deep plate padding; no extra empty desktop.
for(const z of [9.5,13.5,17.5,21.5]){add('spine-left',12,z);for(const x of [11,12,13])add(x===12?'book-stack':'desk-cactus',x,z,0,{y:.7,role:'spine-item'});}
add('spine-middle',27.5,14.5);for(const x of [26,27,28,29])add(x%2?'desk-cactus':'document-tray',x,14.5,0,{y:.7,role:'spine-item'});
for(const x of [18.5,23.5,28.5,33.5]){add('spine-bench',x,28);for(const offset of [-1.7,-.85,0,.85,1.7])add(offset===0?'book-stack':'desk-cactus',x+offset,28,0,{y:.7,role:'spine-item'});}
// Compact four-person meeting corner, wholly within the existing 3 × 4 blocked rectangle.
add('meeting-table',49.5,31,0,{area:'manager-meeting',role:'meeting-table',id:'meeting-table',desktopY:.74});
for(const [i,z] of [30.3,31.7].entries()){add(i?'meeting-chair-lavender':'meeting-chair-mint',48.4,z,90,{area:'manager-meeting'});add(i?'meeting-chair-mint':'meeting-chair-lavender',50.6,z,270,{area:'manager-meeting'});}
for(const [model,x,z] of [['notebook',49.5,30.45],['mug',49.7,31],['water-bottle',49.3,31.6]])add(model,x,z,0,{y:.74,role:'meeting-item',support:'meeting-table',area:'manager-meeting'});
add('rug-meeting-corner',49.5,31,0,{walkable:true,area:'manager-meeting'});
layout.revision='f';layout.notes.workstations='Monitors at 1.2 tiles on each seat axis. Deep blocked padding is a low shared spine.';
await writeFile('reports/part-f-stations.json',JSON.stringify(specs,null,2)+'\n');
// Explicit connected padding clusters; the collision map is not furniture geometry.
const covered=new Set<string>();for(const o of [...objects,...layout.walls])if(!o.mount&&!o.walkable&&!(o.y>0)||o.exception==='door')for(const t of tiles(footprint(meta[o.model],o)))if(blocked(t[0],t[1]))covered.add(t.join(','));
const missing=new Set<string>();for(let z=4;z<34;z++)for(let x=2;x<54;x++)if(blocked(x,z)&&!covered.has(x+','+z))missing.add(x+','+z);const clusters=[];
while(missing.size){const key=missing.values().next().value;missing.delete(key);const group=[key.split(',').map(Number)];for(let i=0;i<group.length;i++){const [x,z]=group[i];for(const t of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]])if(missing.delete(t.join(',')))group.push(t);}const x=group.reduce((s,t)=>s+t[0],0)/group.length,z=group.reduce((s,t)=>s+t[1],0)/group.length;clusters.push({id:'f-padding-'+(clusters.length+1),tiles:group,reason:x>=40?'Plate floor/shadow padding around the manager/pantry furniture; the meeting corner stays in its existing blocked rectangle.':z>=24?'Original deep desk-bank padding around the compact workstations and shared cabinet spine.':'Original plate desk/cabinet shadow padding; 3D desk depth follows realistic sitter reach rather than the drawn sprite depth.'});}
await writeFile('reports/uncovered-allowed.json',JSON.stringify(clusters,null,2)+'\n');return layout;
}
