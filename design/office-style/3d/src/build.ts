import {mkdir,writeFile} from 'node:fs/promises';
import {out,palette,colors,keys} from './primitives';
import {characters} from './characters/recipes';
import {stage} from './config';
import * as T from 'three';
import {applyMapD12} from './map-d12';
import {buildLayout} from './layout';
import {characterIds} from './config';
import {recipe,propIds,kitIds} from './props/recipes';
await mkdir(out,{recursive:true});for(const dir of ['characters','props','kit'])await mkdir(out+dir,{recursive:true});
await writeFile(out+'palette.png',palette());await writeFile(out+'palette-office.png',palette(0));
await writeFile('palette.json',JSON.stringify({default:"pastel",size:256,cellSize:32,variants:['office','pastel'],colors:Object.fromEntries(keys.map((k,i)=>[k,{cell:[i%8,Math.floor(i/8)],uv:[(i%8+.5)/8,(Math.floor(i/8)+.5)/8],office:colors[k][0],pastel:colors[k][1]}]))},null,2)+'\n');
const counts={};const metadata={};for(const id of characterIds){const model=characters[id]();await model.save('characters');counts[id]=model.d.getRoot().listNodes().reduce((sum,n)=>sum+(n.getMesh()?.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0)??0),0);}for(const [folder,ids] of [['props',propIds],['kit',kitIds]] as const)for(const id of ids){const m=recipe(id);await m.save(folder);counts[id]=m.count;const box=new T.Box3();for(const n of m.d.getRoot().listNodes())if(n.getMesh()){const matrix=new T.Matrix4().fromArray(n.getWorldMatrix());for(const p of n.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)box.expandByPoint(new T.Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix));}}metadata[id]={folder,min:box.min.toArray(),max:box.max.toArray()};}
await writeFile('model-metadata.json',JSON.stringify(metadata,null,2)+'\n');if(['c','d'].includes(stage)){if(stage==='d')await applyMapD12(metadata);const layout=await buildLayout(metadata);await writeFile(out+'layout3d.json',JSON.stringify(layout,null,2)+'\n');}
await writeFile('previews/tri-counts.json',JSON.stringify(counts,null,2)+'\n');
await writeFile('manifest-models3d.json',JSON.stringify({models3d:{...(['c','d'].includes(stage)?{layout:'office/3d/layout3d.json'}:{}),palette:'office/3d/palette.png',characters:Object.fromEntries(characterIds.map(id=>[id,`office/3d/characters/${id}.glb`])),props:Object.fromEntries(propIds.map(id=>[id,`office/3d/props/${id}.glb`])),kit:Object.fromEntries(kitIds.map(id=>[id,`office/3d/kit/${id}.glb`]))}},null,2)+'\n');console.log('Built all registered self-contained GLBs; pastel is default.');
