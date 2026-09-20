const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/**
 * A scroll container that holds a text input must keep taps alive while the
 * keyboard is up.
 *
 * React Native's default (`keyboardShouldPersistTaps="never"`) dismisses the
 * keyboard on the first tap outside the focused input and drops that tap: the
 * button under the finger does nothing until the second press. Five screens
 * had it — the template editor's Save and "add exercise" under its name field,
 * the strength-goal flow's "+5 kg" chips under the kilo field ("tavoitetta ei
 * pysty mitenkään laittamaan nappi ei toimi", #bugs 2026-09-05), the search
 * fields on Workouts and History, and the membership survey. The library
 * browser and the add-exercise sheet already set `"handled"`; the rule is
 * the same for every container, so it is checked for every container.
 *
 * Every container, nested ones included: the prop is not inherited, and
 * React Native's own guidance for nested scroll views is that each one sets
 * it. So an outer container counts the inputs inside its inner ones, and is
 * judged on its own opening tag alone.
 *
 * The scan is textual but shaped like JSX, not like lines. Its first version
 * walked lines and kept a stack: a self-closing container whose `/>` sat on
 * its own line never popped and swallowed the rest of the file, and the prop
 * was credited to every open frame rather than the one it sat on — so a
 * container missing the prop passed whenever any other one in the file had
 * it (CI review of #156). Now each `<ScrollView` / `<FlatList` /
 * `<SectionList` is read to the end of its own opening tag (braces and
 * quotes tracked, since props hold arrow functions with `>` in them), then to
 * its matching close tag or its own `/>`; a `useRef<ScrollView | null>` is a
 * generic, not a tag, and is skipped by the character before the `<`.
 */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const next = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(next));
    else if (entry.name.endsWith('.tsx')) out.push(next);
  }
  return out;
}

/** Scroll containers with a text input anywhere inside, and whether each one's own tag persists taps. */
function scrollContainersWithInputs(source) {
  const src = source.replace(/\r\n/g, '\n');
  const found = [];
  const openRe = /<(ScrollView|FlatList|SectionList)\b/g;
  let m;
  while ((m = openRe.exec(src))) {
    const start = m.index;
    const tag = m[1];
    // `useRef<ScrollView | null>`, `RefObject<FlatList>`: a generic, not JSX.
    if (start > 0 && /[A-Za-z0-9_$]/.test(src[start - 1])) continue;

    // The end of the opening tag: the first `>` at brace depth 0 outside a
    // string — props hold `() => ...` and `{a > b}`.
    let depth = 0;
    let quote = null;
    let tagEnd = -1;
    let selfClosing = false;
    for (let i = start + m[0].length; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        quote = c;
      } else if (c === '{') {
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
      } else if (c === '>' && depth === 0) {
        tagEnd = i;
        selfClosing = src[i - 1] === '/';
        break;
      }
    }
    if (tagEnd < 0) continue;

    let end = tagEnd + 1;
    if (!selfClosing) {
      const pairRe = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
      pairRe.lastIndex = tagEnd + 1;
      let level = 1;
      let pair;
      end = src.length;
      while ((pair = pairRe.exec(src))) {
        if (pair[0].startsWith('</')) {
          level -= 1;
          if (level === 0) {
            end = pair.index + pair[0].length;
            break;
          }
        } else if (!/[A-Za-z0-9_$]/.test(src[pair.index - 1] ?? '')) {
          level += 1;
        }
      }
    }

    const openingTag = src.slice(start, tagEnd + 1);
    const body = src.slice(start, end);
    const inputs = (body.match(/<TextInput\b/g) ?? []).length;
    if (inputs === 0) continue;
    found.push({
      line: src.slice(0, start).split('\n').length,
      inputs,
      selfClosing,
      // On this container's own tag. A descendant's prop, or a comment that
      // names it, is not this container persisting anything.
      persists: /\bkeyboardShouldPersistTaps\s*=/.test(openingTag),
    });
  }
  return found;
}

module.exports = [
  {
    name: 'keyboard: every scroll container holding a text input keeps taps alive',
    run() {
      const missing = [];
      for (const file of [...walk('src/screens'), ...walk('src/components')]) {
        const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const container of scrollContainersWithInputs(source)) {
          if (!container.persists) missing.push(`${file}:${container.line}`);
        }
      }
      assert.deepEqual(
        missing,
        [],
        `a tap after typing dies with the keyboard in: ${missing.join(', ')} — add keyboardShouldPersistTaps="handled"`,
      );
    },
  },
  {
    // The scanner on fixtures, one per way it has been fooled, so a green tree
    // cannot be a scanner that sees nothing.
    name: 'keyboard: the scan reads tags, not lines',
    run() {
      const shape = (source) => scrollContainersWithInputs(source).map((c) => [c.line, c.persists]);

      // A plain container, then the same with the prop.
      const bare = ['<View>', '  <ScrollView style={s.x}>', '    <TextInput value={v} />', '    <Pressable onPress={go} />', '  </ScrollView>', '</View>'].join('\n');
      assert.deepEqual(shape(bare), [[2, false]]);
      assert.deepEqual(shape(bare.replace('<ScrollView style={s.x}>', '<ScrollView style={s.x} keyboardShouldPersistTaps="handled">')), [[2, true]]);

      // A multi-line self-closing FlatList whose header holds the input: the
      // container ends at its own `/>`, and the prop must sit on it.
      const flat = [
        '<FlatList',
        '  data={rows}',
        '  renderItem={({ item }) => <Row onPress={() => open(item)} big={item.n > 3} />}',
        '  ListHeaderComponent={<TextInput value={q} />}',
        '/>',
        '<ScrollView keyboardShouldPersistTaps="handled">',
        '  <Text />',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(flat), [[1, false]], 'the self-closing FlatList must be judged on its own tag, not the next container\'s');
      assert.deepEqual(shape(flat.replace('  data={rows}', '  data={rows}\n  keyboardShouldPersistTaps="handled"')), [[1, true]]);

      // Nested: the inner one persists, the outer one — which also holds the
      // input — does not. The prop is not inherited; both are judged.
      const nested = [
        '<ScrollView>',
        '  <ScrollView horizontal keyboardShouldPersistTaps="handled">',
        '    <TextInput value={v} />',
        '  </ScrollView>',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(nested), [[1, false], [2, true]]);

      // A generic is not a tag, and a comment naming the prop persists nothing.
      const noise = [
        'const ref = useRef<ScrollView | null>(null);',
        '// keyboardShouldPersistTaps is set on the sheet below',
        '<ScrollView ref={ref}>',
        '  <TextInput value={v} />',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(noise), [[3, false]]);

      // No input, no requirement — a plain list is not the case.
      assert.deepEqual(shape('<FlatList data={d} />\n<ScrollView>\n<Text />\n</ScrollView>'), []);
    },
  },
];
