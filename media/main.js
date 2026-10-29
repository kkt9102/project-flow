'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
let graph;
let selected;
let selectedEdge;
const geometry = window.FlowGeometry;
const t = window.FlowI18n.createTranslator(document.documentElement.lang);
let scale = 1;
let offset = { x: 64, y: 64 };
const positions = new Map();
const cards = new Map();
const lines = [];
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function svg(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}
// Original SVG paths, distributed under this project's MIT license.
function icon(node) {
  const image = svg('svg', { viewBox: '0 0 32 32', width: 36, height: 36, 'aria-hidden': 'true' });
  if (node.kind === 'directory') image.append(svg('path', { d: 'M3 8 Q3 5 6 5 H13 L16 9 H26 Q29 9 29 12 V25 Q29 28 26 28 H6 Q3 28 3 25 Z', fill: '#e8b967' }), svg('path', { d: 'M3 13 H29 V25 Q29 28 26 28 H6 Q3 28 3 25 Z', fill: '#f4ce85' }));
  else if (node.kind === 'package') image.append(svg('path', { d: 'M16 2 L29 9 V23 L16 30 L3 23 V9 Z M3 9 L16 16 L29 9 M16 16 V30 M9 5 L22 12', fill: 'none', stroke: '#bd9df6', 'stroke-width': 2 }));
  else {
    image.append(svg('path', { d: 'M7 3 H20 L27 10 V27 Q27 29 25 29 H7 Q5 29 5 27 V5 Q5 3 7 3 Z', fill: '#263746', stroke: '#78b9e9', 'stroke-width': 1.5 }), svg('path', { d: 'M20 3 V10 H27', fill: 'none', stroke: '#78b9e9', 'stroke-width': 1.5 }));
    const ext = node.name.split('.').pop().toLowerCase();
    const label = svg('text', { x: 16, y: 23, 'text-anchor': 'middle', fill: ['ts', 'tsx'].includes(ext) ? '#7cc8ff' : ['js', 'jsx'].includes(ext) ? '#f1da79' : '#bed0e0', 'font-size': 9, 'font-family': 'sans-serif', 'font-weight': 700 });
    label.textContent = ext.length <= 4 ? ext.toUpperCase() : 'FILE'; image.append(label);
  }
  return image;
}
function transform() {
  $('world').style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
  $('scale').textContent = Math.round(scale * 100) + '%';
}
function positionCard(id) {
  const point = positions.get(id);
  cards.get(id).style.transform = `translate(${point.x}px, ${point.y}px)`;
}
function drawLines() {
  for (const { edge, path: line, hit } of lines) {
    const a = positions.get(edge.source), b = positions.get(edge.target);
    const route = geometry.route(a, b, [...positions.values()]);
    line.setAttribute('d', route); hit.setAttribute('d', route);
  }
}
function highlight() {
  const search = $('search').value.trim().toLowerCase();
  const neighbors = new Set([selected]);
  if (selectedEdge) { neighbors.add(selectedEdge.source); neighbors.add(selectedEdge.target); }
  graph?.edges.forEach(e => { if (e.source === selected || e.target === selected) { neighbors.add(e.source); neighbors.add(e.target); } });
  // Selecting a folder also highlights imports of its displayed descendants.
  const children = new Set(graph?.nodes.filter(n => n.parentId === selected).map(n => n.id));
  children.forEach(id => neighbors.add(id));
  graph?.edges.forEach(e => { if (children.has(e.source) || children.has(e.target)) { neighbors.add(e.source); neighbors.add(e.target); } });
  for (const node of graph?.nodes || []) {
    const card = cards.get(node.id);
    card.classList.toggle('selected', selected === node.id);
    card.classList.toggle('dim', Boolean(((selected || selectedEdge) && !neighbors.has(node.id)) || (search && !node.name.toLowerCase().includes(search))));
  }
  for (const { edge, path } of lines) {
    const related = selectedEdge ? edge === selectedEdge : edge.source === selected || edge.target === selected || children.has(edge.source) || children.has(edge.target);
    path.classList.toggle('dim', Boolean((selected || selectedEdge) && !related));
    path.classList.toggle('active', related);
  }
}
function closeEdge() { selectedEdge = null; $('edge-panel').hidden = true; highlight(); }
function showEdge(edge) {
  selected = null; selectedEdge = edge;
  $('edge-panel').hidden = false;
  const name = id => graph.nodes.find(n => n.id === id)?.relativePath || graph.nodes.find(n => n.id === id)?.name || id;
  $('edge-summary').textContent = `${name(edge.source)} → ${name(edge.target)}`;
  const list = $('edge-symbols'); list.replaceChildren();
  if (edge.relation === 'contains') list.append(element('p', 'edge-note', t('containsNote')));
  else {
    const labels = { function: t('function'), variable: t('variable'), class: t('class'), interface: t('interface'), type: t('type'), enum: t('enum'), symbol: t('symbol') };
    for (const symbol of edge.symbols || []) {
      const row = element('div', 'symbol-row');
      const kind = symbol.syntax === 'side-effect' ? t('moduleLoad') : symbol.imported === '*' ? t('wholeModule') : labels[symbol.kind] || t('symbol');
      row.append(element('span', 'symbol-kind', kind));
      const title = symbol.syntax === 'side-effect' ? symbol.specifier : symbol.imported === 'default' ? `${symbol.local || 'default'} (default)` : symbol.imported + (symbol.local && symbol.local !== symbol.imported ? ` → ${symbol.local}` : '');
      row.append(element('strong', '', title));
      row.append(element('span', 'symbol-location', `${symbol.file}:${symbol.line} · ${symbol.syntax}${symbol.typeOnly ? ' · type-only' : ''}`));
      list.append(row);
    }
    if (!edge.symbols?.length) list.append(element('p', 'edge-note', t('noSymbols')));
    if (edge.symbolsTruncated) list.append(element('p', 'edge-note', t('symbolLimit')));
    list.append(element('p', 'edge-note', t('symbolNote')));
  }
  highlight();
}
function fit() {
  if (!graph?.nodes.length) return;
  const points = graph.nodes.map(n => positions.get(n.id));
  const maxX = Math.max(...points.map(p => p.x)) + 220;
  const maxY = Math.max(...points.map(p => p.y)) + 120;
  scale = Math.min(1.2, Math.max(.15, Math.min(($('viewport').clientWidth - 120) / maxX, ($('viewport').clientHeight - 100) / maxY)));
  offset = { x: 60, y: 45 }; transform();
}
function render(data) {
  const previous = graph;
  const layoutChanged = previous?.directory !== data.directory || previous?.nodes.map(n => n.id).join('\n') !== data.nodes.map(n => n.id).join('\n');
  graph = data; selected = null; selectedEdge = null; $('edge-panel').hidden = true;
  $('nodes').replaceChildren(); $('connections').replaceChildren(); cards.clear(); lines.length = 0;
  if (layoutChanged) positions.clear();
  const defs = svg('defs', {});
  for (const [id, color] of [['arrow', '#75bd9d'], ['library-arrow', '#ae8be9'], ['contains-arrow', '#d9b67c']]) {
    const marker = svg('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(svg('path', { d: 'M0 0 L10 5 L0 10 Z', fill: color })); defs.append(marker);
  }
  $('connections').append(defs);
  const degrees = new Map(data.nodes.map(n => [n.id, 0]));
  data.edges.forEach(e => { degrees.set(e.source, degrees.get(e.source) + 1); degrees.set(e.target, degrees.get(e.target) + 1); });
  const sorted = [...data.nodes].sort((a, b) => degrees.get(b.id) - degrees.get(a.id));
  const rows = Math.max(3, Math.ceil(Math.sqrt(sorted.length)));
  sorted.forEach((node, index) => {
    if (!positions.has(node.id)) positions.set(node.id, { x: Math.floor(index / rows) * geometry.GAP_X, y: (index % rows) * geometry.GAP_Y + (Math.floor(index / rows) % 2) * 70 });
    const card = element('button', 'node ' + node.kind);
    card.dataset.id = node.id;
    card.title = node.kind === 'package' ? `${node.name} · ${t('packageReference')}` : `${node.id}\n${t('doubleClick')}`;
    const heading = element('div', 'node-heading'); heading.append(icon(node), element('strong', '', node.name)); card.append(heading);
    const details = element('div', 'details');
    if (node.relativePath) details.append(element('span', 'file-path', node.relativePath));
    const bytes = node.bytes || 0;
    details.append(element('span', '', node.kind === 'directory' ? t('openDirectory') : node.kind === 'package' ? t('package') : `${bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB'} · ${t('connections', { count: degrees.get(node.id) })}`));
    card.append(details); cards.set(node.id, card); $('nodes').append(card); positionCard(node.id);
    if (node.kind === 'directory') {
      const children = data.nodes.filter(n => n.parentId === node.id);
      for (const child of children.slice(0, 3)) details.append(element('span', 'child-name', child.name));
      if (children.length > 3) details.append(element('span', 'child-name', t('more', { count: children.length - 3 })));
    }
    card.addEventListener('click', () => { selectedEdge = null; $('edge-panel').hidden = true; selected = selected === node.id ? null : node.id; highlight(); });
    const open = () => {
      if (node.kind === 'package') return;
      vscode.postMessage({ type: node.kind === 'directory' ? 'navigate' : 'open', path: node.id });
    };
    card.addEventListener('dblclick', open);
    card.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); open(); } });
    card.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const start = { x: event.clientX, y: event.clientY, ...positions.get(node.id) };
      // Save screen coordinates separately from graph coordinates.
      const sx = event.clientX, sy = event.clientY;
      card.setPointerCapture(event.pointerId);
      const move = e => { positions.set(node.id, { x: Math.max(0, start.x + (e.clientX - sx) / scale), y: Math.max(0, start.y + (e.clientY - sy) / scale) }); positionCard(node.id); drawLines(); };
      const up = () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up); };
      card.addEventListener('pointermove', move); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
    });
  });
  for (const edge of data.edges) {
    const label = t('edgeLabel', { source: data.nodes.find(n => n.id === edge.source)?.name, target: data.nodes.find(n => n.id === edge.target)?.name });
    const group = svg('g', { class: 'edge', role: 'button', tabindex: 0, 'aria-label': label });
    const line = svg('path', { class: 'connection ' + edge.relation, 'marker-end': `url(#${edge.relation === 'contains' ? 'contains-arrow' : edge.relation === 'library' ? 'library-arrow' : 'arrow'})` });
    const hit = svg('path', { class: 'edge-hit' });
    const title = svg('title', {}); title.textContent = edge.relation === 'contains' ? t('containsTitle') : t('referenceCount', { count: edge.count }); line.append(title);
    group.append(hit, line); $('connections').append(group); lines.push({ edge, path: line, hit });
    group.addEventListener('pointerdown', event => event.stopPropagation());
    group.addEventListener('click', event => { event.stopPropagation(); showEdge(edge); });
    group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showEdge(edge); } });
  }
  drawLines();
  const relative = data.directory.slice(data.root.length).split(/[\\/]/).filter(Boolean);
  $('breadcrumbs').replaceChildren();
  const rootName = data.root.split(/[\\/]/).pop();
  let current = data.root;
  [rootName, ...relative].forEach((name, index) => {
    if (index) { current += (data.root.includes('\\') ? '\\' : '/') + name; $('breadcrumbs').append(element('span', 'separator', '/')); }
    const target = current;
    const button = element('button', 'crumb', name); button.addEventListener('click', () => vscode.postMessage({ type: 'navigate', path: target })); $('breadcrumbs').append(button);
  });
  $('empty').hidden = data.nodes.length !== 0;
  $('empty').textContent = t('empty');
  const fileCount = data.nodes.filter(node => node.kind === 'file').length;
  const directoryCount = data.nodes.filter(node => node.kind === 'directory').length;
  const packageCount = data.nodes.filter(node => node.kind === 'package').length;
  $('status').textContent = t('status', { files: fileCount, directories: directoryCount }) + (packageCount ? t('packageCount', { count: packageCount }) : '') + t('analysisCount', { edges: data.edges.length, files: data.analyzedFiles }) + (data.truncated ? t('limit') : '') + (data.warnings.length ? ' · ' + data.warnings.join(' ') : '');
  if (layoutChanged) { scale = 1; offset = { x: 64, y: 50 }; transform(); }
  highlight();
}
let pan;
$('viewport').addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest('button')) return;
  pan = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  $('viewport').setPointerCapture(event.pointerId);
  selected = null; closeEdge();
});
$('viewport').addEventListener('pointermove', event => { if (pan) { offset = { x: pan.ox + event.clientX - pan.x, y: pan.oy + event.clientY - pan.y }; transform(); } });
for (const type of ['pointerup', 'pointercancel']) $('viewport').addEventListener(type, () => { pan = null; });
function zoom(factor, x = $('viewport').clientWidth / 2, y = $('viewport').clientHeight / 2) {
  const next = Math.max(.15, Math.min(2.5, scale * factor));
  offset = { x: x - (x - offset.x) * next / scale, y: y - (y - offset.y) * next / scale }; scale = next; transform();
}
$('viewport').addEventListener('wheel', event => { event.preventDefault(); const rect = $('viewport').getBoundingClientRect(); zoom(event.deltaY > 0 ? .9 : 1.1, event.clientX - rect.left, event.clientY - rect.top); }, { passive: false });
$('minus').onclick = () => zoom(.8); $('plus').onclick = () => zoom(1.25); $('fit').onclick = fit;
$('close-edge').onclick = closeEdge;
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeEdge(); });
$('search').addEventListener('input', highlight);
$('refresh').onclick = () => vscode.postMessage({ type: 'refresh' });
const saved = vscode.getState() || {};
$('libraries').checked = saved.libraries === true;
$('details').checked = saved.details !== false;
function saveOptions() { vscode.setState({ libraries: $('libraries').checked, details: $('details').checked }); }
function toggle() { const value = $('libraries').checked; $('toggle-label').textContent = value ? 'ON' : 'OFF'; saveOptions(); vscode.postMessage({ type: 'libraries', value }); }
$('libraries').addEventListener('change', toggle);
$('details').addEventListener('change', () => { saveOptions(); vscode.postMessage({ type: 'details', value: $('details').checked }); });
window.addEventListener('message', event => {
  const data = event.data;
  if (data.type === 'graph') render(data.graph);
  if (data.type === 'loading') $('status').textContent = t('loading');
  if (data.type === 'error') { $('status').textContent = data.message; $('empty').hidden = false; $('empty').textContent = data.message; }
});
transform();
$('toggle-label').textContent = $('libraries').checked ? 'ON' : 'OFF';
vscode.postMessage({ type: 'ready', libraries: $('libraries').checked, details: $('details').checked });
