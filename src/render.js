import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parse } from 'java-parser';
import { descendants } from './discovery.js';
import { atomicWrite, writeJson, csv, hash } from './io.js';
import { validateMermaid } from './mermaid.js';

const clean=value=>String(value).replaceAll('"',"'").replace(/[<>\r\n]/g,' ').replaceAll('|','/');
const md=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const technologyLabel=dep=>[[/mongodb/i,'MongoDB'],[/postgres/i,'PostgreSQL'],[/mysql/i,'MySQL'],[/redis/i,'Redis'],[/kafka/i,'Kafka'],[/rabbitmq/i,'RabbitMQ'],[/grpc/i,'gRPC'],[/http|rest|jax-rs/i,'HTTP']].find(([pattern])=>pattern.test(dep.technology))?.[1]??dep.technology;
export async function dependencyKey(inventory,flow,dep,sourceCache=new Map()) {
  const files=[...new Set(dep.evidenceIds.map(id=>flow.evidence.find(e=>e.id===id)?.file).filter(f=>f?.endsWith('.java')))];
  const keys=new Set();
  for(const file of files) {
    if(!inventory.files.some(f=>f.path===file))continue;
    if(!sourceCache.has(file))sourceCache.set(file,await fs.readFile(path.join(inventory.root,file),'utf8'));
    let text,constructors;
    try {
      const content=sourceCache.get(file),cst=parse(content);
      text=descendants(cst,'annotation').map(a=>content.slice(a.location.startOffset,a.location.endOffset+1)).join('\n');
      constructors=descendants(cst,'constructorDeclaration').map(c=>content.slice(c.location.startOffset,c.location.endOffset+1)).join('\n');
    }
    catch{continue;}
    if(dep.kind==='api') {
      for(const match of text.matchAll(/@(?:[\w.]+\.)?RegisterRestClient\s*\([^)]*configKey\s*=\s*"([^"]+)"[^)]*\)/g))keys.add('api:rest-client:'+match[1]);
      for(const match of text.matchAll(/@(?:[\w.]+\.)?GrpcClient\s*\(\s*"([^"]+)"/g))keys.add('api:grpc-client:'+match[1]);
      if(/\bClientBuilder\s*\.\s*newClient\s*\(/.test(constructors)&&[...constructors.matchAll(/\.target\s*\(/g)].length===1)keys.add('api:jaxrs-target:'+file);
    }
    if(dep.kind==='database'&&[...text.matchAll(/@(?:[\w.]+\.)?(?:MongoEntity|Entity)\b/g)].length===1)keys.add('database:entity:'+file);
    if(dep.kind==='broker') {
      const values=[...text.matchAll(/@(?:[\w.]+\.)?Channel\s*\(\s*"([^"]+)"/g)].map(m=>m[1]);
      if(new Set(values).size===1)keys.add('broker:channel:'+values[0]);
    }
  }
  // Merge only when an evidence-linked definition identifies exactly one logical resource.
  return keys.size===1?[...keys][0]:`${dep.kind}:${dep.technology}:${dep.target||dep.label}`;
}
export async function architecture(inventory,flows) {
  const deps=new Map(),edges=[];
  const sourceCache=new Map();
  for(const flow of flows.filter(f=>f.status==='analyzed')) for(const step of flow.steps) {
    const dep=flow.dependencies.find(d=>d.id===step.dependencyId);
    const key=await dependencyKey(inventory,flow,dep,sourceCache);
    const id=`dep_${hash(key).slice(0,10)}`;
    if(!deps.has(id))deps.set(id,{...dep,id});
    edges.push({id:`edge_${edges.length}`,entryId:flow.entryId,target:id,label:step.operation,condition:step.condition,mode:step.mode});
  }
  const lines=['flowchart LR',`    API["${clean(inventory.service)}"]`];
  for(const dep of deps.values()) {
    const label=clean(`${dep.label} / ${technologyLabel(dep)}`);
    lines.push(dep.kind==='database'||dep.kind==='cache'?`    ${dep.id}[("${label}")]`:`    ${dep.id}["${label}"]`);
  }
  const overview=[];
  for(const dep of deps.values()) {
    const related=edges.filter(e=>e.target===dep.id), operations=new Set(related.map(e=>e.label));
    // Non-blocking HTTP/database I/O still belongs to a request/response flow.
    // Overview dashes classify messaging; they do not assert acknowledgment behavior.
    const async=dep.kind==='broker';
    const count=new Set(related.map(e=>e.entryId)).size;
    const label=clean(`${async?'MENSAJERÍA / ':''}${operations.size} ${operations.size===1?'operación':'operaciones'} / ${count} ${count===1?'entrada':'entradas'}${related.some(e=>e.condition)?' / condicionado según flujo':''}`);
    lines.push(`    API ${async?'-.->':'-->'}|"${label}"| ${dep.id}`);
    overview.push({id:`overview_${dep.id}`,target:dep.id,label,condition:'',mode:async?'async':'sync'});
  }
  return {source:lines.join('\n')+'\n',deps:[...deps.values()],edges:overview,steps:edges};
}
// Native Draw.io overview: deterministic editable cells, no invented runtime ordering.
function drawioOverview(inventory,graph) {
  const cells=['<mxCell id="0"/><mxCell id="1" parent="0"/>'];
  cells.push(`<mxCell id="API" value="${escape(inventory.service)}" style="rounded=1;whiteSpace=wrap;html=0;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="60" y="180" width="200" height="85" as="geometry"/></mxCell>`);
  graph.deps.forEach((dep,index)=>{
    const shape=['database','cache'].includes(dep.kind)?'shape=cylinder3;':'rounded=1;';
    const color={api:'#d5e8d4',database:'#fff2cc',cache:'#ffe6cc',broker:'#e1d5e7',external:'#f5f5f5'}[dep.kind];
    cells.push(`<mxCell id="${dep.id}" value="${escape(dep.label+'\n'+technologyLabel(dep))}" style="${shape}whiteSpace=wrap;html=0;fillColor=${color};strokeColor=#666666;" vertex="1" parent="1"><mxGeometry x="650" y="${40+index*160}" width="250" height="85" as="geometry"/></mxCell>`);
  });
  const seen=new Set();
  for(const edge of graph.edges) {
    const key=edge.target+':'+edge.label+':'+edge.condition+':'+edge.mode;if(seen.has(key))continue;seen.add(key);
    cells.push(`<mxCell id="${edge.id}" value="${escape(edge.label+(edge.condition?' ['+edge.condition+']':'')+(edge.mode==='async'?' (asíncrono)':''))}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=block;${edge.mode==='async'?'dashed=1;':''}labelBackgroundColor=#ffffff;" edge="1" parent="1" source="API" target="${edge.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  }
  return `<mxfile host="ArchiFlow Agent"><diagram id="architecture" name="Dependencias"><mxGraphModel dx="1200" dy="900" grid="1" gridSize="10" page="1" pageScale="1" pageWidth="1400" pageHeight="${Math.max(900,graph.deps.length*160+100)}"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>\n`;
}
export async function renderAudit(out,inventory,flows,coverage) {
  const graph=await architecture(inventory,flows);await validateMermaid(graph.source);
  await atomicWrite(path.join(out,'architecture.mmd'),graph.source);
  await atomicWrite(path.join(out,'architecture.drawio'),drawioOverview(inventory,graph));
  const evidenceRows=[],coverageRows=[],index=[];
  for(const entry of inventory.entries) {
    const flow=flows.find(f=>f.entryId===entry.id);
    const failed=!flow&&coverage.blocked.includes(entry.id);
    coverageRows.push({id:entry.id,kind:entry.kind,method:entry.method,route:entry.route,handler:flow?.handler??entry.symbol,status:flow?.status??(failed?'failed':'excluded'),reason:flow?'':failed?'No se obtuvo resultado validado; consulta progress.md':'Fuera del filtro solicitado'});
    if(!flow)continue;
    index.push(`| ${md(entry.method+' '+entry.route)} | ${md(flow.summary.split(/(?<=\.)\s/)[0])} | ${flow.status} | [Detalle](flows/${entry.id}.md) |`);
    const evidence=flow.evidence.map(e=>`| ${e.id} | ${e.status} | ${md(e.claim)} | [${md(e.file)}:${e.startLine}](${encodeURI(path.join(inventory.root,e.file).replaceAll('\\','/'))}:${e.startLine}) |`).join('\n');
    const dependencies=flow.dependencies.map(d=>`| ${md(d.label)} | ${d.kind} / ${md(d.technology)} | ${md(d.target)} | ${d.evidenceIds.join(', ')} |`).join('\n');
    const steps=flow.steps.map(s=>`| ${s.id} | ${s.dependencyId} | ${md(s.operation)} | ${s.mode} | ${md(s.condition||'Sin condición adicional identificada')} | ${s.evidenceIds.join(', ')} |`).join('\n');
    const branches=flow.branches.map(b=>`- **${b.condition}**: ${b.explanation} (${b.evidenceIds.join(', ')}).`).join('\n');
    const errors=flow.errors.map(e=>`- ${e.behavior} (${e.evidenceIds.join(', ')}).`).join('\n');
    const sequence=flow.status==='analyzed'?`\n## Secuencia\n\n\`\`\`mermaid\n${flow.sequenceMermaid}\n\`\`\`\n`:'';
    const text=`# ${entry.method} ${entry.route}\n\n${flow.summary}\n\nEstado: ${flow.status}. Handler: ${flow.handler}.\n\n## Dependencias alcanzables\n\n| Destino | Tipo / tecnología | Configuración / operación remota | Evidencia |\n|---|---|---|---|\n${dependencies}\n\n## Pasos\n\n| ID | Destino | Operación | Modo | Condición | Evidencia |\n|---|---|---|---|---|---|\n${steps}\n\n## Bifurcaciones\n\n${branches||'No se identificaron bifurcaciones en el alcance revisado.'}\n\n## Fallos y resiliencia\n\n${errors||'No se identificó manejo explícito adicional en el alcance revisado.'}\n${sequence}\n## Evidencia\n\n| ID | Estado | Hallazgo | Fuente |\n|---|---|---|---|\n${evidence}\n\n## Límites\n\n${flow.limits.map(x=>'- '+x).join('\n')}\n`;
    await atomicWrite(path.join(out,'flows',`${entry.id}.md`),text);
    if(flow.status==='analyzed')await atomicWrite(path.join(out,'flows',`${entry.id}.sequence.mmd`),flow.sequenceMermaid+'\n');
    evidenceRows.push(...flow.evidence.map(e=>({entryId:entry.id,...e})));
  }
  await atomicWrite(path.join(out,'coverage.csv'),csv(coverageRows,['id','kind','method','route','handler','status','reason']));
  await atomicWrite(path.join(out,'evidence.csv'),csv(evidenceRows,['entryId','id','status','claim','file','startLine','endLine','quote']));
  await writeJson(path.join(out,'audit.json'),{schemaVersion:1,service:inventory.service,sourceFingerprint:inventory.fingerprint,coverage,flows});
  const report=`# Auditoría: ${inventory.service}\n\nRaíz: ${inventory.root}\n\nRevisión: ${inventory.git.revision??'Sin Git'}; modificaciones detectadas: ${inventory.git.dirty??'no determinado'}.\n\nFingerprint de fuentes: ${inventory.fingerprint}.\n\nSe analizaron ${coverage.analyzed} de ${coverage.selected} entradas seleccionadas. Bloqueadas: ${coverage.blocked.length}. Estado: ${coverage.complete?'completo para el inventario seleccionado':'parcial'}. El descubrimiento estático no demuestra cobertura universal.\n\n## Responsabilidades por entrada\n\n| Entrada | Propósito observado | Estado | Documentación |\n|---|---|---|---|\n${index.join('\n')}\n\n## Mapa general\n\n\`\`\`mermaid\n${graph.source}\`\`\`\n\n[Draw.io editable](architecture.drawio). Las secuencias detalladas están en cada entrada.\n\n## Alcance y límites\n\n${[...inventory.limitations,...inventory.warnings,...inventory.omitted].map(x=>'- '+x).join('\n')}\n\nCada hallazgo se vincula a archivo/líneas; las citas se comprobaron mecánicamente. Esa comprobación no demuestra por sí sola la interpretación semántica. El análisis usa código y contrato, no tráfico real.\n`;
  await atomicWrite(path.join(out,'report.md'),report);
  const diagrams=[{id:'architecture',file:'architecture.mmd',content:graph.source},...flows.filter(f=>f.status==='analyzed').map(f=>({id:f.entryId,file:`flows/${f.entryId}.sequence.mmd`,content:f.sequenceMermaid+'\n'}))];
  await writeJson(path.join(out,'artifacts.json'),{files:diagrams.map(d=>({file:d.file,sha256:hash(d.content)}))});
  return diagrams;
}
