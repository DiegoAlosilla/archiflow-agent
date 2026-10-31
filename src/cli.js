#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { discover } from './discovery.js';
import { runAudit, loadValidatedRun } from './runner.js';
import { validateMermaid } from './mermaid.js';
import { mcpConfiguration,checkMcp,publishDiagrams } from './mcp.js';
import { readJson, writeJson, atomicWrite, projectRoot, hash, lockRun } from './io.js';
import { diagramTypes, choosePresentation, renderPresentation } from './presentation.js';
import { mermaidToDrawio } from './drawio.js';
import { chooseDelivery, openLocal } from './delivery.js';

const execute=promisify(execFile);
async function deliverFile(out,file,content,mode,options) {
  const record={mode,file,sha256:hash(content),at:new Date().toISOString(),status:mode==='local'?'opening':'files-ready'};
  await writeJson(path.join(out,'delivery.json'),record);
  try {
    if(mode==='local')Object.assign(record,await openLocal(content,{url:options['editor-url'],log:console.error}));
  }catch(error){Object.assign(record,{status:'failed',error:error.message});throw error;}
  finally{await writeJson(path.join(out,'delivery.json'),record);}
  return record;
}
function integer(value,name,fallback,min,max){const n=value===undefined?fallback:Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${name} debe ser entero entre ${min} y ${max}.`);return n;}
const help=`ArchiFlow Agent\n\n  node src/cli.js doctor\n  node src/cli.js discover --repo <microservicio> --out <inventory.json>\n  node src/cli.js audit --repo <microservicio> --out <directorio> [--endpoint "GET /ruta"] [--resume] [--publish]\n  node src/cli.js validate --run <directorio>\n  node src/cli.js diagram --mermaid <archivo.mmd> --out <directorio> [--publish] [--mcp <config.json>]\n  node src/cli.js mcp-check [--mcp <config.json>] [--out <resultado.json>]\n  node src/cli.js publish --run <directorio> [--all-diagrams] [--mcp <config.json>]\n\nAudit: --batch-size 3, --timeout-seconds 600, --max-context 430000.\nPublicación predeterminada: mapa general; --all-diagrams abre también cada secuencia.\nEl directorio de resultados debe estar separado del objetivo.\n`;
async function publishRun(out,options){
  const unlock=await lockRun(out);
  try {
    const {audit}=await loadValidatedRun(out);
    let selected;
    try{selected=(await readJson(path.join(out,'presentation.json'))).publish;}catch(error){if(error.code!=='ENOENT')throw error;}
    selected??=[{file:'architecture.mmd',format:'mermaid'}];
    if(options['all-diagrams']&&!selected.some(d=>d.file==='views/sequences.drawio'))for(const flow of audit.flows.filter(f=>f.status==='analyzed')) {
      const file=`flows/${flow.entryId}.sequence.mmd`;if(!selected.some(d=>d.file===file))selected.push({file,format:'mermaid'});
    }
    const diagrams=[];
    const artifacts=await readJson(path.join(out,'artifacts.json'));
    for(const {file,format} of selected){
      if(!/^(architecture\.mmd|views\/[a-z0-9-]+\.(mmd|drawio)|flows\/entry_[a-f0-9]+\.sequence\.mmd)$/.test(file)||!['xml','mermaid'].includes(format))throw new Error('Selección de publicación inválida.');
      const content=await fs.readFile(path.join(out,file),'utf8');
      if(!artifacts.files.some(a=>a.file===file&&a.sha256===hash(content)))throw new Error(`Artefacto sin validar: ${file}`);
      if(format==='mermaid')await validateMermaid(content);diagrams.push({id:file,file,content,format});
    }
    const published=[];
    await publishDiagrams(await mcpConfiguration(options.mcp),diagrams,async item=>{published.push(item);await writeJson(path.join(out,'publication.json'),{status:'in-progress',items:published});});
    await writeJson(path.join(out,'publication.json'),{status:'submitted',items:published});
    return {published:published.length,record:path.join(out,'publication.json'),urls:published.flatMap(p=>p.urls)};
  } catch(error){await writeJson(path.join(out,'publication-error.json'),{at:new Date().toISOString(),error:error.message});throw error;} finally{await unlock();}
}
export async function main(argv=process.argv.slice(2)) {
  const {values:v,positionals}=parseArgs({args:argv,allowPositionals:true,options:{repo:{type:'string'},out:{type:'string'},run:{type:'string'},endpoint:{type:'string'},resume:{type:'boolean'},publish:{type:'boolean'},mermaid:{type:'string'},mcp:{type:'string'},delivery:{type:'string'},'editor-url':{type:'string'},'check-mcp':{type:'boolean'},'diagram-type':{type:'string'},direction:{type:'string'},'all-diagrams':{type:'boolean'},'batch-size':{type:'string'},'timeout-seconds':{type:'string'},'max-context':{type:'string'},'context-scope':{type:'string'},help:{type:'boolean',short:'h'}}});
  const command=positionals[0];
  if(!command||v.help){console.log(help+'\n  node src/cli.js diagram-types\n  node src/cli.js render --run <auditoría> [--diagram-type integration,sequence] [--direction TB|LR]\nAudit, render y diagram: --delivery files|local|mcp. Predeterminado files; terminal interactiva pregunta.\n--delivery local --editor-url http://127.0.0.1:8080/ abre el editor ya iniciado.\n--publish es alias de --delivery mcp. doctor solo comprueba MCP con --check-mcp.\nAudit y render preguntan el tipo cuando hay terminal interactiva. En automatización usa --diagram-type.\n');return;}
  if(positionals.length>1)throw new Error('Argumentos posicionales inesperados. Usa --help.');
  const required=(...names)=>{for(const name of names)if(!v[name])throw new Error(`Falta --${name}.`);};
  let delivery;
  const deliverRun=async out=>{
    if(delivery==='mcp')return publishRun(out,v);
    const unlock=await lockRun(out);
    try {
      await loadValidatedRun(out);
      const file=path.join(out,'diagrams.drawio'),content=await fs.readFile(file,'utf8');
      const manifest=await readJson(path.join(out,'artifacts.json'));
      if(!manifest.files.some(a=>a.file==='diagrams.drawio'&&a.sha256===hash(content)))throw new Error('Archivo portátil sin validar. Ejecuta render.');
      return await deliverFile(out,file,content,delivery,v);
    }finally{await unlock();}
  };
  if(command==='diagram-types'){console.log(JSON.stringify(diagramTypes,null,2));return;}
  if(command==='render') {
    required('run');const selection=await choosePresentation(v);delivery=await chooseDelivery(v);
    const out=path.resolve(v.run),unlock=await lockRun(out);
    try{const {inventory,audit}=await loadValidatedRun(out);console.log(JSON.stringify(await renderPresentation(out,inventory,audit.flows,selection),null,2));}
    finally{await unlock();}
    console.log(JSON.stringify(await deliverRun(out),null,2));return;
  }
  if(command==='doctor') {
    const checks={node:process.version,project:projectRoot};
    try{checks.codex=(await execute(process.env.ARCHIFLOW_CODEX_BIN??'codex',['--version'])).stdout.trim();checks.authentication=(await execute(process.env.ARCHIFLOW_CODEX_BIN??'codex',['login','status'])).stderr.trim()||'Consulta completada';}catch(error){checks.codexError=error.message;}
    checks.mcp=v['check-mcp']?await checkMcp(await mcpConfiguration(v.mcp)):{status:'optional',check:'node src/cli.js mcp-check'};console.log(JSON.stringify(checks,null,2));return;
  }
  if(command==='discover'){required('repo','out');const inventory=await discover(v.repo);await writeJson(path.resolve(v.out),inventory);console.log(JSON.stringify({entries:inventory.entries.length,warnings:inventory.warnings,out:path.resolve(v.out)},null,2));return;}
  if(command==='audit') {
    required('repo','out');
    const presentation=await choosePresentation(v);
    delivery=await chooseDelivery(v);
    const result=await runAudit({repo:v.repo,out:v.out,endpoint:v.endpoint,resume:v.resume,presentation,contextScope:v['context-scope']??'core',batchSize:integer(v['batch-size'],'batch-size',3,1,10),timeoutMs:integer(v['timeout-seconds'],'timeout-seconds',600,10,3600)*1000,maxContext:integer(v['max-context'],'max-context',430000,1000,2000000),log:message=>console.error(message)});
    console.log(JSON.stringify({out:result.out,coverage:result.coverage},null,2));
    if(!result.coverage.complete){process.exitCode=2;return;}
    console.log(JSON.stringify(await deliverRun(result.out),null,2));return;
  }
  if(command==='validate'){required('run');const result=await loadValidatedRun(path.resolve(v.run));console.log(JSON.stringify({status:'valid',coverage:result.coverage},null,2));return;}
  if(command==='mcp-check'){const result=await checkMcp(await mcpConfiguration(v.mcp));if(v.out)await writeJson(path.resolve(v.out),result);console.log(JSON.stringify(result,null,2));return;}
  if(command==='publish'){required('run');console.log(JSON.stringify(await publishRun(path.resolve(v.run),v),null,2));return;}
  if(command==='diagram') {
    required('mermaid','out');delivery=await chooseDelivery(v);const out=path.resolve(v.out);const content=await fs.readFile(path.resolve(v.mermaid),'utf8');await validateMermaid(content);
    const unlock=await lockRun(out);
    try {
      try{await fs.access(path.join(out,'diagram.json'));throw new Error('Salida existente: elige un directorio nuevo para no sobrescribir ediciones.');}catch(error){if(error.code!=='ENOENT')throw error;}
      await atomicWrite(path.join(out,'diagram.mmd'),content);
      const native=await mermaidToDrawio(content);
      await atomicWrite(path.join(out,'diagram.drawio'),native);
      await writeJson(path.join(out,'diagram.json'),{source:path.resolve(v.mermaid),sha256:hash(content),drawioSha256:hash(native),syntax:'valid',architecture:'not-audited',createdAt:new Date().toISOString()});
      if(delivery==='mcp'){const items=await publishDiagrams(await mcpConfiguration(v.mcp),[{id:'diagram',file:'diagram.drawio',content:native,format:'xml'}]);await writeJson(path.join(out,'publication.json'),{status:'submitted',items});}
      else await deliverFile(out,path.join(out,'diagram.drawio'),native,delivery,v);
      console.log(JSON.stringify({out,syntax:'valid',architecture:'not-audited'},null,2));
    }finally{await unlock();}return;
  }
  throw new Error(`Comando desconocido: ${command}`);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))main().catch(error=>{console.error(`ArchiFlow: ${error.message}`);process.exitCode=1;});
