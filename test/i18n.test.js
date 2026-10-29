'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { messages, locale, createTranslator } = require('../media/i18n');
test('locale selection uses Korean variants and falls back to English', () => {
  for (const value of ['ko', 'ko-KR', 'KO_kr']) assert.equal(locale(value), 'ko');
  for (const value of ['en-US', 'ja', 'de', '', undefined, 'korean']) assert.equal(locale(value), 'en');
  assert.equal(createTranslator('ko')('status', { files: 4, directories: 2 }), '현재 구조도: 파일 4개 · 디렉토리 2개');
  assert.equal(createTranslator('en')('status', { files: 4, directories: 2 }), 'Current graph: 4 files · 2 directories');
});
test('translations cover every UI key and preserve interpolation parameters', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.ko).sort());
  const placeholders = value => (value.match(/\{\w+\}/g) || []).sort();
  for (const key of Object.keys(messages.en)) {
    assert.ok(messages.en[key] && messages.ko[key], key);
    assert.deepEqual(placeholders(messages.en[key]), placeholders(messages.ko[key]), key);
    assert.doesNotMatch(messages.en[key], /[가-힣]/);
  }
  for (const file of ['src/extension.js', 'src/analyzer.js', 'media/main.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const match of source.matchAll(/\bt\('([^']+)'/g)) assert.ok(Object.hasOwn(messages.en, match[1]), `${file}: ${match[1]}`);
  }
  const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.nls.json'), 'utf8'));
  const ko = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.nls.ko.json'), 'utf8'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  assert.doesNotMatch(en['command.open'] + en.description, /[가-힣]/);
});
test('actual webview template renders fully localized HTML and loads shared messages first', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/extension.js'), 'utf8');
  const template = source.match(/panel\.webview\.html = (`[\s\S]*?`);/)[1];
  const render = new Function('language', 't', 'panel', 'resource', 'nonce', 'return ' + template);
  for (const language of ['en', 'ko']) {
    const html = render(language, createTranslator(language), { webview: { cspSource: 'test:' } }, name => name, 'test');
    assert.ok(html.includes(`lang="${language}"`));
    assert.ok(html.indexOf('src="i18n.js"') < html.indexOf('src="main.js"'));
    if (language === 'en') { assert.doesNotMatch(html, /[가-힣]/); assert.match(html, /Search files/); assert.match(html, /Connection details/); }
    else { assert.match(html, /파일 검색/); assert.match(html, /연결 상세/); }
  }
});
