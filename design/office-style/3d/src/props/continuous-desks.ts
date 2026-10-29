import * as T from 'three';
import {Model} from '../primitives';
import {bounds} from '../g2/scale';
import {readFile,writeFile} from 'node:fs/promises';
export async function continuousDesks(layout:any,meta:any,models:Map<string,any>){
 const groups=[{id:'left',axis:'z',x0:9,x1:15,z0:7,z1:24,split:12,rows:[['D1','D3','D5','D7'],['D2','D4','D6','D8']],cuts:[7,11.5,15.5,19.5,24],n:8}, {id:'bottom',axis:'x',x0:16,x1:36,z0:26,z1:30,split:28,rows:[['D9','D10','D11','D12'],['D13','D14','D15','D16']],cuts:[16,21,26,31,36],n:9}, {id:'middle',axis:'z',x0:24,x1:31,z0:12,z1:16,split:27.5,rows:[['M1'],['M2']],cuts:[12,16],n:2}];
 const ids:string[]=[],legs=new Set<string>();
 for(const g of groups){const lateral=g.axis==='x',start=lateral?g.x0:g.z0,end=lateral?g.x1:g.z1,grid=Array.from({length:g.n+1},(_,i)=>start+(end-start)*i/g.n);(g as any).moduleWidth=(end-start)/g.n;
 // Remove old padding plants/cabinets inside the real desktop bank, rather than burying them.
 layout.objects=layout.objects.filter(o=>o.station||o.walkable||o.mount||o.y>0||o.x<g.x0||o.x>g.x1||o.z<g.z0||o.z>g.z1);
 for(let row=0;row<2;row++)for(let i=0;i<g.rows[row].length;i++){const station=g.rows[row][i],desk=layout.objects.find(o=>o.role==='station-desk'&&o.station===station),lo=g.cuts[i],hi=g.cuts[i+1],r=lateral?{x0:lo,x1:hi,z0:row?g.split:g.z0,z1:row?g.z1:g.split}:{z0:lo,z1:hi,x0:row?g.split:g.x0,x1:row?g.x1:g.split},cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2,id='desk-row-'+station.toLowerCase(),m=new Model(id);
 const box=(w:number,h:number,d:number,c:string,x:number,y:number,z:number,name:string)=>m.mesh(new T.BoxGeometry(w,h,d),c,[x-cx,y,z-cz],m.root,name);
 // Continuous peach surface. Internal seams describe the ~2.2-tile real modules;
 // station ownership boundaries do not create an extra seam or double legs.
 box(r.x1-r.x0,.14,r.z1-r.z0,'desktop',cx,1.19,cz,'desktop');
 for(const t of grid.slice(1,-1))if(t>lo+1e-5&&t<hi-1e-5)box(lateral?.006:r.x1-r.x0,.002,lateral?r.z1-r.z0:.006,'grain',lateral?t:cx,1.259,lateral?cz:t,'module-seam');
 for(const t of grid)if(t>=lo-1e-5&&t<=hi+1e-5)for(const depth of [lateral?r.z0:r.x0,lateral?r.z1:r.x1]){let x=lateral?t:depth,z=lateral?depth:t;const key=x.toFixed(6)+','+z.toFixed(6);if(legs.has(key))continue;legs.add(key);x=Math.max(g.x0+.065,Math.min(g.x1-.065,x));z=Math.max(g.z0+.065,Math.min(g.z1-.065,z));box(.1,1.12,.1,'aluminium',x,.56,z,'shared-corner-leg');}
 // Every model has floor origin, even when this partition owns no shared-edge legs.
 const bb=bounds(m.d),ox=(bb.min[0]+bb.max[0])/2,oz=(bb.min[2]+bb.max[2])/2;for(const n of m.root.listChildren()){const t=n.getTranslation();n.setTranslation([t[0]-ox,t[1],t[2]-oz]);}
 Object.assign(desk,{model:id,x:cx+ox,z:cz+oz,rot:0,bank:g.id});delete desk.scale;
 meta[id]={folder:'props',...bounds(m.d)};models.set(id,m);ids.push(id);
 }
 // One shared plant per inter-seat gap per facing row, never a new printer.
 for(const row of g.rows)for(let i=0;i<row.length-1;i++){const a=layout.objects.find(o=>o.seatId===row[i]),b=layout.objects.find(o=>o.seatId===row[i+1]),desk=layout.objects.find(o=>o.station===row[i]&&o.role==='station-desk'),distance=2.1,angle=a.rot*Math.PI/180;layout.objects.push({model:'desk-cactus',x:(a.x+b.x)/2+Math.sin(angle)*distance,z:(a.z+b.z)/2+Math.cos(angle)*distance,rot:0,y:1.26,walkable:false,role:'shared-desk-item',bank:g.id,sharedGap:[row[i],row[i+1]],support:desk.id,scale:[.7,1,.7]});}
 }
 layout.deskBanks=groups;layout.revision='g3';layout.notes.partG3='Continuous desk banks; real ~2.0–2.25 tile module seams, unique shared corner legs. HR/MGR unchanged.';
 const allowed=JSON.parse(await readFile('reports/uncovered-allowed.json','utf8'));for(const c of allowed)c.tiles=c.tiles.filter(([x,z])=>!groups.some(g=>x>=g.x0&&x<g.x1&&z>=g.z0&&z<g.z1));await writeFile('reports/uncovered-allowed.json',JSON.stringify(allowed.filter(c=>c.tiles.length),null,2)+'\n');
 await writeFile('reports/part-g3-desks.json',JSON.stringify({groups,models:ids,uniqueLegs:legs.size},null,2)+'\n');return ids;
}
