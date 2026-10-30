import Ajv from 'ajv';
import { promises as fs } from 'node:fs';
import { flowSchema } from './schema.js';
import { hash, sourcePath } from './io.js';
import { validateMermaid } from './mermaid.js';

const validateShape=new Ajv({allErrors:true}).compile(flowSchema);
const idPattern=/^[A-Za-z][A-Za-z0-9_]*$/;
function unique(items,label) {
  const ids=new Set();
  for(const item of items) { if(!idPattern.test(item.id)||ids.has(item.id)) throw new Error(`${label}: ID inválido o duplicado: ${item.id}`); ids.add(item.id); }
  return ids;
}
export async function validateFlow(flow,entry,inventory) {
  if(!validateShape(flow)) throw new Error(`Contrato de auditoría inválido: ${JSON.stringify(validateShape.errors)}`);
  if(flow.entryId!==entry.id) throw new Error('La respuesta no corresponde a la entrada solicitada.');
  if(!flow.summary.trim()||!flow.limits.length) throw new Error('Falta propósito o límites del análisis.');
  const evidenceIds=unique(flow.evidence,'Evidencia'), dependencyIds=unique(flow.dependencies,'Dependencia');
  unique(flow.steps,'Paso'); unique(flow.branches,'Rama');
  const manifest=new Map(inventory.files.map(f=>[f.path,f]));
  const sourceCache=new Map();
  for(const evidence of flow.evidence) {
    const file=manifest.get(evidence.file);
    if(!file) throw new Error(`Evidencia fuera del inventario: ${evidence.file}`);
    if(!sourceCache.has(file.path)) {
      const content=await fs.readFile(await sourcePath(inventory.root,file.path),'utf8');
      if(hash(content)!==file.sha256) throw new Error(`Fuente modificada: ${file.path}`);
      sourceCache.set(file.path,content);
    }
    const lines=sourceCache.get(file.path).split(/\r?\n/);
    if(evidence.startLine<1||evidence.endLine<evidence.startLine||evidence.endLine>lines.length||evidence.endLine-evidence.startLine>100) throw new Error(`Intervalo de evidencia inválido: ${evidence.id}`);
    if(evidence.quote.trim().length<5||!lines.slice(evidence.startLine-1,evidence.endLine).join('\n').includes(evidence.quote.replaceAll('\r\n','\n'))) throw new Error(`Fragmento de evidencia inexistente en el intervalo: ${evidence.id}`);
    if(!evidence.claim.trim()) throw new Error(`Afirmación vacía: ${evidence.id}`);
  }
  function checkRefs(refs,label) {
    if(!refs.length||refs.some(id=>!evidenceIds.has(id))) throw new Error(`Referencias de evidencia inválidas: ${label}`);
  }
  for(const dep of flow.dependencies) {
    checkRefs(dep.evidenceIds,dep.id);
    if(!flow.steps.some(s=>s.dependencyId===dep.id)) throw new Error(`Dependencia declarada sin paso alcanzable: ${dep.id}`);
  }
  for(const step of flow.steps) {
    if(!dependencyIds.has(step.dependencyId)) throw new Error(`Paso con destino desconocido: ${step.id}`);
    checkRefs(step.evidenceIds,step.id);
    const marker=`%% step:${step.id}`;
    const lines=flow.sequenceMermaid.split(/\r?\n/), index=lines.findIndex(l=>l.trim()===marker);
    const message=lines.slice(index+1).find(l=>l.trim()&&!l.trim().startsWith('%%')) ?? '';
    if(index<0||!message.includes(step.dependencyId)||!/(?:->>|-->>|->|-->|-\)|--\))/.test(message)) throw new Error(`Paso sin mensaje Mermaid asociado: ${step.id}`);
  }
  for(const branch of flow.branches) checkRefs(branch.evidenceIds,branch.id);
  for(const error of flow.errors) checkRefs(error.evidenceIds,error.behavior);
  if(flow.status==='analyzed') {
    if(!flow.evidence.length||!flow.handler.trim()) throw new Error('Una entrada analizada necesita handler y evidencia.');
    if(!entry.handlerCandidates.length)throw new Error('No hay implementación candidata de esta entrada; documenta el contrato como blocked hasta resolver el handler.');
    const handlerEvidence=flow.evidence.some(e=>entry.handlerCandidates.some(c=>c.file===e.file&&e.startLine<=c.endLine&&e.endLine>=c.startLine));
    if(entry.handlerCandidates.length&&!handlerEvidence) throw new Error('Falta evidencia de la implementación candidata de la entrada.');
    await validateMermaid(flow.sequenceMermaid);
    if(!flow.sequenceMermaid.trim().startsWith('sequenceDiagram')) throw new Error('La entrada requiere sequenceDiagram.');
  } else if(!flow.limits.some(x=>x.trim().length>10)) throw new Error('Una entrada bloqueada necesita motivo concreto.');
  return true;
}

export async function validateAudit(inventory,flows,selectedIds=inventory.entries.map(e=>e.id)) {
  const entries=new Map(inventory.entries.map(e=>[e.id,e])), seen=new Set();
  for(const flow of flows) {
    if(seen.has(flow.entryId)||!selectedIds.includes(flow.entryId)) throw new Error(`Flujo duplicado o fuera de alcance: ${flow.entryId}`);
    seen.add(flow.entryId); await validateFlow(flow,entries.get(flow.entryId),inventory);
  }
  const missing=selectedIds.filter(id=>!seen.has(id));
  if(missing.length) throw new Error(`Cobertura incompleta: ${missing.join(', ')}`);
  const blocked=flows.filter(f=>f.status==='blocked').map(f=>f.entryId);
  return { selected:selectedIds.length, analyzed:flows.length-blocked.length, blocked, complete:blocked.length===0 };
}
