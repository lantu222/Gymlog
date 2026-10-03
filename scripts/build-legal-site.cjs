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
const { buildAccountDeletionPage } = require(path.join(__dirname, '..', '.test-dist', 'lib', 'accountDeletionPage.js'));
const { WEB_DELETION_ENDPOINT } = require(path.join(__dirname, '..', '.test-dist', 'lib', 'webAccountDeletion.js'));

// LEGAL_SITE_OUT_DIR: the tests build into a temporary directory.
const outDir = process.env.LEGAL_SITE_OUT_DIR || path.join(__dirname, '..', 'dist-legal');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const STYLE = `
  body { margin: 0 auto; max-width: 42rem; padding: 2rem 1.25rem 4rem; font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #1a1523; background: #fff; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 0.25rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem; }
  p { margin: 0.6rem 0; }
  ul, ol { margin: 0.6rem 0; padding-left: 1.4rem; }
  li { margin: 0.3rem 0; }
  .updated { color: #6b6478; font-style: italic; margin: 0 0 1.5rem; }
  .summary { font-size: 1.05rem; }
  a { color: #5b3df5; }
  nav { margin-bottom: 2.5rem; }
  .web-delete { margin: 1rem 0 1.5rem; }
  .web-delete button { font: inherit; padding: 0.5rem 1rem; margin: 0.25rem 0.5rem 0.25rem 0; border: 1px solid #6b6478; border-radius: 6px; background: #fff; color: #1a1523; cursor: pointer; }
  .web-delete button.danger { background: #b42318; border-color: #b42318; color: #fff; }
  .web-delete button:disabled { opacity: 0.5; cursor: default; }
  #status { font-weight: bold; }
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

// The account deletion page. Its first section deletes from the browser
// (src/lib/webAccountDeletion.ts): Google signs the reader in on the page,
// and the page sends the app's own Delete account request. The Google client
// id is the app's Web client — public, it ships in every APK — read from the
// environment or .env.local. Without it the deletion pages are not built at
// all (LEGAL_SITE_WITHOUT_WEB_DELETION=1, the GitHub Pages copy), never built
// without the form Play asks for.
function googleWebClientId() {
  const fromEnv = (process.env.GOOGLE_WEB_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
  if (fromEnv) return fromEnv;
  const envFile = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envFile)) return '';
  const line = fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

/** A value for an inline script: JSON, with `<` escaped so no text can close the tag. */
const inlineJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

function webDeletionForm(language, doc, clientId) {
  const config = {
    clientId,
    endpoint: WEB_DELETION_ENDPOINT,
    action: 'delete-account',
    language,
    text: doc.web,
  };
  return `<div class="web-delete">
