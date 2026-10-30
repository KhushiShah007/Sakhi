import { applyDemoDeploy } from './demoDeploy.js';

// Imported first by index.ts so the environment is settled before anything reads it.
for (const l of applyDemoDeploy(process.env)) console.log(l);
