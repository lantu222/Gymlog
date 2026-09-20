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
 * button under the finger does nothing until the second press. Ten containers
 * had it — the template editor's Save and "add exercise" under its name field
 * and the preset row inside it, the strength-goal flow's "+5 kg" chips under
 * the kilo field ("tavoitetta ei pysty mitenkään laittamaan nappi ei toimi",
 * #bugs 2026-09-05), the Workouts search with its filter chips and the
 * programme carousel that IS its result list, the History search, the
 * membership survey, and the swap sheets on Home and the programme day, where
 * the search field sits ABOVE the list rather than inside it. The library
 * browser and the add-exercise sheet already set `"handled"`; the rule is the
 * same for every container, so it is checked for every container.
 *
 * Three shapes count, because the prop is not inherited — each ScrollView
 * resolves it on its own at touch time. A container that HOLDS an input,
 * nested ones included. A container that FOLLOWS an input as its sibling,
 * the search-then-list sheet: the keyboard raised by the field above eats the
 * first tap on the list below just the same. And a container NESTED INSIDE
 * either of those — a horizontal chip row under a search field is under the
 * same keyboard (CI review of #156, three rounds).
 *
 * The scan is textual but shaped like JSX, not like lines. Its first version
 * walked lines and kept a stack: a self-closing container whose `/>` sat on
 * its own line never popped and swallowed the rest of the file, and the prop
 * was credited to every open frame rather than the one it sat on. Its second
 * read tags, but judged a self-closing element on its whole span, so a
 * `keyboardShouldPersistTaps` on a ScrollView nested inside its
 * `ListHeaderComponent` prop passed for the outer FlatList. Now each
 * `<ScrollView` / `<FlatList` / `<SectionList` is read to the end of its own
 * opening tag with braces and quotes tracked, judged on the text at brace
 * depth 0 of that tag alone, and closed at its matching close tag or its own
 * `/>`; a `useRef<ScrollView | null>` is a generic, not a tag, and is skipped
 * by the character before the `<`.
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
/**
 * How far above a container a sibling input still raises the keyboard over
 * it. Forty, not twelve: the add-exercise sheet hoists its list header into a
 * `const listHeader = (...)` with the search field at its top and a chip row
 * twenty lines below, and the FlatList takes it by name — nothing textual
 * puts the two in one span (CI review of #156, fourth round).
 */
const SIBLING_LINES = 40;

/**
 * The end of an opening tag that starts at `start`: the first `>` at brace
 * depth 0 outside a string — props hold `() => ...` and `{a > b}`. `ownText`
 * is the tag's text at depth 0 only: its own attributes, not the JSX inside
 * a prop. Null when the tag never closes.
 */
function openingTagAt(src, start, tagLength) {
  let depth = 0;
  let quote = null;
  let ownText = '';
  for (let i = start + tagLength; i < src.length; i += 1) {
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
      return { tagEnd: i, selfClosing: src[i - 1] === '/', ownText };
    }
    if (depth === 0) ownText += c;
  }
  return null;
}

/** Every scroll container in the source, with its span and its own attributes. */
function scrollContainers(src) {
  const out = [];
  const openRe = /<(ScrollView|FlatList|SectionList)\b/g;
  let m;
  while ((m = openRe.exec(src))) {
    const start = m.index;
    const tag = m[1];
    // `useRef<ScrollView | null>`, `RefObject<FlatList>`: a generic, not JSX.
    if (start > 0 && /[A-Za-z0-9_$]/.test(src[start - 1])) continue;

    const opening = openingTagAt(src, start, m[0].length);
    if (!opening) continue;
    const { tagEnd, selfClosing, ownText } = opening;

    let end = tagEnd + 1;
    if (!selfClosing) {
      // The matching close tag, by nesting of the same name. A nested opener
      // that is itself self-closing has no close tag of its own and must
      // not raise the level — counted, it left the outer span running to the
      // end of the file (CI review of #156, fifth round). Each nested tag is
      // read to its own end so a `>` inside its props is not mistaken for
      // anything.
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
          const inner = openingTagAt(src, pair.index, pair[0].length);
          if (!inner) break;
          if (!inner.selfClosing) level += 1;
          pairRe.lastIndex = inner.tagEnd + 1;
        }
      }
    }

    out.push({
      start,
      end,
      selfClosing,
      line: src.slice(0, start).split('\n').length,
      // On this container's own attributes, and set to a value that keeps the
      // tap: "never" is the default this guard exists to remove, and its
      // presence proved nothing (CI review of #156, sixth round). A
      // descendant's prop, a prop on an element nested inside one of its
      // props, or a comment that names it, is not this container persisting
      // anything.
      persists: /\bkeyboardShouldPersistTaps\s*=\s*["'](handled|always)["']/.test(ownText),
    });
  }
  return out;
}

