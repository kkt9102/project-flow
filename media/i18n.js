'use strict';
(function (exports) {
  const messages = {
    en: {
      openWorkspace: 'Open a local project folder first.', inaccessible: 'The file was moved or cannot be accessed. Please refresh.',
      outside: 'This directory is outside the project.', folderWarning: 'Some folders could not be accessed.', extendsWarning: 'Inherited extends settings are not supported.', largeWarning: 'Source files larger than 512KB were skipped.', analysisFailed: 'Could not analyze this directory. Check access permissions and refresh.',
      search: 'Search files…', searchLabel: 'Search files', refresh: 'Refresh', refreshTitle: 'Refresh graph', breadcrumbs: 'Current directory', details: 'Folder contents', libraries: 'Libraries', graph: 'Project file graph', containsLegend: 'Folder contents ⋯', referenceLegend: 'References →', packages: 'External packages', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fit: 'Fit to screen', edgeDetails: 'Connection details', closeEdge: 'Close connection details', preparing: 'Preparing project analysis…', help: 'Click an arrow: symbols · Double-click: open · Drag: move',
      containsNote: 'This file belongs to the folder. Click a green or purple arrow to view symbol references.', function: 'Function', variable: 'Variable', class: 'Class', interface: 'Interface', type: 'Type', enum: 'Enum', symbol: 'Symbol', moduleLoad: 'Module load', wholeModule: 'Entire module', noSymbols: 'No function or variable names to display.', symbolLimit: 'Showing up to 200 entries.', symbolNote: 'Names declared in import/export statements. Calls and usage counts are not analyzed. Re-exports and external bindings with unknown kinds are shown as symbols.',
      packageReference: 'External package reference', doubleClick: 'Double-click to open', openDirectory: 'Open directory ↗', package: 'External package', connections: '{count} connections', more: '+{count} more', edgeLabel: '{source} → {target}: connection details', containsTitle: 'File contained in folder', referenceCount: '{count} references', empty: 'No files to display.', status: 'Current graph: {files} files · {directories} directories', packageCount: ' · {count} external packages', analysisCount: ' · {edges} connections · {files} source files analyzed', limit: ' · Display/analysis limit reached: open a subfolder', loading: 'Analyzing project…'
    },
    ko: {
      openWorkspace: '로컬 프로젝트 폴더를 먼저 열어주세요.', inaccessible: '파일이 이동되었거나 접근할 수 없습니다. 새로고침해 주세요.',
      outside: '프로젝트 밖의 디렉토리입니다.', folderWarning: '일부 폴더에 접근하지 못했습니다.', extendsWarning: 'extends 설정 상속은 지원하지 않습니다.', largeWarning: '512KB 초과 소스는 분석에서 제외했습니다.', analysisFailed: '디렉토리를 분석하지 못했습니다. 접근 권한을 확인하고 새로고침해 주세요.',
      search: '파일 검색…', searchLabel: '파일 검색', refresh: '새로고침', refreshTitle: '구조도 새로고침', breadcrumbs: '현재 디렉토리', details: '폴더 내부 연결', libraries: '라이브러리', graph: '프로젝트 파일 구조도', containsLegend: '폴더 포함 ⋯', referenceLegend: '참조 방향 →', packages: '외부 패키지', zoomOut: '축소', zoomIn: '확대', fit: '화면 맞춤', edgeDetails: '연결 상세', closeEdge: '연결 상세 닫기', preparing: '프로젝트 분석 준비 중…', help: '화살표 클릭: 함수·변수 목록 · 더블클릭: 파일 열기 · 드래그: 이동',
      containsNote: '폴더에 포함된 파일입니다. 함수·변수 참조는 녹색 또는 보라색 화살표에서 확인하세요.', function: '함수', variable: '변수', class: '클래스', interface: '인터페이스', type: '타입', enum: '열거형', symbol: '심볼', moduleLoad: '모듈 로드', wholeModule: '모듈 전체', noSymbols: '표시할 함수·변수 이름이 없습니다.', symbolLimit: '목록은 최대 200개까지 표시합니다.', symbolNote: 'import/export에 명시된 이름입니다. 실제 호출·사용 횟수는 분석하지 않습니다. 재수출이나 외부 패키지의 종류가 확인되지 않으면 심볼로 표시합니다.',
      packageReference: '외부 패키지 참조', doubleClick: '더블클릭하여 열기', openDirectory: '디렉토리 열기 ↗', package: '외부 패키지', connections: '{count} 연결', more: '+{count}개', edgeLabel: '{source} → {target} 연결 상세', containsTitle: '폴더에 포함된 파일', referenceCount: '{count}개 참조', empty: '표시할 파일이 없습니다.', status: '현재 구조도: 파일 {files}개 · 디렉토리 {directories}개', packageCount: ' · 외부 패키지 {count}개', analysisCount: ' · {edges} 연결 · {files} 소스 분석', limit: ' · 표시/분석 한도 도달: 하위 폴더로 이동하세요', loading: '프로젝트 분석 중…'
    }
  };
  function locale(language) { return /^ko(?:-|_|$)/i.test(language || '') ? 'ko' : 'en'; }
  function createTranslator(language) {
    const dictionary = messages[locale(language)];
    return (key, values = {}) => (dictionary[key] || messages.en[key] || key).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  }
  Object.assign(exports, { messages, locale, createTranslator });
})(typeof module === 'object' ? module.exports : (window.FlowI18n = {}));