<noscript><p>${escapeHtml(doc.web.noScript)}</p></noscript>
<div id="gsi-button"></div>
<div id="confirm" hidden>
<p id="confirm-text"></p>
<button type="button" id="confirm-yes" class="danger">${escapeHtml(doc.web.confirmButton)}</button>
<button type="button" id="confirm-no">${escapeHtml(doc.web.cancelButton)}</button>
</div>
<p id="status" role="status" aria-live="polite"></p>
</div>
<script>
(function () {
  var C = ${inlineJson(config)};
  var token = null;
  var email = '';
  var $ = function (id) { return document.getElementById(id); };
  function say(text) { $('status').textContent = text || ''; }
  function claims(jwt) {
    var part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (part.length % 4) part += '=';
    var bytes = Uint8Array.from(atob(part), function (c) { return c.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function reset() {
    token = null;
    $('confirm').hidden = true;
    $('gsi-button').hidden = false;
    $('confirm-yes').disabled = false;
    $('confirm-no').disabled = false;
  }
  function onCredential(response) {
    try {
      token = response.credential;
      email = claims(token).email || '';
    } catch (error) {
      reset();
      say(C.text.signInFailed);
      return;
    }
    $('confirm-text').textContent = C.text.confirm.replace('{email}', email);
    $('gsi-button').hidden = true;
    $('confirm').hidden = false;
    say('');
  }
  $('confirm-no').addEventListener('click', function () { reset(); say(''); });
  $('confirm-yes').addEventListener('click', function () {
    if (!token) return;
    $('confirm-yes').disabled = true;
    $('confirm-no').disabled = true;
    say(C.text.working);
    fetch(C.endpoint, {
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + token, 'x-backup-action': C.action },
    })
      .then(function (answer) {
        // Done is said only once the server has answered that it is done.
        if (answer.ok) {
          var deleted = email;
          reset();
          $('gsi-button').hidden = true;
          say(C.text.done.replace('{email}', deleted));
          return;
        }
        reset();
        say(answer.status === 401 ? C.text.refused : answer.status === 429 ? C.text.rateLimited : C.text.failed);
      })
      .catch(function () { reset(); say(C.text.failed); });
  });
  window.vinhaGoogleLoaded = function () {
    google.accounts.id.initialize({ client_id: C.clientId, callback: onCredential, auto_select: false });
    google.accounts.id.renderButton($('gsi-button'), { theme: 'outline', size: 'large', text: 'signin_with', locale: C.language });
  };
  window.vinhaGoogleFailed = function () { say(C.text.signInFailed); };
})();
</script>
<script src="https://accounts.google.com/gsi/client" async onload="vinhaGoogleLoaded()" onerror="vinhaGoogleFailed()"></script>`;
}

// Numbered steps, then what goes and what stays.
function renderDeletionPage(language, clientId) {
  const doc = buildAccountDeletionPage(language);
  const sections = doc.sections
    .map((section) => {
      const steps = section.steps?.length
        ? `<ol>\n${section.steps.map((text) => `<li>${escapeHtml(text)}</li>`).join('\n')}\n</ol>`
        : '';
      const paragraphs = (section.body ?? []).map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
      const bullets = section.bullets?.length
        ? `<ul>\n${section.bullets.map((text) => `<li>${escapeHtml(text)}</li>`).join('\n')}\n</ul>`
        : '';
      const form = section.webDeletion ? webDeletionForm(language, doc, clientId) : '';
      return `<h2>${escapeHtml(section.heading)}</h2>\n${steps}\n${paragraphs}\n${form}\n${bullets}`;
    })
    .join('\n');
  const privacy = buildLegalDocument('privacy', language).title;
  const body = `<h1>${escapeHtml(doc.title)}</h1>
<p class="summary">${escapeHtml(doc.summary)}</p>
${sections}
<p><a href="privacy.${language}.html">${escapeHtml(privacy)}</a></p>`;
  return page(language, doc.title, body);
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

const clientId = googleWebClientId();
const withDeletion = clientId !== '';
if (!withDeletion && process.env.LEGAL_SITE_WITHOUT_WEB_DELETION !== '1') {
  console.error(
    'No Google Web client id (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.local, or GOOGLE_WEB_CLIENT_ID): the account deletion page needs it.\n' +
      'Set LEGAL_SITE_WITHOUT_WEB_DELETION=1 to build the documents without the deletion pages.',
  );
  process.exit(1);
}
if (withDeletion) {
  for (const language of ['fi', 'en']) {
    const file = `delete-account.${language}.html`;
    fs.writeFileSync(path.join(outDir, file), renderDeletionPage(language, clientId), 'utf8');
    titles[file] = buildAccountDeletionPage(language).title;
    written.push(file);
  }
}
const deletionLink = (language) =>
  withDeletion
    ? `\n<li><a href="delete-account.${language}.html">${escapeHtml(titles[`delete-account.${language}.html`])}</a></li>`
    : '';

// The landing page the Play listing can point at directly. Finnish first,
// because that is the app's first language.
const indexBody = `<h1>Vinha</h1>
<p class="summary">Sovelluksen oikeudelliset dokumentit / the app's legal documents.</p>
<nav>
<h2>Suomeksi</h2>
<ul>
<li><a href="privacy.fi.html">${escapeHtml(titles['privacy.fi.html'])}</a></li>
<li><a href="terms.fi.html">${escapeHtml(titles['terms.fi.html'])}</a></li>${deletionLink('fi')}
</ul>
<h2>In English</h2>
<ul>
<li><a href="privacy.en.html">${escapeHtml(titles['privacy.en.html'])}</a></li>
<li><a href="terms.en.html">${escapeHtml(titles['terms.en.html'])}</a></li>${deletionLink('en')}
</ul>
</nav>`;
fs.writeFileSync(path.join(outDir, 'index.html'), page('fi', 'Vinha – dokumentit', indexBody), 'utf8');
written.push('index.html');

console.log(`Wrote ${written.length} files to dist-legal/:`);
for (const file of written) console.log(`  ${file}`);
