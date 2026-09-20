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
 * The scan is textual: every `<ScrollView` / `<FlatList` range in
 * src/screens and src/components that contains a `<TextInput` must contain
 * `keyboardShouldPersistTaps`. Run against the tree before the fix it names
 * six containers; a container added later without the prop lands here too.
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

/** Scroll containers with a text input inside, and whether each persists taps. */
function scrollContainersWithInputs(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const open = [];
  const found = [];
  lines.forEach((line, index) => {
    if (/<(ScrollView|FlatList|SectionList)\b/.test(line)) {
      open.push({ line: index + 1, inputs: 0, persists: false });
    }
    for (const container of open) {
      if (/<TextInput\b/.test(line)) container.inputs += 1;
      if (/keyboardShouldPersistTaps/.test(line)) container.persists = true;
    }
    if (/<\/(ScrollView|FlatList|SectionList)>/.test(line) || /<(ScrollView|FlatList|SectionList)\b[^>]*\/>/.test(line)) {
      const container = open.pop();
      if (container && container.inputs > 0) found.push(container);
    }
  });
  // A container the file never closes is still a container.
  for (const container of open) if (container.inputs > 0) found.push(container);
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
    // The scanner, on a fixture, so a passing tree cannot be a scanner that sees nothing.
    name: 'keyboard: the scan finds an input inside a container and respects the prop',
    run() {
      const bare = ['<View>', '  <ScrollView style={s.x}>', '    <TextInput value={v} />', '    <Pressable onPress={go} />', '  </ScrollView>', '</View>'].join('\n');
      assert.deepEqual(scrollContainersWithInputs(bare).map((c) => [c.line, c.persists]), [[2, false]]);
      const fixed = bare.replace('<ScrollView style={s.x}>', '<ScrollView style={s.x} keyboardShouldPersistTaps="handled">');
      assert.deepEqual(scrollContainersWithInputs(fixed).map((c) => [c.line, c.persists]), [[2, true]]);
      // No input, no requirement — a plain list is not the case.
      assert.deepEqual(scrollContainersWithInputs('<FlatList data={d} />\n<ScrollView>\n<Text />\n</ScrollView>'), []);
    },
  },
];
