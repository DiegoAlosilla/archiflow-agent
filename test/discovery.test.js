import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fixture } from './helpers.js';
import { discover,javaInventory,sourceBundle,contextFiles } from '../src/discovery.js';

test('CST compone rutas y no detecta endpoints en comentarios o strings',()=>{
  const data=javaInventory('@Path("/api") public class R { /* @POST */ @GET @Path("/x") public String hello(){return "@DELETE";} }','R.java');
  assert.deepEqual(data.entries.map(e=>[e.method,e.route]),[['GET','/api/x']]);
});
test('no convierte constantes o concatenaciones de rutas en paths inventados',()=>{
  for(const route of ['ROUTE','"/part" + SUFFIX']){
    const data=javaInventory(`@Path(${route}) public class R { @GET public String get(){ return "ok"; } }`,'R.java');
    assert.equal(data.entries.length,0);assert.match(data.warnings[0],/no resuelta/);
  }
  assert.equal(javaInventory('@Path(value="/ok") public class R { @GET public String get(){return "ok";} }','R.java').entries[0].route,'/ok');
});
test('excluye clientes REST y descubre consumidores/jobs',()=>{
  const client=javaInventory('@RegisterRestClient @Path("/remote") public interface C { @GET String get(); }','C.java');
  assert.equal(client.entries.length,0);
  const data=javaInventory('public class E { @Incoming("orders") public void consume(String m) {} @Scheduled(every="1h") public void job() {} }','E.java');
  assert.deepEqual(data.entries.map(e=>e.kind),['event','scheduled']);
});
test('OpenAPI descubre contrato generado y lo relaciona con implementación',async t=>{
  const {repo}=await fixture(t);await fs.writeFile(path.join(repo,'api.yml'),'openapi: 3.0.3\npaths:\n  /orders/{id}:\n    get:\n      operationId: get\n      responses: {}\n');
  const inventory=await discover(repo);assert.equal(inventory.entries.length,1);assert.equal(inventory.entries[0].sources.length,2);assert.equal(inventory.entries[0].handlerCandidates.length,1);
});
test('no mezcla verbos de una ruta y excluye tests',async t=>{
  const {repo}=await fixture(t);await fs.mkdir(path.join(repo,'src/test/java'),{recursive:true});await fs.writeFile(path.join(repo,'src/test/java/Fake.java'),'@Path("/fake") public class Fake { @GET public void x(){} }');
  await fs.writeFile(path.join(repo,'api.yml'),'openapi: 3.0.3\npaths:\n  /orders/{id}:\n    post:\n      operationId: create\n      responses: {}\n');
  const inventory=await discover(repo);assert.equal(inventory.entries.length,2);assert.ok(inventory.entries.every(e=>e.route==='/orders/{id}'));
});
test('contexto insuficiente falla sin truncar y cambios de fuentes se detectan',async t=>{
  const {repo,inventory}=await fixture(t);await assert.rejects(sourceBundle(inventory,10),/exceden/);
  await fs.appendFile(path.join(repo,'src/main/java/Resource.java'),'\n// changed');await assert.rejects(sourceBundle(inventory),/cambió/);
});
test('errores de Java quedan visibles en limitaciones',async t=>{
  const {repo}=await fixture(t);await fs.writeFile(path.join(repo,'src/main/java/Bad.java'),'this is not Java');
  const inventory=await discover(repo);assert.equal(inventory.warnings.length,1);assert.match(inventory.warnings[0],/Java no parseado/);
});
test('el modo core selecciona fuentes sin ocultar manifiestos del inventario',async t=>{
  const {repo}=await fixture(t);await fs.mkdir(path.join(repo,'deploy'),{recursive:true});await fs.writeFile(path.join(repo,'deploy/generated.yml'),'kind: Deployment\n');
  const inventory=await discover(repo);assert.ok(inventory.files.some(f=>f.path==='deploy/generated.yml'));
  assert.ok(!contextFiles(inventory,'core').some(f=>f.path==='deploy/generated.yml'));
  assert.ok((await sourceBundle(inventory,10000,'all')).includes('deploy/generated.yml'));
});
test('rutas de una interfaz REST se asocian con su implementación concreta',async t=>{
  const {repo}=await fixture(t);
  await fs.writeFile(path.join(repo,'src/main/java/Api.java'),'@Path("/contract") public interface Api { @GET String ping(); }');
  await fs.writeFile(path.join(repo,'src/main/java/Impl.java'),'public class Impl implements Api { public String ping(){return "ok";} }');
  const inventory=await discover(repo),entry=inventory.entries.find(e=>e.route==='/contract');
  assert.ok(entry);assert.equal(entry.handlerCandidates.length,1);assert.equal(entry.handlerCandidates[0].symbol,'Impl.ping');
});
