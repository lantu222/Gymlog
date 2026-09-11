const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');

/**
 * The word a kettlebell row prints, and the chip that has to select it.
 *
 * `displayEquipmentValue` is unit-tested next door in tests/lib — that suite
 * proves the rule returns "kettlebells" for the 54 exercises the library files
 * under `dumbbell`. It says nothing about whether any screen calls it, and a
 * rule nothing calls is the failure mode this project keeps meeting: the call
 * exists, the behaviour never arrives.
 *
 * Three surfaces have to agree, and each one of them was wrong at some point
 * in the same afternoon:
 *   · the row's subtitle, which said "Käsipainot" under kahvakuula steps
 *   · the filter chips, which had no chip that selects them and one that
 *     returned them under the wrong word
 *   · the search haystack, which made 15 of them unfindable by the word the
 *     row had just started printing
 */
module.exports = [
  {
    name: 'equipment label: both browse surfaces print the displayed value, not the stored bucket',
    run() {
      for (const file of ['src/components/ExerciseLibraryBrowser.tsx', 'src/components/AddExerciseSheet.tsx']) {
        const source = read(file);
        assert.match(
          source,
          /import \{[^}]*displayEquipmentValue[^}]*\} from '\.\.\/lib\/libraryLabel'/,
          `${file} does not import the rule`,
        );
        assert.match(
          source,
          /Label\(displayEquipmentValue\(item\), language\)/,
          `${file} still labels item.equipment directly`,
        );
      }
    },
  },
  {
    name: 'equipment label: the filter selects by the same value the row shows',
    run() {
      // A chip built from `item.equipment` while the row prints something else
      // is a filter that argues with its own list.
      const browser = read('src/components/ExerciseLibraryBrowser.tsx');
      assert.match(browser, /items\.map\(\(item\) => displayEquipmentValue\(item\)\)/);
      assert.match(browser, /displayEquipmentValue\(item\) !== equipmentFilter/);

      const sheet = read('src/components/AddExerciseSheet.tsx');
      assert.match(sheet, /displayEquipmentValue\(item\) !== equipment/);
      // The sheet's chip list is hardcoded rather than derived, so the value
      // has to be named in it explicitly or there is no chip to tap.
      assert.match(sheet, /const equipmentOptions: SheetEquipmentOption\[\] = \[[^\]]*'kettlebells'/s);
      assert.match(sheet, /kettlebells: 'lib\.equipment\.kettlebells'/);
    },
  },
  {
    name: 'equipment label: search finds the word the row prints',
    run() {
      const search = read('src/lib/exerciseSearch.ts');
      assert.match(search, /displayEquipmentValue\(item\)/);
      // Additive, not a replacement: "käsipaino" was a working query before
      // this and has to stay one.
      assert.match(search, /item\.equipment, displayEquipmentValue\(item\)/);
    },
  },
];
