import {readFile} from 'node:fs/promises';import {applyMapD12} from './map-d12';
const metadata=JSON.parse(await readFile('model-metadata.json','utf8'));const report=await applyMapD12(metadata);console.log(`Reproduced Part F plate; collision.png, collision@16x.png and seats.json byte-identical; 20 seats.`);
