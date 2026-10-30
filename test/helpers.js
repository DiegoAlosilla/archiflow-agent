import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discover } from '../src/discovery.js';
import { inside } from '../src/io.js';

export const java=`package demo;
import jakarta.ws.rs.*;
@Path("/orders")
public class Resource {
  @GET
  @Path("/{id}")
  public String get() {
    return store.find();
  }
}
`;
export async function fixture(t){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'archiflow-test-'));
  const repo=path.join(temp,'repo');await fs.mkdir(path.join(repo,'src/main/java'),{recursive:true});
  await fs.writeFile(path.join(repo,'src/main/java/Resource.java'),java);
  t.after(async()=>{if(!inside(os.tmpdir(),temp))throw new Error('Invalid test cleanup');await fs.rm(temp,{recursive:true,force:true});});
  return {temp,repo,out:path.join(temp,'run'),inventory:await discover(repo)};
}
export function validFlow(inventory,entry=inventory.entries[0]){
  return {entryId:entry.id,status:'analyzed',summary:'Obtiene un pedido del almacenamiento.',handler:'Resource.get',evidence:[{id:'e1',file:'src/main/java/Resource.java',startLine:7,endLine:9,quote:'return store.find();',claim:'El handler consulta el almacenamiento.',status:'code'}],dependencies:[{id:'store',label:'Almacenamiento',kind:'database',technology:'No resuelta',target:'store.find',evidenceIds:['e1']}],steps:[{id:'s1',dependencyId:'store',operation:'Buscar pedido',mode:'sync',condition:'',evidenceIds:['e1']}],branches:[],errors:[],limits:['Tipo de almacenamiento no resuelto; el ejemplo solo prueba la referencia local.'],sequenceMermaid:'sequenceDiagram\n    autonumber\n    participant C as Cliente\n    participant API as API\n    participant store as Almacenamiento\n    C->>API: GET /orders/{id}\n    %% step:s1\n    API->>store: Buscar pedido\n    store-->>API: Resultado\n    API-->>C: Respuesta'};
}
