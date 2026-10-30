import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema,CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
const server=new Server({name:'archiflow-test-server',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[
  {name:'get_drawio_reference',inputSchema:{type:'object',properties:{format:{type:'string',enum:['mermaid','xml']}},required:['format'],additionalProperties:false}},
  ...(process.argv.includes('--xml')?[{name:'open_drawio_xml',inputSchema:{type:'object',properties:{content:{type:'string'}},required:['content'],additionalProperties:false}}]:[]),
  {name:'open_drawio_mermaid',inputSchema:{type:'object',properties:{content:{type:'string'}},required:['content'],additionalProperties:false}}
]}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
  if(request.params.name==='get_drawio_reference')return {content:[{type:'text',text:'Mermaid reference'}]};
  if(process.argv.includes('--fail'))return {isError:true,content:[{type:'text',text:'Publication failed intentionally'}]};
  return {content:[{type:'text',text:'Draw.io Editor URL:\nhttps://example.com/diagram#test'}]};
});
await server.connect(new StdioServerTransport());
