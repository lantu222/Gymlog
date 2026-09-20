const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/**
 * A scroll container that shares a screen with a text input must keep taps
 * alive while the keyboard is up.
 *
 * React Native's default (`keyboardShouldPersistTaps="never"`) dismisses the
 * keyboard on the first tap outside the focused input and drops that tap: the
 * button under the finger does nothing until the second press. Seven
 * containers had it — the template editor's Save and "add exercise" under its
 * name field, the strength-goal flow's "+5 kg" chips under the kilo field
 * ("tavoitetta ei pysty mitenkään laittamaan nappi ei toimi", #bugs
 * 2026-09-05), the search fields on Workouts and History, the membership
 * survey, and the swap sheets on Home and the programme day, where the search
 * field sits ABOVE the list rather than inside it. The library browser and
 * the add-exercise sheet already set `"handled"`; the rule is the same for
 * every container, so it is checked for every container.
 *
 * Two shapes count. A container that HOLDS an input, nested ones included —
 * the prop is not inherited, and React Native's own guidance for nested
 * scroll views is that each one sets it, so an outer container counts the
 * inputs inside its inner ones. And a container that FOLLOWS an input as its
 * sibling, the search-then-list sheet: the keyboard raised by the field above
 * eats the first tap on the list below just the same (CI review of #156).
 *
 * The scan is textual but shaped like JSX, not like lines. Its first version
 * walked lines and kept a stack: a self-closing container whose `/>` sat on
 * its own line never popped and swallowed the rest of the file, and the prop
 * was credited to every open frame rather than the one it sat on. Its second
 * read tags, but judged a self-closing element on its whole span, so a
 * `keyboardShouldPersistTaps` on a ScrollView nested inside its
 * `ListHeaderComponent` prop passed for the outer FlatList (CI review of
 * #156, twice). Now each `<ScrollView` / `<FlatList` / `<SectionList` is read
 * to the end of its own opening tag with braces and quotes tracked, judged on
 * the text at brace depth 0 of that tag alone, and closed at its matching
 * close tag or its own `/>`; a `useRef<ScrollView | null>` is a generic, not
 * a tag, and is skipped by the character before the `<`.
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

/**
 * What counts as a text input: the primitive, and the sheet kit's search
 * field, which wraps one. Checked below against sheetKit.tsx so the list
 * cannot go quietly stale.
 */
const INPUT_TAGS = ['TextInput', 'KitSearch'];
const INPUT_RE = new RegExp(`<(${INPUT_TAGS.join('|')})\\b`, 'g');
/** How far above a container a sibling input still raises the keyboard over it. */
const SIBLING_LINES = 12;

/** Scroll containers that hold or follow a text input, and whether each one's own tag persists taps. */
function scrollContainersWithInputs(source) {
  const src = source.replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const found = [];
  const openRe = /<(ScrollView|FlatList|SectionList)\b/g;
  let m;
  while ((m = openRe.exec(src))) {
    const start = m.index;
    const tag = m[1];
    // `useRef<ScrollView | null>`, `RefObject<FlatList>`: a generic, not JSX.
    if (start > 0 && /[A-Za-z0-9_$]/.test(src[start - 1])) continue;

    // The end of the opening tag: the first `>` at brace depth 0 outside a
    // string — props hold `() => ...` and `{a > b}`. `ownText` is the tag's
    // text at depth 0 only: its own attributes, not the JSX inside a prop.
    let depth = 0;
    let quote = null;
    let tagEnd = -1;
    let selfClosing = false;
    let ownText = '';
    for (let i = start + m[0].length; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = null;
        if (depth === 0) ownText += c;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        quote = c;
      } else if (c === '{') {
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
        continue;
      } else if (c === '>' && depth === 0) {
        tagEnd = i;
        selfClosing = src[i - 1] === '/';
        break;
      }
      if (depth === 0) ownText += c;
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

    const line = src.slice(0, start).split('\n').length;
    const inputs = (src.slice(start, end).match(INPUT_RE) ?? []).length;
    const above = lines.slice(Math.max(0, line - 1 - SIBLING_LINES), line - 1).join('\n');
    const siblingInput = INPUT_RE.test(above);
    INPUT_RE.lastIndex = 0;
    if (inputs === 0 && !siblingInput) continue;
    found.push({
      line,
      inputs,
      siblingInput,
      selfClosing,
      // On this container's own attributes. A descendant's prop, a prop on an
      // element nested inside one of its props, or a comment that names it,
      // is not this container persisting anything.
      persists: /\bkeyboardShouldPersistTaps\s*=/.test(ownText),
    });
  }
  return found;
}

