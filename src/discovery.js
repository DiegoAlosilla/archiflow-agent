import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'java-parser';
import { parseDocument, isMap, isScalar, LineCounter } from 'yaml';
import { hash, slash } from './io.js';

const execute = promisify(execFile);
const ignored = new Set(['.git', '.agents', '.agent', '.codex', '.idea', 'node_modules', 'target', 'build', 'dist', '.gradle', 'vendor']);
const verbs = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const extensions = new Set(['.java', '.properties', '.yaml', '.yml', '.xml', '.proto', '.avsc', '.sql', '.tf']);
export function descendants(node, name) {
  const found = [];
  function visit(value) {
    if (!value?.name) return;
    if (value.name === name) found.push(value);
    for (const children of Object.values(value.children ?? {})) for (const child of children) visit(child);
  }
  visit(node); return found;
}
const textOf = (source, node) => source.slice(node.location.startOffset, node.location.endOffset + 1);
const annotations = (source, modifiers) => (modifiers ?? []).flatMap(m => descendants(m, 'annotation')).map(a => textOf(source, a));
const annotationValue = (list, name) => {
  const annotation=list.find(a=>new RegExp(`^@(?:[\\w.]+\\.)?${name}\\b`).test(a));
  const literal=annotation?.match(/\(\s*(?:value\s*=\s*)?("(?:\\.|[^"\\])*")\s*\)/)?.[1];
  return literal===undefined?undefined:JSON.parse(literal);
};
const joinRoute = (...parts) => `/${parts.filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

export function javaInventory(source, file) {
  const cst = parse(source);
  const types = [...descendants(cst, 'classDeclaration'), ...descendants(cst, 'interfaceDeclaration')];
  const methods = [], entries = [], warnings = [];
  for (const type of types) {
    const normal = type.children.normalClassDeclaration?.[0] ?? type.children.normalInterfaceDeclaration?.[0];
    if (!normal) continue;
    const nameNode = descendants(normal, 'typeIdentifier')[0];
    const typeName = nameNode ? textOf(source, nameNode) : path.basename(file, '.java');
    const mods = annotations(source, type.children.classModifier ?? type.children.interfaceModifier);
    const outbound = mods.some(a => /@(?:[\w.]+\.)?RegisterRestClient\b/.test(a));
    const base = annotationValue(mods, 'Path');
    const bodyNode=normal.children.classBody?.[0]??normal.children.interfaceBody?.[0];
    const header=source.slice(normal.location.startOffset,bodyNode?.location.startOffset??normal.location.endOffset);
    const implemented=(header.match(/\bimplements\s+([^{}]+)/)?.[1]??'').split(',').map(x=>x.trim().replace(/<.*>/,'').split('.').at(-1)).filter(Boolean);
    for (const method of [...descendants(normal, 'methodDeclaration'),...descendants(normal,'interfaceMethodDeclaration')]) {
      // Nested classes are inventoried independently, not attributed to the outer class.
      const containing = types.filter(t => t.location.startOffset <= method.location.startOffset && t.location.endOffset >= method.location.endOffset).sort((a,b) => (a.location.endOffset-a.location.startOffset)-(b.location.endOffset-b.location.startOffset))[0];
      if (containing !== type) continue;
      const declarator = descendants(method, 'methodDeclarator')[0];
      if (!declarator) continue;
      const symbol = textOf(source, declarator).match(/^([\w$]+)\s*\(/)?.[1];
      if (!symbol) continue;
      const anns = annotations(source, method.children.methodModifier??method.children.interfaceMethodModifier);
      const isConcrete=Boolean(method.children.methodBody?.[0]?.children.block);
      methods.push({ file, typeName, symbol, startLine: method.location.startLine, endLine: method.location.endLine, annotations: anns, isConcrete, implemented });
      const http = anns.map(a => a.match(/^@(?:[\w.]+\.)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/)?.[1]).filter(Boolean);
      if (http.length && !outbound) {
        const unresolvedPath=(mods.some(a=>/^@(?:[\w.]+\.)?Path\b/.test(a))&&base===undefined)||(anns.some(a=>/^@(?:[\w.]+\.)?Path\b/.test(a))&&annotationValue(anns,'Path')===undefined);
        if(unresolvedPath){warnings.push(`${file}:${method.location.startLine}: ruta con constante/expresión no resuelta (${symbol}); no se inventó una ruta.`);continue;}
        if (base === undefined && !anns.some(a => /@(?:[\w.]+\.)?Path\b/.test(a))) warnings.push(`${file}:${method.location.startLine}: verbo REST sin ruta resuelta (${symbol})`);
        for (const methodName of http) entries.push({ kind: 'http', method: methodName, route: joinRoute(base, annotationValue(anns, 'Path')), operationId: symbol, symbol: `${typeName}.${symbol}`, file, startLine: method.location.startLine, endLine: method.location.endLine, discovery: 'java-cst' });
      }
      const incoming = annotationValue(anns, 'Incoming');
      if (incoming) entries.push({ kind: 'event', method: '', route: incoming, operationId: symbol, symbol: `${typeName}.${symbol}`, file, startLine: method.location.startLine, endLine: method.location.endLine, discovery: 'java-cst' });
      if (anns.some(a => /@(?:[\w.]+\.)?Scheduled\b/.test(a))) entries.push({ kind: 'scheduled', method: '', route: anns.find(a => /Scheduled/.test(a)), operationId: symbol, symbol: `${typeName}.${symbol}`, file, startLine: method.location.startLine, endLine: method.location.endLine, discovery: 'java-cst' });
    }
  }
  return { methods, entries, warnings };
}

function openApiEntries(source, file) {
  const counter = new LineCounter();
  const doc = parseDocument(source, { lineCounter: counter, uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors[0].message);
  if (!doc.get('openapi') && !doc.get('swagger')) return [];
  const paths = doc.get('paths', true);
  if (!isMap(paths)) return [];
  const result = [];
  for (const pair of paths.items) {
    if (!isScalar(pair.key) || !isMap(pair.value)) continue;
    for (const operation of pair.value.items) {
      const method = String(operation.key.value).toUpperCase();
      if (!verbs.has(method)) continue;
      const op = operation.value;
      const startLine = counter.linePos(operation.key.range[0]).line;
      const endLine = counter.linePos(Math.max(op.range[0], op.range[1] - 1)).line;
      result.push({ kind: 'http', method, route: String(pair.key.value), operationId: op.get?.('operationId') ?? '', symbol: '', file, startLine, endLine, discovery: 'openapi' });
    }
  }
  return result;
}

export async function discover(repo) {
  const root = await fs.realpath(repo);
  const files = [], omitted = [], warnings = [], allMethods = [], candidates = [];
  let bytes = 0;
  async function walk(dir) {
    for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, item.name), relative = slash(path.relative(root, absolute));
      if (item.isSymbolicLink()) { omitted.push(`${relative}: enlace simbólico`); continue; }
      if (item.isDirectory()) { if (!ignored.has(item.name) && !relative.includes('src/test')) await walk(absolute); continue; }
      if (!item.isFile() || !extensions.has(path.extname(item.name)) || /(?:secret|credential|password|token|kubeconfig)/i.test(item.name)) continue;
      const stat = await fs.stat(absolute);
      if (stat.size > 700_000) { omitted.push(`${relative}: excede 700 KB`); continue; }
      bytes += stat.size;
      if (bytes > 8_000_000) throw new Error('Alcance mayor que 8 MB de fuentes: selecciona el directorio de un microservicio.');
      const content = await fs.readFile(absolute, 'utf8');
      files.push({ path: relative, sha256: hash(content), bytes: stat.size, lines: content.split(/\r?\n/).length });
      if (item.name.endsWith('.java')) {
        try { const data=javaInventory(content, relative); allMethods.push(...data.methods); candidates.push(...data.entries); warnings.push(...data.warnings); }
        catch (error) { warnings.push(`${relative}: Java no parseado: ${error.message.slice(0,200)}`); }
      }
      if (/\.(yml|yaml)$/.test(item.name) && /(?:^|\n)(?:openapi|swagger)\s*:/.test(content)) {
        try { candidates.push(...openApiEntries(content, relative)); } catch (error) { warnings.push(`${relative}: OpenAPI no parseado: ${error.message.slice(0,200)}`); }
      }
    }
  }
  await walk(root);
  const merged = new Map();
  for (const entry of candidates) {
    const key = `${entry.kind}:${entry.method}:${entry.route}`;
    const previous = merged.get(key);
    if (!previous) merged.set(key, { ...entry, id: `entry_${hash(key).slice(0,12)}`, sources: [{ file: entry.file, startLine: entry.startLine, endLine: entry.endLine, discovery: entry.discovery }] });
    else previous.sources.push({ file: entry.file, startLine: entry.startLine, endLine: entry.endLine, discovery: entry.discovery });
  }
  const entries = [...merged.values()].sort((a,b)=>`${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));
  for (const entry of entries) {
    const direct=allMethods.filter(m=>entry.sources.some(s=>s.discovery==='java-cst'&&s.file===m.file&&s.startLine===m.startLine));
    const concrete=direct.filter(m=>m.isConcrete);
    const matches = concrete.length?concrete:allMethods.filter(m=>m.isConcrete&&m.symbol===entry.operationId&&!/client/i.test(m.file)&&(!direct.length||direct.some(d=>m.implemented.includes(d.typeName))));
    entry.handlerCandidates = matches.map(m=>({file:m.file,startLine:m.startLine,endLine:m.endLine,symbol:`${m.typeName}.${m.symbol}`}));
    if (entry.discovery==='openapi' && matches.length===1) entry.symbol=matches[0].typeName+'.'+matches[0].symbol;
  }
  let git = { revision: null, dirty: null };
  try { const {stdout}=await execute('git',['-C',root,'rev-parse','HEAD']); const status=await execute('git',['-C',root,'status','--porcelain','--untracked-files=no']); git={revision:stdout.trim(),dirty:Boolean(status.stdout.trim())}; } catch { /* A directory without Git is supported. */ }
  const fingerprint=hash(JSON.stringify(files.map(f=>[f.path,f.sha256])));
  const limitations=['Análisis estático: no demuestra ejecución real ni todas las combinaciones de ramas.','Descubrimiento inicial Java/Jakarta REST con rutas literales, Incoming/Scheduled y OpenAPI local; rutas dinámicas, constantes de ruta, subresource locators y herencia compleja requieren revisión.','Clientes RegisterRestClient se excluyen del inventario de entradas; sus rutas se conservan en fuentes.','No se ejecutan builds: las interfaces generadas pueden faltar; operationId aporta candidatos, no confirmación.','No se incluyen tests, directorios de build, archivos de credenciales ni enlaces simbólicos.'];
  return { root, service: path.basename(root), createdAt: new Date().toISOString(), git, fingerprint, files, entries, warnings, omitted, limitations };
}

