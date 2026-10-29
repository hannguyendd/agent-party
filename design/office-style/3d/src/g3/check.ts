import {footprint} from '../layout';
export function checkBanks(layout:any,meta:any){
 const check=(v:any,m:string)=>{if(!v)throw Error('G3 '+m);},surface=(o:any)=>footprint(meta[o.model].top||meta[o.model],o),stats=[];
 check(layout.deskBanks?.length===3,'three continuous banks missing');
 for(const g of layout.deskBanks){const legKeys=new Set();for(const o of layout.objects.filter(o=>o.bank===g.id&&o.role==='station-desk'))for(const p of meta[o.model].legCenters||[]){const key=(o.x+p[0]).toFixed(3)+','+(o.z+p[2]).toFixed(3);check(!legKeys.has(key),'doubled shared corner legs '+g.id+' '+key);legKeys.add(key);}
 const lateral=g.axis==='x',rows=g.rows.map((ids:string[])=>ids.map(id=>layout.objects.find(o=>o.station===id&&o.role==='station-desk'))),surfaces=rows.flat().map(surface);let maximumGap=0,maximumEmpty=0;
 for(const row of rows){const rs=row.map(surface).sort((a,b)=>lateral?a.x0-b.x0:a.z0-b.z0);for(let i=1;i<rs.length;i++){const gap=lateral?rs[i].x0-rs[i-1].x1:rs[i].z0-rs[i-1].z1;check(Math.abs(gap)<=.05,'adjacent desks in row do not touch '+g.id+' gap '+gap);maximumGap=Math.max(maximumGap,Math.abs(gap));}
 const ids=new Set(row.map(o=>o.station)),items=layout.objects.filter(o=>o.y===1.26&&(ids.has(o.station)||o.bank===g.id&&o.sharedGap?.every(id=>ids.has(id))));const intervals=items.map(o=>{const r=footprint(meta[o.model],o);return lateral?[r.x0,r.x1]:[r.z0,r.z1];}).sort((a,b)=>a[0]-b[0]);let end=lateral?g.x0:g.z0;for(const [a,b]of intervals){maximumEmpty=Math.max(maximumEmpty,a-end);end=Math.max(end,b);}maximumEmpty=Math.max(maximumEmpty,(lateral?g.x1:g.z1)-end);check(maximumEmpty<=1.5001,'empty desktop run >1.5 '+g.id+' '+maximumEmpty);
 }
 // Whole tile area, not just tile centres: exact rectangle/union coverage.
 for(let z=g.z0;z<g.z1;z++)for(let x=g.x0;x<g.x1;x++){let area=0;for(const r of surfaces)area+=Math.max(0,Math.min(x+1,r.x1)-Math.max(x,r.x0))*Math.max(0,Math.min(z+1,r.z1)-Math.max(z,r.z0));check(Math.abs(area-1)<.0001,'blocked bank tile without a desktop '+g.id+' '+x+','+z+' area '+area);}
 for(const row of g.rows)for(let i=0;i<row.length-1;i++)check(layout.objects.filter(o=>o.sharedGap?.join('/')===[row[i],row[i+1]].join('/')).length<=1,'multiple shared items per gap');
 stats.push({bank:g.id,tiles:(g.x1-g.x0)*(g.z1-g.z0),moduleWidth:g.moduleWidth,maxAdjacentGap:maximumGap,maxEmptyDesktopRun:maximumEmpty});
 }return stats;
}
