import {readFile,writeFile} from 'node:fs/promises';
import {source,footprint,tiles} from './layout';
export async function curateE(layout:any,meta:any){
const {blocked}=await source();const objects=layout.objects;
const valid=(o:any)=>tiles(footprint(meta[o.model],o)).every(([x,z])=>blocked(x,z));
const add=(model:string,x:number,z:number,rot=0,extra:any={})=>{const o={model,x,z,rot,walkable:false,curation:'e',...extra};if(!valid(o))return null;objects.push(o);return o;};
// Padding is not furniture. Retain the actual plate furniture and remove the density pass.
for(let i=objects.length-1;i>=0;i--)if(objects[i].density==='d2'&&!(objects[i].x===53&&objects[i].z<14&&['counter-wide','counter-compact'].includes(objects[i].model))||['desk-apron','desk-wing','desk-return','rug-meeting'].includes(objects[i].model))objects.splice(i,1);
// Keep the central monitor seam supported by a real desk segment.
add('desk-long',27.5,14,90,{scale:[1.8/2.3,1,3.8/1.8],bank:'middle-continuous'});
for(const [x,z] of [[26.5,13.5],[28.5,13.5]])add('document-tray',x,z,0,{y:.74,role:'shared-item'});
// Align lounge furniture with the plate rather than the former filler islands.
for(const [model,x,z,rot] of [['coffee-table',46.5,22.5,0],['armchair',50.5,22.5,180],['floor-lamp',44.5,18.5,0]]){const o=objects.find(o=>o.model===model);if(o&&valid({...o,x,z,rot}))Object.assign(o,{x,z,rot});}
const loungeChair=objects.find(o=>o.model==='armchair');if(loungeChair){const target={...loungeChair,x:51.5,z:22.5,rot:180,scale:[.8,1,.8]};if(!valid(target))throw Error('Plate lounge chair footprint');Object.assign(loungeChair,target);}
for(let i=objects.length-1;i>=0;i--)if(objects[i].model==='bench')objects.splice(i,1);
// Only the plate's pantry accessories plus two modest extras.
const kitchenKeep=new Set(['microwave','kettle','toaster','paper-towels']);for(let i=objects.length-1;i>=0;i--)if(objects[i].role==='pantry-item'&&!kitchenKeep.has(objects[i].model))objects.splice(i,1);
add('water-dispenser',41.5,7.5);
// The right pantry cabinet run and its books/plants are visible on the plate.
for(const [model,z] of [['book-stack',9.25],['desk-plant',10.5],['jar',11.9],['book-stack',12.5]])add(model,53,z,90,{y:.98,role:'plate-counter-item'});
const meetingTable=objects.find(o=>o.model==='round-table');if(meetingTable)add('desk-plant',meetingTable.x,meetingTable.z,0,{y:.745,role:'plate-table-item'});
const loungeTable=objects.find(o=>o.model==='coffee-table');if(loungeTable)add('desk-plant',loungeTable.x,loungeTable.z,0,{y:.485,role:'plate-table-item'});
// The plate has a narrow book cabinet beside the manager partition, not a counter run.
const bookshelf=objects.find(o=>o.model==='bookshelf');if(bookshelf){const candidate={...bookshelf,x:42,z:23.5,rot:90};if(valid(candidate)){Object.assign(bookshelf,candidate);const p=objects.find(o=>o.model==='printer'&&o.y===1.9);if(p){p.x=42;p.z=23.5;p.rot=90;}add('desk-plant',42,22.95,0,{y:1.9,role:'cabinet-item'});add('book-stack',42,24,90,{y:1.9,role:'cabinet-item'});}}
for(const [x,z] of [[52.5,17.5],[44.5,19.5]])add('floor-palm',x,z);
// Only the two visitor seats drawn opposite the manager desk.
for(const [x,z] of [[48.5,26.5],[51.5,27.5]])add('guest-chair',x,z,180,{plate:'manager visitor chair'});
// Four small seats around the pantry meeting table, wherever its original blocked footprint permits.
for(const [x,z,rot] of [[44.5,9.5,90],[47.5,9.5,270],[44.5,11.5,90],[47.5,11.5,270]])add('stool',x,z,rot,{plate:'pantry table stool'});
// One continuous bench: existing pod desks plus supported desk-long bridge segments.
for(const [x,w] of [[16.5,.8],[21,2.72],[26,2.72],[31,2.72],[35.5,.8]]){
const segment=add('desk-long',x,28,0,{scale:[w/2.3,1,3.8/1.8],bank:'bottom-continuous'});if(!segment)throw Error('Bottom bench bridge outside original blocked bank '+x);
add('cable-tray',x,28,0,{y:.56,role:'bench-hardware'});
for(const z of [26.65,27.5,28.35,29.2])add(z===27.5&&x===26?'printer':z<28?'document-tray':'desk-plant',x,z,0,{y:.74,role:'bench-item'});
}
// A centre seam is supported by the original pod desks; no orange side apron is needed.
// Keep the actual manager whiteboard, one corkboard, and one television as the only wall extra.
const managerMounts=objects.filter(o=>o.mount==='wall'&&(o.x>=40&&o.z>=14));const keep=new Set(['wall-whiteboard','wall-tv']);let cork=false;for(const o of managerMounts){if(o.model==='corkboard'&&!cork){cork=true;continue;}if(!keep.has(o.model))objects.splice(objects.indexOf(o),1);}
const covered=new Set<string>();for(const o of [...objects,...layout.walls])if(!o.mount&&!o.walkable&&!(o.y>0)||o.exception==='door')for(const t of tiles(footprint(meta[o.model],o)))if(blocked(...t))covered.add(t.join(','));
const missing=new Set<string>();for(let z=4;z<34;z++)for(let x=2;x<54;x++)if(blocked(x,z)&&!covered.has(x+','+z))missing.add(x+','+z);
const clusters=[];while(missing.size){const first=missing.values().next().value;missing.delete(first);const group=[first.split(',').map(Number)];for(let i=0;i<group.length;i++){const [x,z]=group[i];for(const [a,b] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){const key=a+','+b;if(missing.delete(key))group.push([a,b]);}}const cx=group.reduce((s,t)=>s+t[0],0)/group.length,cz=group.reduce((s,t)=>s+t[1],0)/group.length;const reason=cx>=40?(cz<14?'Pantry furniture padding and floor/shadow gaps drawn between counter, fridge and table.':'Manager-room floor/shadow padding around the sofa, visitor chairs, desk and narrow book cabinet.'):cz<6?'Floor/shadow padding around the reception or pantry cabinets drawn on the plate.':cz>24?'Floor/shadow padding around the continuous bottom bench and adjacent plant.':cx<16?'Floor/shadow padding around the paired left-bank desks; the plate draws no side cabinets.':cz<7?'Floor/shadow padding around the reception and pantry furniture shown on the plate.':'Floor/shadow padding around the central workstations and plants; no storage boxes on the plate.';const nearest=objects.filter(o=>!o.walkable&&!o.mount&&!(o.y>0)).sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz))[0];clusters.push({id:'e-padding-'+(clusters.length+1),tiles:group,reason:reason+' Nearest real piece: '+nearest.model+' at ('+nearest.x+', '+nearest.z+').'});}
await writeFile('reports/uncovered-allowed.json',JSON.stringify(clusters,null,2)+'\n');
const before=JSON.parse(await readFile('reports/part-e-before-layout.json','utf8'));const ids=['filing-cabinet','bean-bag','recycle-bin','shoe-rack','coat-rack','storage-cube','archive-boxes','water-dispenser','printer-stand','floor-palm','guest-chair','counter-wide','counter-compact','desk-apron','desk-wing','desk-return'];const counts=Object.fromEntries(ids.map(id=>[id,{before:before.objects.filter(o=>o.model===id).length,after:objects.filter(o=>o.model===id).length}]));await writeFile('reports/part-e-curation.json',JSON.stringify({counts,allowedEmptyTiles:clusters.reduce((s,c)=>s+c.tiles.length,0),allowedClusters:clusters.length,bottomBenchSegments:objects.filter(o=>o.bank==='bottom-continuous').length},null,2)+'\n');
}
