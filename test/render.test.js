import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fixture } from './helpers.js';
import { discover } from '../src/discovery.js';
import { dependencyKey } from '../src/render.js';

test('un mismo cliente probado no se duplica por texto distinto entre endpoints',async t=>{
  const {repo}=await fixture(t);const file='src/main/java/Client.java';
  await fs.writeFile(path.join(repo,file),'@RegisterRestClient(configKey="inventory") public interface Client {}');
  const inventory=await discover(repo),flow={evidence:[{id:'client',file}]};
  const first=await dependencyKey(inventory,flow,{kind:'api',technology:'HTTP',target:'GET /items',evidenceIds:['client']});
  const second=await dependencyKey(inventory,flow,{kind:'api',technology:'REST reactivo',target:'POST /items',evidenceIds:['client']});
  assert.equal(first,second);assert.equal(first,'api:rest-client:inventory');
});
test('clientes distintos de igual tecnología conservan identidades separadas',async t=>{
  const {repo}=await fixture(t);const one='src/main/java/One.java',two='src/main/java/Two.java';
  await fs.writeFile(path.join(repo,one),'@RegisterRestClient(configKey="one") public interface One {}');
  await fs.writeFile(path.join(repo,two),'@RegisterRestClient(configKey="two") public interface Two {}');
  const inventory=await discover(repo),flow={evidence:[{id:'one',file:one},{id:'two',file:two}]};
  const first=await dependencyKey(inventory,flow,{kind:'api',technology:'HTTP',target:'GET /items',evidenceIds:['one']});
  const second=await dependencyKey(inventory,flow,{kind:'api',technology:'HTTP',target:'GET /items',evidenceIds:['two']});
  assert.notEqual(first,second);
});
test('un WebTarget construido una sola vez conserva identidad entre operaciones',async t=>{
  const {repo}=await fixture(t),file='src/main/java/Remote.java';
  await fs.writeFile(path.join(repo,file),'public class Remote { public Remote(){ this.target = ClientBuilder.newClient().target(config.url()); } }');
  const inventory=await discover(repo),flow={evidence:[{id:'client',file}]};
  const one=await dependencyKey(inventory,flow,{kind:'api',technology:'HTTP',target:'/hello',evidenceIds:['client']});
  const two=await dependencyKey(inventory,flow,{kind:'api',technology:'JAX-RS',target:'/random',evidenceIds:['client']});
  assert.equal(one,two);assert.equal(one,'api:jaxrs-target:'+file);
});
