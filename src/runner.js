import { promises as fs } from 'node:fs';
import path from 'node:path';
import { discover, sourceBundle, contextFiles } from './discovery.js';
import { codexAnalyze, agentInstructions } from './engine.js';
import { resultSchema } from './schema.js';
import { validateFlow, validateAudit } from './validation.js';
import { renderAudit } from './render.js';
import { renderPresentation } from './presentation.js';
import { escapeSequenceLabels } from './mermaid.js';
import { hash, inside, lockRun, readJson, writeJson, atomicWrite, canonicalTarget } from './io.js';

export async function loadValidatedRun(out) {
  const inventory=await readJson(path.join(out,'inventory.json'));
  const current=await discover(inventory.root);
  if(current.fingerprint!==inventory.fingerprint) throw new Error('Las fuentes cambiaron desde la auditoría; crea una ejecución nueva.');
  const audit=await readJson(path.join(out,'audit.json'));
  const state=await readJson(path.join(out,'state.json'));
  if(audit.sourceFingerprint!==inventory.fingerprint) throw new Error('El informe no corresponde al inventario.');
  const coverage=await validateAudit(inventory,audit.flows,state.selectedIds);
  if(!coverage.complete) throw new Error('La auditoría contiene entradas bloqueadas; publicación deshabilitada.');
  const artifacts=await readJson(path.join(out,'artifacts.json'));
  const expected=['architecture.mmd',...audit.flows.map(f=>`flows/${f.entryId}.sequence.mmd`)];
  for(const file of expected) {
    const item=artifacts.files.find(a=>a.file===file);
    if(!item||hash(await fs.readFile(path.join(out,file),'utf8'))!==item.sha256)throw new Error(`Diagrama modificado después de validación: ${file}. Usa el modo diagram para publicar una edición manual.`);
  }
  for(const item of artifacts.files.filter(a=>!expected.includes(a.file))) {
    if(!/^(presentation\.json|architecture\.drawio|views\/[a-z0-9-]+\.(mmd|drawio))$/.test(item.file))throw new Error('Artefacto inesperado en manifiesto.');
    if(hash(await fs.readFile(path.join(out,item.file),'utf8'))!==item.sha256)throw new Error(`Diagrama modificado después de validación: ${item.file}`);
  }
  // A selection record is trusted only when included in the artifact manifest.
  try {await fs.access(path.join(out,'presentation.json'));if(!artifacts.files.some(a=>a.file==='presentation.json'))throw new Error('Selección de diagramas sin validar.');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  return {inventory,audit,state,coverage};
}
export async function runAudit(options,analyze=codexAnalyze) {
  const repo=await fs.realpath(options.repo),out=await canonicalTarget(options.out);
  if(inside(repo,out)||inside(out,repo)) throw new Error('El directorio de resultados debe estar separado del repositorio objetivo, sin contenerlo.');
  const unlock=await lockRun(out);
  let state;
  const log=options.log??(()=>{});
  const emit=async(type,details={})=>{
    await fs.appendFile(path.join(out,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),type,...details})+'\n');
  };
  async function checkpoint() {
    state.updatedAt=new Date().toISOString();await writeJson(path.join(out,'state.json'),state);
    await atomicWrite(path.join(out,'progress.md'),`# Objetivos de auditoría\n\nEstado: ${state.status}\n\n| Entrada | Estado | Intentos | Motivo |\n|---|---|---|---|\n${state.tasks.map(t=>`| ${t.label.replaceAll('|','/')} | ${t.status} | ${t.attempts} | ${(t.error??'').replaceAll('|','/').replaceAll('\n',' ')} |`).join('\n')}\n\nFases: inventario → análisis por entrada → evidencia → Mermaid → publicación opcional.\n`);
  }
  try {
    const inventory=await discover(repo);
    if(!inventory.entries.length) throw new Error('No se descubrieron entradas soportadas. Selecciona un microservicio Java/Quarkus con REST/OpenAPI.');
    const selected=options.endpoint?inventory.entries.filter(e=>`${e.method} ${e.route}`.trim()===options.endpoint):inventory.entries;
    if(!selected.length) throw new Error(`Endpoint no encontrado: ${options.endpoint}`);
    const harnessFingerprint=hash(await agentInstructions()+JSON.stringify(resultSchema));
    const selectedIds=selected.map(e=>e.id);
    let existing=false;
    try { await fs.access(path.join(out,'state.json'));existing=true; } catch {}
    if(existing&&!options.resume) throw new Error('La ejecución ya existe. Usa --resume o un directorio de salida nuevo.');
    if(options.resume&&!existing) throw new Error('No hay ejecución que reanudar. Quita --resume.');
    if(existing) {
      state=await readJson(path.join(out,'state.json'));
      if(state.sourceFingerprint!==inventory.fingerprint||state.repo!==repo||JSON.stringify(state.selectedIds)!==JSON.stringify(selectedIds)||state.harnessFingerprint!==harnessFingerprint) throw new Error('Fuentes, alcance o instrucciones cambiaron; crea una ejecución nueva.');
    } else {
      state={schemaVersion:1,repo,out,createdAt:new Date().toISOString(),sourceFingerprint:inventory.fingerprint,harnessFingerprint,selectedIds,status:'running',tasks:selected.map(e=>({id:e.id,label:`${e.method} ${e.route}`.trim(),status:'pending',attempts:0,error:null}))};
      await writeJson(path.join(out,'inventory.json'),inventory);
    }
    if(options.presentation)state.presentation=options.presentation;
    state.status='running';await checkpoint();await emit('inventory.completed',{discovered:inventory.entries.length,selected:selected.length});
    // Re-check completed work before trusting a resumed checkpoint.
    for(const task of state.tasks) if(task.status==='analyzed'||task.status==='blocked') {
      await validateFlow(await readJson(path.join(out,'results',task.id+'.json')),selected.find(e=>e.id===task.id),inventory);
    }
    // Recover a previously rejected candidate only if a syntax-only label escape makes it valid.
    // Source/scope/instruction fingerprints were checked above; failed evidence is never bypassed.
    if(options.resume) for(const task of state.tasks.filter(t=>t.status==='failed')) {
      for(let attempt=task.attempts;attempt>=1;attempt--) {
        let flow;try{flow=await readJson(path.join(out,'rejected',`${task.id}-${attempt}.json`));}catch(error){if(error.code==='ENOENT')continue;throw error;}
        const escaped=escapeSequenceLabels(flow.sequenceMermaid);
        if(escaped===flow.sequenceMermaid)continue;
        flow.sequenceMermaid=escaped;
        try{
          await validateFlow(flow,selected.find(e=>e.id===task.id),inventory);
          await writeJson(path.join(out,'results',task.id+'.json'),flow);
          task.status=flow.status;task.error=null;
          await emit('analysis.recovered',{entryId:task.id,fromAttempt:attempt,transformation:'escape-sequence-label-semicolons'});break;
        }catch{/* The next engine call must repair any remaining evidence or semantic-structure errors. */}
      }
    }
    const pending=state.tasks.filter(t=>!['analyzed','blocked'].includes(t.status));
    const contextScope=options.contextScope??'core';
    const included=contextFiles(inventory,contextScope).map(f=>f.path);
    state.contextScopes=[...new Set([...(state.contextScopes??(existing?['all']:[])),contextScope])];
    inventory.context={scopesUsed:state.contextScopes,lastScope:contextScope,lastIncludedFiles:included};
    if(contextScope==='core')inventory.limitations.push('El contexto core incluye src/main y descriptores de build; variantes generadas de deploy externas a src/main quedan fuera de esta pasada. Usa --context-scope all para incluirlas.');
    await writeJson(path.join(out,'inventory.json'),inventory);
    await emit('context.selected',{scope:contextScope,includedFiles:included});
    const sources=pending.length?await sourceBundle(inventory,options.maxContext??430_000,contextScope):'';
    const batchSize=options.batchSize??3;
    for(let offset=0;offset<pending.length;offset+=batchSize) {
      let batch=pending.slice(offset,offset+batchSize),repair='';
      for(let attempt=0;attempt<2&&batch.length;attempt++) {
        for(const task of batch) {task.status='running';task.attempts++;task.error=null;}
        await checkpoint();log(`Analizando ${batch.map(t=>t.label).join(' | ')}${attempt?' (corrección)':''}`);
        await emit('analysis.started',{entries:batch.map(t=>t.id)});
        try {
          const response=await analyze({inventory,entries:batch.map(t=>selected.find(e=>e.id===t.id)),sources,repair,timeoutMs:options.timeoutMs??600_000,onEvent:event=>{if(event.type==='turn.started')log('Motor de análisis iniciado.');}});
          const result=response.result;
          if(!result||!Array.isArray(result.flows))throw new Error('El motor no devolvió flows.');
          const ids=result.flows.map(f=>f.entryId);
          if(new Set(ids).size!==ids.length||ids.some(id=>!batch.some(t=>t.id===id)))throw new Error('El motor devolvió entradas duplicadas o fuera del lote.');
          const failed=[];
          for(const task of batch) {
            const flow=result.flows.find(f=>f.entryId===task.id);
            try {
              if(!flow)throw new Error('El motor omitió esta entrada.');
              const escaped=escapeSequenceLabels(flow.sequenceMermaid);
              if(escaped!==flow.sequenceMermaid){flow.sequenceMermaid=escaped;await emit('diagram.labels-escaped',{entryId:task.id});}
              await validateFlow(flow,selected.find(e=>e.id===task.id),inventory);
              await writeJson(path.join(out,'results',task.id+'.json'),flow);
              task.status=flow.status;task.error=flow.status==='blocked'?flow.limits.join(' '):null;
              await emit('analysis.validated',{entryId:task.id,status:task.status,engine:response.engine});
            } catch(error) {
              task.status='failed';task.error=error.message;failed.push(task);
              if(flow)await writeJson(path.join(out,'rejected',`${task.id}-${task.attempts}.json`),flow);
              await emit('analysis.rejected',{entryId:task.id,attempt:task.attempts,error:error.message});
            }
          }
          batch=failed;repair=failed.map(t=>`${t.id}: ${t.error}`).join('\n');
        } catch(error) {
          repair=error.message;
          for(const task of batch){task.status='failed';task.error=error.message;}
          await emit('analysis.failed',{entries:batch.map(t=>t.id),error:error.message});
          // Engine/auth/timeout failures are not automatically retried; resume is explicit.
          await checkpoint();break;
        }
        await checkpoint();
      }
    }
    const flows=[];
    for(const task of state.tasks) if(['analyzed','blocked'].includes(task.status))flows.push(await readJson(path.join(out,'results',task.id+'.json')));
    const current=await discover(repo);
    if(current.fingerprint!==inventory.fingerprint)throw new Error('Las fuentes cambiaron durante el análisis; resultados no publicables.');
    const failed=state.tasks.filter(t=>!['analyzed','blocked'].includes(t.status));
    let coverage;
    if(!failed.length)coverage=await validateAudit(inventory,flows,selectedIds);
    else coverage={selected:selectedIds.length,analyzed:flows.filter(f=>f.status==='analyzed').length,blocked:state.tasks.filter(t=>t.status!=='analyzed').map(t=>t.id),complete:false};
    await renderAudit(out,inventory,flows,coverage);
    let presentation=options.presentation??state.presentation;
    if(!presentation)try{presentation=await readJson(path.join(out,'presentation.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(presentation)await renderPresentation(out,inventory,flows,presentation);
    state.status=coverage.complete?'complete':'partial';await checkpoint();await emit('audit.completed',{coverage});
    return {out,coverage,state};
  } catch(error) {
    if(state){state.status='failed';await checkpoint();await emit('audit.failed',{error:error.message});}
    throw error;
  } finally {await unlock();}
}
