import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,validFlow } from './helpers.js';
import { validateFlow,validateAudit } from '../src/validation.js';
import { validateMermaid,escapeSequenceLabels } from '../src/mermaid.js';

test('acepta evidencia real y Mermaid parseable',async t=>{const {inventory}=await fixture(t);assert.equal(await validateFlow(validFlow(inventory),inventory.entries[0],inventory),true);});
test('rechaza citas fabricadas, rangos inválidos y rutas ajenas',async t=>{
  const {inventory}=await fixture(t);
  for(const mutate of [f=>f.evidence[0].quote='fabricated.call()',f=>f.evidence[0].startLine=999,f=>f.evidence[0].file='../outside.java']){
    const flow=validFlow(inventory);mutate(flow);await assert.rejects(validateFlow(flow,inventory.entries[0],inventory),/evidencia|Evidencia/);
  }
});
test('rechaza saltos sin evidencia y dependencias no usadas',async t=>{
  const {inventory}=await fixture(t);const flow=validFlow(inventory);flow.steps[0].evidenceIds=['missing'];await assert.rejects(validateFlow(flow,inventory.entries[0],inventory),/Referencias/);
  const unused=validFlow(inventory);unused.steps=[];await assert.rejects(validateFlow(unused,inventory.entries[0],inventory),/sin paso/);
});
test('rechaza Mermaid sin representación del salto o sintaxis válida',async t=>{
  const {inventory}=await fixture(t);const flow=validFlow(inventory);flow.sequenceMermaid=flow.sequenceMermaid.replace('%% step:s1','%% erased');await assert.rejects(validateFlow(flow,inventory.entries[0],inventory),/mensaje Mermaid/);
  await assert.rejects(validateMermaid('flowchart LR\nA --> ['),/Mermaid inválido/);
  await assert.rejects(validateMermaid('%%{init:{}}%%\nflowchart LR\nA-->B'),/Solo se admiten|configuración/);
});
test('rechaza cobertura incompleta y flujos duplicados',async t=>{
  const {inventory}=await fixture(t);await assert.rejects(validateAudit(inventory,[]),/incompleta/);const flow=validFlow(inventory);await assert.rejects(validateAudit(inventory,[flow,flow]),/duplicado/);
});
test('escapa puntuación de notas sin cambiar el texto ni la topología',async()=>{
  const source='sequenceDiagram\nparticipant A\nparticipant B\nA->>B: Consulta; espera\nNote over A,B: Texto; más detalle\n';
  const escaped=escapeSequenceLabels(source);assert.match(escaped,/Consulta#59; espera/);assert.match(escaped,/Texto#59; más detalle/);assert.equal(escapeSequenceLabels(escaped),escaped);await validateMermaid(escaped);
});
test('un contrato sin implementación candidata no se presenta como código auditado',async t=>{
  const {inventory}=await fixture(t);const entry={...inventory.entries[0],handlerCandidates:[]};
  await assert.rejects(validateFlow(validFlow(inventory),entry,inventory),/No hay implementación/);
});
