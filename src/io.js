import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const projectRoot = path.resolve(import.meta.dirname, '..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const slash = value => value.replaceAll('\\', '/');
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, data, 'utf8');
  try { await fs.rename(temp, file); } catch (error) { await fs.rm(temp, { force: true }); throw error; }
}
export const writeJson = (file, data) => atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`);
export function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}
export async function sourcePath(root, relative) {
  if (path.isAbsolute(relative) || relative.includes('\\')) throw new Error(`Ruta fuente inválida: ${relative}`);
  const actual = await fs.realpath(path.resolve(root, relative));
  if (!inside(await fs.realpath(root), actual)) throw new Error(`La evidencia sale del repositorio: ${relative}`);
  return actual;
}
export async function canonicalTarget(target) {
  let current=path.resolve(target);
  const suffix=[];
  while(true) {
    try{return path.join(await fs.realpath(current),...suffix.reverse());}
    catch(error){
      if(error.code!=='ENOENT')throw error;
      const parent=path.dirname(current);
      if(parent===current)throw error;
      suffix.push(path.basename(current));current=parent;
    }
  }
}
export async function lockRun(dir) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, '.lock');
  let handle;
  try { handle = await fs.open(file, 'wx'); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Ejecución ocupada: ${file}. Si el proceso murió, comprueba su PID y retira solo ese archivo.`);
    throw error;
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return async () => { await handle.close(); await fs.rm(file, { force: true }); };
}
export function csv(rows, keys) {
  const cell = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return `${[keys, ...rows.map(row => keys.map(k => row[k]))].map(row => row.map(cell).join(',')).join('\n')}\n`;
}