/** Scroll containers under a keyboard — holding, following, or nested inside one that does. */
function scrollContainersWithInputs(source) {
  const src = source.replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const containers = scrollContainers(src);
  for (const c of containers) {
    c.inputs = (src.slice(c.start, c.end).match(INPUT_RE) ?? []).length;
    const above = lines.slice(Math.max(0, c.line - 1 - SIBLING_LINES), c.line - 1).join('\n');
    c.siblingInput = INPUT_RE.test(above);
    INPUT_RE.lastIndex = 0;
    c.underKeyboard = c.inputs > 0 || c.siblingInput;
  }
  // Nested inside one that is under the keyboard: so is this one. To a
  // fixpoint, since the ancestor may itself be flagged by its ancestor.
  for (let pass = 0; pass < containers.length; pass += 1) {
    let grew = false;
    for (const c of containers) {
      if (c.underKeyboard) continue;
      if (containers.some((outer) => outer !== c && outer.underKeyboard && outer.start < c.start && c.end <= outer.end)) {
        c.underKeyboard = true;
        grew = true;
      }
    }
    if (!grew) break;
  }
  return containers
    .filter((c) => c.underKeyboard)
    .map(({ line, inputs, siblingInput, selfClosing, persists }) => ({ line, inputs, siblingInput, selfClosing, persists }));
}

module.exports = [
  {
    name: 'keyboard: every scroll container under a text input keeps taps alive',
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
    name: 'keyboard: the scan reads tags, judges each on its own attributes, and follows the keyboard down',
    run() {
      const shape = (source) => scrollContainersWithInputs(source).map((c) => [c.line, c.persists]);

      // A plain container, then the same with the prop.
      const bare = ['<View>', '  <ScrollView style={s.x}>', '    <TextInput value={v} />', '    <Pressable onPress={go} />', '  </ScrollView>', '</View>'].join('\n');
      assert.deepEqual(shape(bare), [[2, false]]);
      assert.deepEqual(shape(bare.replace('<ScrollView style={s.x}>', '<ScrollView style={s.x} keyboardShouldPersistTaps="handled">')), [[2, true]]);
      // The value counts: "never" is the default written out, and persists nothing.
      assert.deepEqual(shape(bare.replace('<ScrollView style={s.x}>', '<ScrollView style={s.x} keyboardShouldPersistTaps="never">')), [[2, false]]);
      assert.deepEqual(shape(bare.replace('<ScrollView style={s.x}>', "<ScrollView style={s.x} keyboardShouldPersistTaps='always'>")), [[2, true]]);

      // A multi-line self-closing FlatList whose header holds the input: the
      // container ends at its own `/>`, and the prop must sit on it. The
      // ScrollView after it follows the header's input.
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
      assert.deepEqual(shape(flat), [[1, false], [6, true]]);
      assert.deepEqual(shape(flat.replace('  data={rows}', '  data={rows}\n  keyboardShouldPersistTaps="handled"')), [[1, true], [7, true]]);

      // The prop on an element NESTED INSIDE a prop of the self-closing
      // container is that element's, not the container's (the library
      // browser's shape).
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
      assert.deepEqual(shape(nestedProp), [[1, false], [6, true]], "the chip row's prop must not vouch for the FlatList");
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

      // The keyboard follows the nesting DOWN too: a chip row below the
      // field, inside the same scroll view, holds no input of its own and is
      // under the keyboard all the same (Workouts' filter chips, the template
      // editor's preset row).
      const chips = [
        '<ScrollView keyboardShouldPersistTaps="handled">',
        '  <TextInput value={q} />',
        '  <Text>a great many lines of other content</Text>',
        ...Array.from({ length: 20 }, () => '  <Text />'),
        '  <ScrollView horizontal>',
        '    <Pressable onPress={pick} />',
        '  </ScrollView>',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(chips), [[1, true], [24, false]], 'a scroller inside a container under the keyboard is under it too');
      assert.deepEqual(shape(chips.replace('<ScrollView horizontal>', '<ScrollView horizontal keyboardShouldPersistTaps="handled">')), [[1, true], [24, true]]);

      // A self-closing container of the same name nested inside a paired one
      // has no close tag: the outer span must still end at its own close,
      // not run to the end of the file and swallow a container far below.
      const selfClosedInner = [
        '<ScrollView>',
        '  <TextInput value={q} />',
        '  <ScrollView horizontal keyboardShouldPersistTaps="handled" />',
        '</ScrollView>',
        ...Array.from({ length: 45 }, () => '<Text />'),
        '<ScrollView>',
        '  <Text>far from any input</Text>',
        '</ScrollView>',
      ].join('\n');
      assert.deepEqual(shape(selfClosedInner), [[1, false], [3, true]], 'the outer span ran past its close tag');

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
