import {readFile} from 'node:fs/promises';import {applyMapD12} from './map-d12';
const metadata=JSON.parse(await readFile('model-metadata.json','utf8'));const report=await applyMapD12(metadata);console.log(`Reproduced D12 + HR map: ${report.changedTiles.length} collision edits; 20 seats; native palette + binary-alpha foreground.`);
