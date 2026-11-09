#!/usr/bin/env node
// Serbian pages for search engines (09.11.2026).
// The site is one set of English pages; the language used to switch only in the visitor's
// browser (main.js setLanguage), so search engines never saw Serbian. On every deploy
// (.github/workflows/deploy.yml) this script builds /sr/<page>.html: the same page with the
// Serbian texts of js/translations.js written into the HTML - exactly what setLanguage('sr')
// does in the browser - and adds <link rel="alternate" hreflang> to both versions so Google
// pairs them. main.js sees those links and turns the EN/SR buttons into links to the pair.
// Sources stay as they are: pages + js/translations.js. Nothing generated is committed.
//
// It edits the pages IN PLACE (adds the hreflang links), so it runs in CI or on a copy of the
// site, never on the working repo.   Usage: node tools/build-sr.js <siteDir>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ORIGIN = 'https://balkanplastics.com';
const LANG = 'sr';

function fail(msg) { console.error('build-sr: ' + msg); process.exit(1); }

const siteDir = process.argv[2];
if (!siteDir) fail('usage: node tools/build-sr.js <siteDir>');
if (fs.existsSync(path.join(siteDir, '.git')) && process.env.CI !== 'true') {
  fail('pages are edited in place - run it in CI or on a copy of the site, not on the working repo');
}

const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(siteDir, 'js/translations.js'), 'utf8') + '\nthis.T = translations;', ctx);
const T = ctx.T[LANG];
if (!T) fail(`no "${LANG}" block in js/translations.js`);

const escText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => escText(s).replace(/"/g, '&quot;');

// Address of a page in a language: / and /sr/ for the home page, as in sitemap.xml.
const pageUrl = (page, lang) => ORIGIN + (lang === 'en' ? '/' : `/${LANG}/`) + (page === 'index.html' ? '' : page);

// Both versions point to each other; x-default (no language match) is English.
function addAlternates(html, page) {
  if (/hreflang=/.test(html)) fail(`${page}: already has hreflang links`);
  if (html.split('</head>').length !== 2) fail(`${page}: expected exactly one </head>`);
  const links = [['en', 'en'], [LANG, LANG], ['x-default', 'en']]
    .map(([code, lang]) => `  <link rel="alternate" hreflang="${code}" href="${pageUrl(page, lang)}">\n`).join('');
  return html.replace('</head>', links + '</head>');
}

// Index of the </tag> that closes an element whose content starts at `from` (same-tag nesting counted).
function closeIndex(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return -1;
}

// data-i18n: the whole content becomes the text, as el.textContent = value (an empty string too;
// a missing key leaves the element as it is). Nested markup goes away, exactly as in the browser.
function setTexts(html, page, stat) {
  const open = /<([a-zA-Z][\w-]*)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>/g;
  let out = '', pos = 0, m;
  while ((m = open.exec(html))) {
    const [tagHtml, tag, key] = m;
    const start = m.index + tagHtml.length;
    const end = closeIndex(html, tag, start);
    if (end < 0) fail(`${page}: no closing </${tag}> for data-i18n="${key}"`);
    if (T[key] === undefined) { stat.missing.push(key); continue; }
    out += html.slice(pos, start) + escText(T[key]);
    pos = end;
    open.lastIndex = end;
    stat.texts++;
  }
  return out + html.slice(pos);
}

// Attributes, as setLanguage: only non-empty values are applied.
const ATTRS = [['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria', 'aria-label'], ['data-i18n-content', 'content']];
function setAttrs(html, stat) {
  return html.replace(/<[a-zA-Z][^>]*\sdata-i18n-(?:placeholder|aria|content)="[^"]+"[^>]*>/g, tag => {
    for (const [src, dst] of ATTRS) {
      const key = (tag.match(new RegExp(`\\s${src}="([^"]+)"`)) || [])[1];
      if (!key) continue;
      if (!T[key]) { stat.missing.push(key); continue; }
      const val = `${dst}="${escAttr(T[key])}"`;
      const re = new RegExp(`(\\s)${dst}="[^"]*"`);
      tag = re.test(tag) ? tag.replace(re, (all, sp) => sp + val) : tag.replace(/\s*\/?>$/, end => ` ${val}${end}`);
      stat.attrs++;
    }
    return tag;
  });
}

// <title data-i18n-title="key">: setLanguage sets document.title.
function setTitle(html, stat) {
  return html.replace(/(<title\b[^>]*\sdata-i18n-title="([^"]+)"[^>]*>)[\s\S]*?(<\/title>)/, (all, open, key, close) => {
    if (!T[key]) { stat.missing.push(key); return all; }
    stat.attrs++;
    return open + escText(T[key]) + close;
  });
}

function toSerbian(html, page) {
  const stat = { texts: 0, attrs: 0, missing: [] };
  if (!html.includes('<html lang="en">')) fail(`${page}: no <html lang="en">`);
  html = html.replace('<html lang="en">', `<html lang="${LANG}">`);
  let buttons = 0;
  html = html.replace(/<button class="lang-btn(?: active)?" data-lang="(\w+)">/g, (all, lang) => {
    buttons++;
    return `<button class="lang-btn${lang === LANG ? ' active' : ''}" data-lang="${lang}">`;
  });
  if (buttons !== 2) fail(`${page}: expected 2 language buttons, found ${buttons}`);
  // /sr/ is one level deeper: assets get "../"; page links (*.html, #anchor) stay relative,
  // so Serbian pages link to Serbian pages.
  html = html.replace(/(\s(?:href|src)=")((?:css|js|img|fonts)\/[^"]*")/g, '$1../$2');
  html = setTitle(setAttrs(setTexts(html, page, stat), stat), stat);
  return { html: addAlternates(html, page), stat };
}

const pages = fs.readdirSync(siteDir).filter(f => f.endsWith('.html')).sort();
if (!pages.length) fail(`no pages in ${siteDir}`);
fs.mkdirSync(path.join(siteDir, LANG), { recursive: true });
for (const page of pages) {
  const file = path.join(siteDir, page);
  const html = fs.readFileSync(file, 'utf8');
  const sr = toSerbian(html, page);
  fs.writeFileSync(path.join(siteDir, LANG, page), sr.html);
  fs.writeFileSync(file, addAlternates(html, page));
  const miss = sr.stat.missing.length ? `, no Serbian (left as is): ${sr.stat.missing.join(', ')}` : '';
  console.log(`${LANG}/${page}: ${sr.stat.texts} texts, ${sr.stat.attrs} attributes${miss}`);
}
console.log(`build-sr: ${pages.length} pages -> ${LANG}/, hreflang links added to both versions`);
