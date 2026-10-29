import {writeFile,readFile} from 'node:fs/promises';
import {characters} from './characters/recipes';
const counts=JSON.parse(await readFile('previews/tri-counts.json','utf8'));
for(const [id,create] of Object.entries(characters)){const m=create();await m.save('characters');counts[id]=m.d.getRoot().listNodes().reduce((sum,n)=>sum+(n.getMesh()?.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0)??0),0);console.log(id,counts[id]);}
await writeFile('previews/tri-counts.json',JSON.stringify(counts,null,2)+'\n');
