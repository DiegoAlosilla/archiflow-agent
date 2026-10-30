import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fixture,validFlow,java } from './helpers.js';
import { runAudit,loadValidatedRun } from '../src/runner.js';
import { readJson,lockRun } from '../src/io.js';

test('genera entregables, valida y reanuda sin volver a invocar el motor',async t=>{
  const {repo,out}=await fixture(t);let calls=0;
  const engine=async({inventory})=>{calls++;return {result:{flows:[validFlow(inventory)]},engine:{name:'test'}};};
  const result=await runAudit({repo,out},engine);assert.equal(result.coverage.complete,true);assert.equal(calls,1);
  for(const file of ['architecture.mmd','architecture.drawio','report.md','coverage.csv','evidence.csv','state.json'])assert.ok((await fs.stat(path.join(out,file))).size>0);
  await loadValidatedRun(out);await runAudit({repo,out,resume:true},engine);assert.equal(calls,1);
});
test('reanudar falla si cambió el repositorio',async t=>{
  const {repo,out}=await fixture(t);await runAudit({repo,out},async({inventory})=>({result:{flows:[validFlow(inventory)]}}));
  await fs.appendFile(path.join(repo,'src/main/java/Resource.java'),'\n// changed');await assert.rejects(runAudit({repo,out,resume:true}),/cambiaron/);await assert.rejects(loadValidatedRun(out),/cambiaron/);
});
test('una edición manual del diagrama invalida la publicación auditada',async t=>{
  const {repo,out}=await fixture(t);await runAudit({repo,out},async({inventory})=>({result:{flows:[validFlow(inventory)]}}));
  await fs.appendFile(path.join(out,'architecture.mmd'),'\nAPI-->Unexpected\n');await assert.rejects(loadValidatedRun(out),/Diagrama modificado/);
});
test('acota correcciones de evidencia y conserva errores sin publicar',async t=>{
  const {repo,out}=await fixture(t);let calls=0;
  const result=await runAudit({repo,out},async({inventory})=>{calls++;const flow=validFlow(inventory);flow.evidence[0].quote='not in source';return {result:{flows:[flow]}};});
  assert.equal(calls,2);assert.equal(result.coverage.complete,false);const state=await readJson(path.join(out,'state.json'));assert.equal(state.tasks[0].status,'failed');await assert.rejects(loadValidatedRun(out),/incompleta/);
});
test('evita resultados dentro del objetivo y ejecuciones simultáneas',async t=>{
  const {repo,out}=await fixture(t);await assert.rejects(runAudit({repo,out:path.join(repo,'out')}),/separado/);
  const unlock=await lockRun(out);await assert.rejects(runAudit({repo,out}),/ocupada/);await unlock();
});
test('no escribe resultados en un enlace/junction que apunta al objetivo',async t=>{
  const {repo,temp}=await fixture(t);const link=path.join(temp,'linked-output');
  try{await fs.symlink(repo,link,process.platform==='win32'?'junction':'dir');}catch(error){if(error.code==='EPERM'){t.skip('El sistema no permite enlaces');return;}throw error;}
  await assert.rejects(runAudit({repo,out:path.join(link,'results')}),/separado/);
  await assert.rejects(fs.access(path.join(repo,'results')));
});
test('un fallo del motor no se reintenta automáticamente y admite resume',async t=>{
  const {repo,out}=await fixture(t);let calls=0;
  const partial=await runAudit({repo,out},async()=>{calls++;throw new Error('auth unavailable');});assert.equal(calls,1);assert.equal(partial.coverage.complete,false);
  const resumed=await runAudit({repo,out,resume:true},async({inventory})=>({result:{flows:[validFlow(inventory)]}}));assert.equal(resumed.coverage.complete,true);
});
test('continúa con otra entrada cuando un objetivo falla',async t=>{
  const {repo,out}=await fixture(t);await fs.writeFile(path.join(repo,'src/main/java/Other.java'),java.replace('class Resource','class Other').replace('/orders','/second'));
  let calls=0;
  const result=await runAudit({repo,out,batchSize:1},async({inventory,entries})=>{
    calls++;if(entries[0].route==='/orders/{id}')throw new Error('No disponible para esta entrada');
    const flow=validFlow(inventory,entries[0]);flow.handler='Other.get';flow.evidence[0].file='src/main/java/Other.java';return {result:{flows:[flow]}};
  });
  assert.equal(calls,2);assert.equal(result.coverage.analyzed,1);assert.equal(result.coverage.complete,false);
});
test('una entrada bloqueada queda documentada y deshabilita publicación',async t=>{
  const {repo,out}=await fixture(t);
  const result=await runAudit({repo,out},async({inventory})=>{
    const flow=validFlow(inventory);flow.status='blocked';flow.dependencies=[];flow.steps=[];flow.sequenceMermaid='';flow.limits=['No se dispone de la implementación del adaptador remoto.'];return {result:{flows:[flow]}};
  });
  assert.equal(result.coverage.blocked.length,1);await assert.rejects(loadValidatedRun(out),/bloqueadas/);
});
