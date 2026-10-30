import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { projectRoot,writeJson } from '../src/io.js';

const git=promisify(execFile);
const url='https://github.com/quarkusio/quarkus-super-heroes.git';
const revision='e195d0a36d6d863213bbfe527db64cb51b3637f5';
const target=path.join(projectRoot,'examples/quarkus-super-heroes');
let exists=true;try{await fs.access(target);}catch{exists=false;}
if(!exists){
  await fs.mkdir(path.dirname(target),{recursive:true});
  await git('git',['init',target]);
  await git('git',['-C',target,'remote','add','origin',url]);
  await git('git',['-C',target,'sparse-checkout','init','--cone']);
  await git('git',['-C',target,'sparse-checkout','set','rest-fights','rest-heroes','rest-villains','rest-narration','grpc-locations','event-statistics']);
  await git('git',['-C',target,'fetch','--depth','1','--filter=blob:none','origin',revision],{maxBuffer:4_000_000});
  await git('git',['-C',target,'checkout','--detach',revision],{maxBuffer:4_000_000});
}
const actual=(await git('git',['-C',target,'rev-parse','HEAD'])).stdout.trim();
const origin=(await git('git',['-C',target,'remote','get-url','origin'])).stdout.trim();
if(actual!==revision||origin!==url)throw new Error('El ejemplo existente tiene otra revisión/origen. Se conserva sin cambios; usa otro directorio o revisa manualmente.');
await writeJson(path.join(projectRoot,'examples/source.json'),{url,revision,license:'Apache-2.0',directory:'examples/quarkus-super-heroes',service:'rest-fights'});
console.log(`Ejemplo disponible: ${target}\nRevisión: ${actual}\nNo se ejecutó código del ejemplo.`);
