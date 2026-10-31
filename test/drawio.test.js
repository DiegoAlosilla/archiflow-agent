import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mermaidToDrawio,bundleDrawio } from '../src/drawio.js';

const parse=content=>new JSDOM(content,{contentType:'text/xml'}).window.document;
test('secuencia nativa conserva ramas anidadas, concurrencia, notas, retornos y activaciones',async()=>{
  const content=await mermaidToDrawio(`sequenceDiagram
autonumber 4 2
participant A as API
participant B as Redis
participant C as Base
A->>+B: Busca#59; pedido
B-->>-A: Resultado
alt Existe
 A-->>A: Preparar
else Falta
 par Datos
  loop Reintento
   A->>C: Leer
  end
 and Notificación
  A-)B: Publicar
 end
 opt Error
  Note over A,C: Revisar <br/> error #38; causa
 end
end`);
  const doc=parse(content),values=[...doc.querySelectorAll('mxCell[value]')].map(n=>n.getAttribute('value'));
  for(const text of ['alt [Existe]','else [Falta]','par [Datos]','loop [Reintento]','and [Notificación]','opt [Error]','4. Busca; pedido','6. Resultado','Revisar\nerror & causa'])assert.ok(values.includes(text),text);
  assert.equal(doc.querySelectorAll('mxCell[edge="1"]').length,10); // 3 lifelines + 5 messages + 2 dividers
  assert.ok([...doc.querySelectorAll('mxCell[edge="1"]')].some(n=>n.getAttribute('style').includes('endArrow=open')));
  const frames=[...doc.querySelectorAll('mxCell[vertex="1"]')].filter(n=>n.getAttribute('style').includes('strokeWidth=2'));
  assert.equal(frames.length,4);
  const parent=frames[0].querySelector('mxGeometry'),child=frames[1].querySelector('mxGeometry');
  assert.ok(+child.getAttribute('y')>+parent.getAttribute('y'));
  assert.ok(+child.getAttribute('height')<+parent.getAttribute('height'));
  assert.doesNotMatch(content,/NaN|undefined|shape=image/);
});
test('C4 y flowchart exportan etiquetas, destinos y orientación a figuras XML',async()=>{
  const source='C4Container\nContainer(A,"API","Java","Sirve pedidos")\nContainerDb(B,"Datos","MongoDB","Persiste")\nRel_R(A,B,"Consulta")';
  const c4=parse(await mermaidToDrawio(source));
  assert.match(c4.querySelector('[id="n1"]').getAttribute('value'),/Container: Database, MongoDB/);
  assert.ok(+c4.querySelector('[id="n1"] mxGeometry').getAttribute('x')>+c4.querySelector('[id="n0"] mxGeometry').getAttribute('x'));
  const flow=parse(await mermaidToDrawio('flowchart TB\nA{Existe?} -->|Sí| B[(Datos)]\nB -.->|Resultado| A'));
  assert.equal(flow.querySelectorAll('[edge="1"]').length,2);
  assert.match(flow.querySelector('[id="n0"]').getAttribute('style'),/rhombus/);
  assert.doesNotMatch(flow.documentElement.outerHTML,/NaN|undefined/);
});
test('la conversión rechaza capacidades sin soporte en vez de borrar semántica',async()=>{
  await assert.rejects(mermaidToDrawio('sequenceDiagram\nA->>B: Hola\ncreate participant C\nB->>C: Crea'),/creación/);
  await assert.rejects(mermaidToDrawio('flowchart TB\nsubgraph Grupo\nA-->B\nend'),/subgraphs/);
  await assert.rejects(mermaidToDrawio('C4Container\nSystem_Boundary(s,"Sistema") {\nContainer(A,"API","Java","Sirve")\n}'),/fronteras/);
});
test('paquete multipágina conserva XML y asigna identificadores de página únicos',async()=>{
  const content=await mermaidToDrawio('sequenceDiagram\nA->>B: Hola',{title:'POST /a & /b'});
  const doc=parse(bundleDrawio([{content},{content}]));
  assert.equal(doc.querySelectorAll('diagram').length,2);
  assert.equal(new Set([...doc.querySelectorAll('diagram')].map(n=>n.id)).size,2);
  assert.equal(doc.querySelector('diagram').getAttribute('name'),'POST /a & /b');
});
