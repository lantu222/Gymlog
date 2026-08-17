#!/usr/bin/env node
/**
 * Renders the privacy policy and terms as a small static site for GitHub
 * Pages — the public URL the Play listing points at.
 *
 * Same one-truth pipeline as export-legal.cjs: the HTML is rendered from
 * src/lib/legalDocuments.ts, not parsed out of the Markdown exports, so the
 * published page cannot drift from the in-app documents. When the real
 * homepage exists, these pages move there and the Play listing's URL field
 * is updated — nothing here is load-bearing beyond serving that URL.
 *
 *   npx tsc -p tsconfig.test.json
 *   node scripts/build-legal-site.cjs        # writes dist-legal/
 */
const fs = require('node:fs');
const path = require('node:path');

const compiled = path.join(__dirname, '..', '.test-dist', 'lib', 'legalDocuments.js');
if (!fs.existsSync(compiled)) {
  console.error('Compile first: npx tsc -p tsconfig.test.json');
  process.exit(1);
}

const { buildLegalDocument } = require(compiled);

const outDir = path.join(__dirname, '..', 'dist-legal');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const STYLE = `
  body { margin: 0 auto; max-width: 42rem; padding: 2rem 1.25rem 4rem; font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #1a1523; background: #fff; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 0.25rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem; }
  p { margin: 0.6rem 0; }
  ul { margin: 0.6rem 0; padding-left: 1.4rem; }
  li { margin: 0.3rem 0; }
  .updated { color: #6b6478; font-style: italic; margin: 0 0 1.5rem; }
  .summary { font-size: 1.05rem; }
  a { color: #5b3df5; }
  nav { margin-bottom: 2.5rem; }
`;

function page(language, title, body) {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function renderDocument(id, language) {
  const doc = buildLegalDocument(id, language);
  const sections = doc.sections
    .map((section) => {
      const paragraphs = (section.body ?? []).map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
      const bullets = section.bullets?.length
        ? `<ul>\n${section.bullets.map((text) => `<li>${escapeHtml(text)}</li>`).join('\n')}\n</ul>`
        : '';
      return `<h2>${escapeHtml(section.heading)}</h2>\n${paragraphs}\n${bullets}`;
    })
    .join('\n');

  const body = `<h1>${escapeHtml(doc.title)}</h1>
<p class="updated">${escapeHtml(doc.updatedLabel)}</p>
<p class="summary">${escapeHtml(doc.summary)}</p>
${sections}`;

  return page(language, `${doc.title} – Vinha`, body);
}

const written = [];
const titles = {};
for (const id of ['privacy', 'terms']) {
  for (const language of ['fi', 'en']) {
    const file = `${id}.${language}.html`;
    fs.writeFileSync(path.join(outDir, file), renderDocument(id, language), 'utf8');
    titles[file] = buildLegalDocument(id, language).title;
    written.push(file);
  }
}

// The landing page the Play listing can point at directly. Finnish first,
// because that is the app's first language.
const indexBody = `<h1>Vinha</h1>
<p class="summary">Sovelluksen oikeudelliset dokumentit / the app's legal documents.</p>
<nav>
<h2>Suomeksi</h2>
<ul>
<li><a href="privacy.fi.html">${escapeHtml(titles['privacy.fi.html'])}</a></li>
<li><a href="terms.fi.html">${escapeHtml(titles['terms.fi.html'])}</a></li>
</ul>
<h2>In English</h2>
<ul>
<li><a href="privacy.en.html">${escapeHtml(titles['privacy.en.html'])}</a></li>
<li><a href="terms.en.html">${escapeHtml(titles['terms.en.html'])}</a></li>
</ul>
</nav>`;
fs.writeFileSync(path.join(outDir, 'index.html'), page('fi', 'Vinha – dokumentit', indexBody), 'utf8');
written.push('index.html');

console.log(`Wrote ${written.length} files to dist-legal/:`);
for (const file of written) console.log(`  ${file}`);