module.exports = [
  {
    name: 'keyboard: every scroll container that holds or follows a text input keeps taps alive',
    run() {
      // The wrapper list is true of the code, not of this file.
      const kit = fs.readFileSync(path.join(ROOT, 'src', 'components', 'sheetKit.tsx'), 'utf8');
      const search = kit.slice(kit.indexOf('export function KitSearch'));
      const ownBody = search.slice(0, search.indexOf('\nexport ', 1) > 0 ? search.indexOf('\nexport ', 1) : undefined);
      assert.match(ownBody, /<TextInput\b/, 'KitSearch no longer renders a TextInput — take it out of INPUT_TAGS');

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
    name: 'keyboard: the scan reads tags, judges each on its own attributes, and sees a sibling input',
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
      assert.deepEqual(shape(flat), [[1, false], [6, true]], "the self-closing FlatList is judged on its own tag, not the next container's; the ScrollView follows the header's input");
      assert.deepEqual(shape(flat.replace('  data={rows}', '  data={rows}\n  keyboardShouldPersistTaps="handled"')), [[1, true], [7, true]]);

      // The prop on an element NESTED INSIDE a prop of the self-closing
      // container is that element's, not the container's (the library
      // browser's shape: a FlatList whose ListHeaderComponent holds the
      // search field and a horizontal chip ScrollView that persists).
      const nestedProp = [
        '<FlatList',
        '  data={rows}',
        '  ListHeaderComponent={',
        '    <View>',
        '      <TextInput value={q} />',
        '      <ScrollView horizontal keyboardShouldPersistTaps="handled">',
        '        <Chip />',
        '      </ScrollView>',
        '    </View>',
        '  }',
        '/>',
      ].join('\n');
      assert.deepEqual(shape(nestedProp), [[1, false], [6, true]], 'the chip row\'s prop must not vouch for the FlatList');
      assert.deepEqual(shape(nestedProp.replace('  data={rows}', '  data={rows}\n  keyboardShouldPersistTaps="handled"')), [[1, true], [7, true]]);

      // Nested paired containers: the inner one persists, the outer one —
      // which also holds the input — does not. The prop is not inherited.
      const nested = [
        '<ScrollView>',
        '  <ScrollView horizontal keyboardShouldPersistTaps="handled">',
        '    <TextInput value={v} />',
        '  </ScrollView>',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(nested), [[1, false], [2, true]]);

      // The search-then-list sheet: the field is a sibling above the list.
      const sibling = ['<KitSearch value={q} onChangeText={setQ} />', '<ScrollView style={s.list}>', '  <KitRow onPress={pick} />', '</ScrollView>'].join('\n');
      assert.deepEqual(shape(sibling), [[2, false]], 'a list under a search field is under its keyboard too');
      assert.deepEqual(shape(sibling.replace('<ScrollView style={s.list}>', '<ScrollView style={s.list} keyboardShouldPersistTaps="handled">')), [[2, true]]);

      // A generic is not a tag, and a comment naming the prop persists nothing.
      const noise = [
        'const ref = useRef<ScrollView | null>(null);',
        '// keyboardShouldPersistTaps is set on the sheet below',
        '<ScrollView ref={ref}>',
        '  <TextInput value={v} />',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(noise), [[3, false]]);

      // No input anywhere near, no requirement — a plain list is not the case.
      assert.deepEqual(shape('<FlatList data={d} />\n<ScrollView>\n<Text />\n</ScrollView>'), []);
    },
  },
];
