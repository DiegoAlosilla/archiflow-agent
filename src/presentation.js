import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { architecture, technologyLabel } from './render.js';
import { atomicWrite, readJson, writeJson, hash } from './io.js';
import { validateMermaid } from './mermaid.js';

export const diagramTypes = [
  {id:'dependencies',name:'Mapa de dependencias',description:'Servicio y destinos alcanzables; vista resumida.'},
  {id:'integration',name:'Integración por capas',description:'Componentes, endpoints y destinos; estilo inspirado en creditos.xml.'},
  {id:'c4-container',name:'C4 · Contenedores',description:'Vista parcial de aplicaciones y almacenes; sin inventar límites del sistema.'},
  {id:'sequence',name:'Secuencia por endpoint',description:'Orden, condiciones, paralelismo y errores documentados.'},
];
export function normalizeSelection(types,direction='TB') {
  const selected=[...new Set((Array.isArray(types)?types:String(types??'').split(',')).map(t=>t.trim()).filter(Boolean))];
  if(!selected.length||selected.some(t=>!diagramTypes.some(d=>d.id===t)))throw new Error('Selecciona --diagram-type dependencies,integration,c4-container,sequence (uno o varios).');
  if(!['TB','LR'].includes(direction))throw new Error('--direction debe ser TB (arriba abajo) o LR (izquierda derecha).');
  return {types:selected,direction};
}
export async function choosePresentation(options={},io={input:process.stdin,output:process.stderr}) {
  if(options['diagram-type'])return normalizeSelection(options['diagram-type'],options.direction);
  if(options.resume&&options.out) {
    try {const saved=await readJson(path.resolve(options.out,'presentation.json'));return normalizeSelection(saved.types,options.direction??saved.direction);}
    catch(error){if(error.code!=='ENOENT')throw error;}
    try {const saved=(await readJson(path.resolve(options.out,'state.json'))).presentation;if(saved)return normalizeSelection(saved.types,options.direction??saved.direction);}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(!io.input.isTTY)throw new Error('Falta elegir el diagrama. En chat pregunta al usuario; en automatización indica --diagram-type. Consulta "diagram-types".');
  const rl=createInterface(io);
  try {
    io.output.write('¿Qué diagramas quieres generar? Puedes combinar opciones.\n'+diagramTypes.map((d,i)=>`${i+1}. ${d.name}: ${d.description}`).join('\n')+'\n');
    let types;
    while(!types) {
      const answer=await rl.question('Números separados por coma (ej. 2,4): ');
      try{types=normalizeSelection(answer.split(',').map(n=>diagramTypes[Number(n.trim())-1]?.id??'invalid')).types;}
      catch(error){io.output.write(error.message+'\n');}
    }
    let direction=options.direction;
    if(types.every(t=>t==='sequence'))direction??='TB';
    while(!['TB','LR'].includes(direction))direction=(await rl.question('Orientación: TB = arriba abajo; LR = izquierda derecha [TB]: ')).trim().toUpperCase()||'TB';
    return normalizeSelection(types,direction);
  } finally {rl.close();}
}
const label=v=>String(v).replace(/["<>\r\n]/g,' ').replaceAll('|','/').replaceAll('\\','/');
const xml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function integration(inventory,flows,graph,direction) {
  const entries=inventory.entries.filter(e=>flows.some(f=>f.entryId===e.id&&f.status==='analyzed'));
  const nodes=[{id:'service',text:inventory.service,layer:0,kind:'service'},
    ...entries.map(e=>({id:e.id,text:`${e.method} ${e.route}`,layer:1,kind:'endpoint'})),
    ...graph.deps.map(d=>({id:d.id,text:`${d.label}\n${technologyLabel(d)}`,layer:2,kind:d.kind}))];
  const edges=entries.map(e=>({from:'service',to:e.id,text:'expone',detail:'Entrada auditada',async:false}));
  for(const entry of entries)for(const dep of graph.deps) {
    const steps=graph.steps.filter(s=>s.entryId===entry.id&&s.target===dep.id);if(!steps.length)continue;
    const operation=steps[0].label;
    const text=steps.length>1?`${steps.length} operaciones — ver detalle`:(operation.length>68?operation.slice(0,65)+'…':operation);
    edges.push({from:entry.id,to:dep.id,text:text+(steps.some(s=>s.condition)?'\n[condicional]':''),detail:steps.map(s=>s.label+(s.condition?` [${s.condition}]`:'')).join('\n\n'),async:dep.kind==='broker'});
  }
  const lines=[`flowchart ${direction}`];
  for(const n of nodes)lines.push(`    ${n.id}${['database','cache'].includes(n.kind)?`[("${label(n.text)}")]`:`["${label(n.text)}"]`}`);
  edges.forEach(e=>lines.push(`    ${e.from} ${e.async?'-.->':'-->'}|"${label(e.text)}"| ${e.to}`));
  function page(id,name,pageNodes,pageEdges) {
  const cells=['<mxCell id="0"/><mxCell id="1" parent="0"/>'];
  const maxPeers=Math.max(...[0,1,2].map(layer=>pageNodes.filter(n=>n.layer===layer).length));
  for(const n of pageNodes) {
    const peers=pageNodes.filter(p=>p.layer===n.layer),index=peers.indexOf(n),position=index+(maxPeers-peers.length)/2;
    const x=direction==='TB'?60+position*360:60+n.layer*620,y=direction==='TB'?60+n.layer*340:60+position*170;
    const shape=['database','cache'].includes(n.kind)?'shape=cylinder3;':'shape=module;jettyWidth=29;jettyHeight=10;';
    const fill=n.layer<2?'#ffff88':n.kind==='broker'?'#e1d5e7':'#ffffff';
    cells.push(`<mxCell id="${n.id}" value="${xml(n.text)}" vertex="1" parent="1" style="${shape}whiteSpace=wrap;html=0;fillColor=${fill};strokeColor=#36393d;spacing=12;"><mxGeometry x="${x}" y="${y}" width="290" height="110" as="geometry"/></mxCell>`);
  }
  pageEdges.forEach((e,i)=>cells.push(`<UserObject id="link_${i}" label="${xml(e.text)}" tooltip="${xml(e.detail)}"><mxCell edge="1" parent="1" source="${e.from}" target="${e.to}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;whiteSpace=wrap;endArrow=open;endFill=0;labelBackgroundColor=#ffffff;${e.async?'dashed=1;':''}"><mxGeometry relative="1" width="220" as="geometry"/></mxCell></UserObject>`));
  return `<diagram name="${xml(name)}" id="${id}"><mxGraphModel grid="1" page="0"><root>${cells.join('')}</root></mxGraphModel></diagram>`;
  }
  const pages=[page('integration','Integración general',nodes,edges)];
  for(const entry of entries) {
    const selectedEdges=edges.filter(e=>e.from===entry.id||e.to===entry.id),ids=new Set(selectedEdges.flatMap(e=>[e.from,e.to]));
    pages.push(page(entry.id,`${entry.method} ${entry.route}`,nodes.filter(n=>ids.has(n.id)),selectedEdges));
  }
  return {mermaid:lines.join('\n')+'\n',drawio:`<mxfile host="ArchiFlow Agent">${pages.join('')}</mxfile>\n`};
}
function c4(inventory,graph,direction) {
  // Partial container view: repository evidence cannot establish system ownership boundaries.
  const lines=['C4Container',`title ${label(inventory.service).replaceAll(';',' ')} - Contenedores - alcance parcial`,
    '%% Límites y pertenencia al sistema no determinados por el repositorio aislado.',
    `Container(service, "${label(inventory.service)}", "Microservicio", "Responsabilidades en report.md")`];
  const roles={api:'API consumida',database:'Persistencia',cache:'Caché',broker:'Mensajería',external:'Dependencia observada'};
  for(const d of graph.deps)lines.push(`${['database','cache'].includes(d.kind)?'ContainerDb':d.kind==='broker'?'ContainerQueue':'Container'}(${d.id}, "${label(d.label)}", "${label(technologyLabel(d))}", "${roles[d.kind]} - ver detalle por endpoint")`);
  for(const e of graph.edges) {
    const count=new Set(graph.steps.filter(s=>s.target===e.target).map(s=>s.entryId)).size;
    lines.push(`Rel_${direction==='TB'?'D':'R'}(service, ${e.target}, "${e.mode==='async'?'Mensajería':'Usa'} - ${count} ${count===1?'entrada':'entradas'}")`);
  }
  lines.push('UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")');
  return lines.join('\n')+'\n';
}
export async function renderPresentation(out,inventory,flows,selection) {
  selection=normalizeSelection(selection.types,selection.direction);
  const graph=await architecture(inventory,flows),outputs=[],publish=[];
  const add=(file,content,format='mermaid')=>{outputs.push({file,content});publish.push({id:file,file,format});};
  if(selection.types.includes('dependencies'))add('views/dependencies.mmd',graph.source.replace('flowchart LR',`flowchart ${selection.direction}`));
  if(selection.types.includes('integration')) {
    const view=integration(inventory,flows,graph,selection.direction);
    outputs.push({file:'views/integration.mmd',content:view.mermaid});
    add('views/integration.drawio',view.drawio,'xml');
  }
  if(selection.types.includes('c4-container'))add('views/c4-container.mmd',c4(inventory,graph,selection.direction));
  if(selection.types.includes('sequence'))for(const f of flows.filter(f=>f.status==='analyzed'))publish.push({id:f.entryId,file:`flows/${f.entryId}.sequence.mmd`,format:'mermaid'});
  for(const output of outputs)if(output.file.endsWith('.mmd'))await validateMermaid(output.content);
  const manifest=await readJson(path.join(out,'artifacts.json'));
  for(const output of outputs)await atomicWrite(path.join(out,output.file),output.content);
  const presentation={...selection,publish,notes:['Integración muestra alcanzabilidad por endpoint; el orden temporal está en las secuencias.','C4 es una vista parcial de contenedores observados. No establece propiedad ni límites del sistema.','La dirección no altera la convención temporal de secuencia.']};
  const content=JSON.stringify(presentation,null,2)+'\n';
  await atomicWrite(path.join(out,'presentation.json'),content);
  const replaced=new Set([...outputs.map(o=>o.file),'presentation.json']);
  manifest.files=manifest.files.filter(f=>!replaced.has(f.file));
  manifest.files.push(...outputs.map(o=>({file:o.file,sha256:hash(o.content)})),{file:'presentation.json',sha256:hash(content)});
  await writeJson(path.join(out,'artifacts.json'),manifest);
  return presentation;
}
