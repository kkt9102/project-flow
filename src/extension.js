'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { analyze, inside, secret } = require('./analyzer');

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('projectFlow.open', async uri => {
    let folder = uri && vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      const folders = vscode.workspace.workspaceFolders || [];
      folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
    }
    if (!folder || folder.uri.scheme !== 'file') { vscode.window.showInformationMessage('로컬 프로젝트 폴더를 먼저 열어주세요.'); return; }
    const root = await fs.realpath(folder.uri.fsPath);
    let directory = root;
    if (uri) {
      try {
        const candidate = await fs.realpath(uri.fsPath);
        if (inside(root, candidate)) directory = (await fs.stat(candidate)).isDirectory() ? candidate : path.dirname(candidate);
      } catch { /* Use workspace root if the selection disappeared. */ }
    }
    const panel = vscode.window.createWebviewPanel('projectFlow', 'Project Flow', vscode.ViewColumn.Active, {
      enableScripts: true, retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    });
    const nonce = crypto.randomBytes(18).toString('base64');
    const resource = name => panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', name));
    panel.webview.html = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${panel.webview.cspSource} data:;"><link rel="stylesheet" href="${resource('style.css')}"></head><body>
      <header><div class="brand"><img class="brand-logo" src="${resource('icon.svg')}" width="30" height="30" alt=""><strong>Project Flow</strong><span class="badge">EXPLORER</span></div><div class="actions"><input id="search" type="search" placeholder="파일 검색…" aria-label="파일 검색"><button id="refresh" title="구조도 새로고침">↻ 새로고침</button></div></header>
      <nav><div id="breadcrumbs" aria-label="현재 디렉토리"></div><div class="actions"><label class="toggle"><input id="details" type="checkbox" checked>폴더 내부 연결</label><label class="toggle"><input id="libraries" type="checkbox">라이브러리 <span id="toggle-label">OFF</span></label></div></nav>
      <main id="viewport" aria-label="프로젝트 파일 구조도"><div id="world"><svg id="connections" xmlns="http://www.w3.org/2000/svg"></svg><div id="nodes"></div></div><div id="empty" hidden></div><div class="legend"><span class="dot directory"></span>폴더 포함 ⋯ <span class="dot reference"></span>참조 방향 → <span class="dot library"></span>외부 패키지</div><div class="zoom"><button id="minus" aria-label="축소">−</button><span id="scale">100%</span><button id="plus" aria-label="확대">+</button><button id="fit">화면 맞춤</button></div></main>
      <aside id="edge-panel" hidden aria-label="연결 상세"><div class="edge-panel-header"><strong>연결 상세</strong><button id="close-edge" aria-label="연결 상세 닫기">×</button></div><div id="edge-summary"></div><div id="edge-symbols"></div></aside>
      <footer><span id="status" role="status">프로젝트 분석 준비 중…</span><span>화살표 클릭: 함수·변수 목록 · 더블클릭: 파일 열기 · 드래그: 이동</span></footer>
      <script nonce="${nonce}" src="${resource('geometry.js')}"></script><script nonce="${nonce}" src="${resource('main.js')}"></script></body></html>`;
    let libraries = false;
    let details = true;
    let graph;
    let busy = false;
    let pending = false;
    let disposed = false;
    async function refresh() {
      if (disposed) return;
      if (busy) { pending = true; return; }
      busy = true;
      panel.webview.postMessage({ type: 'loading' });
      try {
        graph = await analyze(root, directory, libraries, details);
        directory = graph.directory;
        if (!disposed) panel.webview.postMessage({ type: 'graph', graph });
      } catch (error) { if (!disposed) panel.webview.postMessage({ type: 'error', message: error.message }); }
      finally { busy = false; if (pending) { pending = false; void refresh(); } }
    }
    const listener = panel.webview.onDidReceiveMessage(async message => {
      if (!message || typeof message !== 'object') return;
      try {
        if (message.type === 'ready') { details = message.details !== false; libraries = message.libraries === true; return void refresh(); }
        if (message.type === 'refresh') return void refresh();
        if (message.type === 'libraries') { libraries = message.value === true; return void refresh(); }
        if (message.type === 'details') { details = message.value === true; return void refresh(); }
        if (message.type === 'navigate' && typeof message.path === 'string') {
          const allowed = graph && (message.path === root || inside(message.path, directory) || graph.nodes.some(n => n.id === message.path && n.kind === 'directory'));
          if (!allowed) return;
          const target = await fs.realpath(message.path);
          if (!inside(root, target) || !(await fs.stat(target)).isDirectory()) return;
          directory = target; return void refresh();
        }
        if (message.type === 'open' && typeof message.path === 'string' && graph?.nodes.some(n => n.id === message.path && n.kind === 'file')) {
          const target = await fs.realpath(message.path);
          if (!inside(root, target) || secret(path.basename(target))) return;
          await vscode.window.showTextDocument(vscode.Uri.file(target), { preview: false, viewColumn: vscode.ViewColumn.Beside });
        }
      } catch { vscode.window.showWarningMessage('파일이 이동되었거나 접근할 수 없습니다. 새로고침해 주세요.'); }
    });
    let timer;
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*'));
    const changed = uri => {
      if (uri.fsPath.split(path.sep).some(p => ['node_modules', '.git', '.codex'].includes(p)) || secret(path.basename(uri.fsPath))) return;
      clearTimeout(timer); timer = setTimeout(() => void refresh(), 500);
    };
    watcher.onDidCreate(changed); watcher.onDidDelete(changed); watcher.onDidChange(changed);
    panel.onDidDispose(() => { disposed = true; clearTimeout(timer); watcher.dispose(); listener.dispose(); });
  }));
}
module.exports = { activate, deactivate() {} };
