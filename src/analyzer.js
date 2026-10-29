'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const ts = require('typescript');
const { createTranslator } = require('../media/i18n');
const { collectReferences, exportKinds } = require('./references');
const SOURCE = /\.(?:[cm]?[jt]sx?)$/i;
const HIDDEN = new Set(['.git', '.svn', '.hg', '.codex', '.next', 'dist', 'build', 'coverage']);
const LIMIT = 3000;
function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function secret(name) { return /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name); }
function packageName(specifier) { return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]; }
async function analyze(root, directory, showLibraries, showDetails = false, language = 'ko') {
  const t = createTranslator(language);
  root = await fs.realpath(root);
  directory = await fs.realpath(directory);
  if (!inside(root, directory)) throw new Error(t('outside'));
  let examined = 0;
  let truncated = false;
  const files = [];
  const nodes = [];
  const warnings = [];
  const entries = (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const item of entries) {
    if (item.isSymbolicLink() || HIDDEN.has(item.name) || secret(item.name)) continue;
    if (item.name === 'node_modules' && !showLibraries) continue;
    if (nodes.length >= 400) { truncated = true; break; }
    const target = path.join(directory, item.name);
    if (!item.isDirectory() && !item.isFile()) continue;
    const stat = await fs.stat(target);
    nodes.push({ id: target, name: item.name, kind: item.isDirectory() ? 'directory' : 'file', bytes: stat.size });
  }
  async function walk(dir) {
    let children;
    try { children = await fs.readdir(dir, { withFileTypes: true }); }
    catch { warnings.push(t('folderWarning')); return; }
    for (const item of children) {
      if (++examined > LIMIT) { truncated = true; return; }
      if (item.isSymbolicLink() || HIDDEN.has(item.name) || item.name === 'node_modules' || secret(item.name)) continue;
      const target = path.join(dir, item.name);
      if (item.isDirectory()) await walk(target);
      else if (item.isFile() && SOURCE.test(item.name)) files.push(target);
    }
  }
  // Library internals are scanned only after explicit directory navigation.
  await walk(directory);
  let options = { allowJs: true, jsx: ts.JsxEmit.Preserve, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, resolveJsonModule: true };
  let configDir = directory;
  while (inside(root, configDir)) {
    const tsconfig = path.join(configDir, 'tsconfig.json');
    const jsconfig = path.join(configDir, 'jsconfig.json');
    const config = ts.sys.fileExists(tsconfig) ? tsconfig : ts.sys.fileExists(jsconfig) ? jsconfig : null;
    if (config) {
      const read = ts.readConfigFile(config, ts.sys.readFile);
      if (!read.error) {
        const converted = ts.convertCompilerOptionsFromJson(read.config.compilerOptions || {}, configDir);
        options = { ...options, ...converted.options };
        if (read.config.extends) warnings.push(t('extendsWarning'));
      }
      break;
    }
    if (configDir === root) break;
    configDir = path.dirname(configDir);
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  function visible(file) {
    if (!inside(directory, file)) return null;
    const first = path.relative(directory, file).split(path.sep)[0];
    const id = path.join(directory, first);
    return byId.has(id) ? id : null;
  }
  const edgeMap = new Map();
  function connect(source, target, relation, references = []) {
    if (!source || !target || source === target) return;
    const key = JSON.stringify([source, target, relation]);
    const edge = edgeMap.get(key) || { source, target, relation, count: 0, symbols: [] };
    edge.count++;
    const remaining = 200 - edge.symbols.length;
    edge.symbols.push(...references.slice(0, remaining));
    if (references.length > remaining) edge.symbolsTruncated = true;
    edgeMap.set(key, edge);
  }
  async function endpoint(file) {
    const parent = visible(file);
    if (!parent || !showDetails || parent === file) return parent;
    const parts = path.relative(directory, file).split(path.sep);
    if (parts.some(part => HIDDEN.has(part) || secret(part) || (!showLibraries && part === 'node_modules'))) return null;
    if (byId.has(file)) return file;
    if (nodes.length >= 500) { truncated = true; return null; }
    try {
      const real = await fs.realpath(file);
      if (real !== file || !inside(root, real)) return null;
      const stat = await fs.stat(real);
      if (!stat.isFile()) return null;
      const node = { id: file, name: path.basename(file), relativePath: path.relative(directory, file), parentId: parent, kind: 'file', bytes: stat.size };
      nodes.push(node); byId.set(file, node);
      connect(parent, file, 'contains');
      return file;
    } catch { return null; }
  }
  const cache = ts.createModuleResolutionCache(directory, x => x, options);
  const kindsByFile = new Map();
  for (const file of files) {
    const source = await endpoint(file);
    if (!source) continue;
    let stat;
    try { stat = await fs.stat(file); } catch { continue; }
    if (stat.size > 512 * 1024) { warnings.push(t('largeWarning')); continue; }
    let text;
    try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    kindsByFile.set(file, exportKinds(ast));
    for (const [specifier, bindings] of collectReferences(ast)) {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys, cache).resolvedModule;
      const external = resolved && (resolved.isExternalLibraryImport || resolved.resolvedFileName.includes(`${path.sep}node_modules${path.sep}`));
      let target = resolved && !external && await endpoint(resolved.resolvedFileName);
      // Asset imports are also represented when TypeScript cannot resolve them.
      if (!target && specifier.startsWith('.')) {
        const candidate = path.resolve(path.dirname(file), specifier);
        if (!secret(path.basename(candidate)) && ts.sys.fileExists(candidate)) target = await endpoint(candidate);
      }
      const references = bindings.map(binding => ({ ...binding, file: path.relative(directory, file), specifier, targetFile: resolved?.resolvedFileName }));
      if (target) connect(source, target, 'import', references);
      else if (showLibraries && !specifier.startsWith('.') && !specifier.startsWith('/') && (!resolved || resolved.isExternalLibraryImport || resolved.resolvedFileName.includes(`${path.sep}node_modules${path.sep}`))) {
        const name = packageName(specifier);
        const id = 'package:' + name;
        if (!byId.has(id) && nodes.length < 500) {
          const node = { id, name, kind: 'package' };
          nodes.push(node); byId.set(id, node);
        }
        if (byId.has(id)) connect(source, id, 'library', references);
      }
    }
  }
  for (const edge of edgeMap.values()) for (const symbol of edge.symbols) {
    symbol.kind = symbol.typeOnly ? 'type' : kindsByFile.get(symbol.targetFile)?.get(symbol.imported) || 'symbol';
    delete symbol.targetFile;
  }
  return { root, directory, nodes, edges: [...edgeMap.values()], truncated, analyzedFiles: files.length, warnings: [...new Set(warnings)] };
}
module.exports = { analyze, inside, secret };
