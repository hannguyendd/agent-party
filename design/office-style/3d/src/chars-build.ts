import {NodeIO} from '@gltf-transform/core';import {ids,makePalette,character,output,finishPalette} from './characters/sprite-shape';import {cropCharacterTextures} from './chars-crop-texture';
const palette=await makePalette(),docs=[];for(const id of ids)docs.push(await character(id,palette));await finishPalette(palette,docs);for(let i=0;i<ids.length;i++){const d=docs[i];await new NodeIO().write(output+ids[i]+'.glb',d);console.log(ids[i],d.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3,0),0));}
// Each GLB keeps only its own band of palette-characters.png (see chars-crop-texture.ts).
await cropCharacterTextures();