export function contextFiles(inventory,scope='all') {
  if(!['all','core'].includes(scope))throw new Error('context-scope debe ser core o all.');
  return inventory.files.filter(f=>scope==='all'||f.path.startsWith('src/main/')||/^(?:pom\.xml|build\.gradle(?:\.kts)?|gradle\.properties|application\.(?:properties|ya?ml))$/.test(f.path));
}
export async function sourceBundle(inventory, maxChars=430_000,scope='all') {
  const chunks=[]; let total=0;
  // Business code first, then configuration/contracts. Never silently truncate.
  const files=contextFiles(inventory,scope).sort((a,b)=>Number(!a.path.endsWith('.java'))-Number(!b.path.endsWith('.java')) || a.path.localeCompare(b.path));
  for(const file of files) {
    const content=await fs.readFile(path.join(inventory.root,file.path),'utf8');
    if(hash(content)!==file.sha256) throw new Error(`Fuente cambió durante la auditoría: ${file.path}`);
    const chunk=`\n<source path=${JSON.stringify(file.path)}>\n${content.split(/\r?\n/).map((line,i)=>`${i+1}|${line}`).join('\n')}\n</source>\n`;
    total+=chunk.length;
    if(total>maxChars) throw new Error(`Fuentes exceden el contexto configurado (${maxChars} caracteres). Reduce el alcance o aumenta --max-context explícitamente.`);
    chunks.push(chunk);
  }
  return chunks.join('');
}
