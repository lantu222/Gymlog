const assert = require('assert');
const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
const hapticsSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'utils', 'haptics.ts'), 'utf8');
const onboardingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'), 'utf8');

module.exports = [
  {
    name: 'expo haptics are installed behind a safe reusable helper',
    run() {
      assert.match(packageJson.dependencies['expo-haptics'], /^~/);
      assert.match(hapticsSource, /import \* as Haptics from 'expo-haptics'/);
      assert.match(hapticsSource, /Platform\.OS === 'web'/);
      assert.match(hapticsSource, /try \{[\s\S]*await action\(\);[\s\S]*\} catch \{/);
      assert.match(hapticsSource, /select: \(\) => runSafely\(\(\) => Haptics\.selectionAsync\(\)\)/);
      assert.match(hapticsSource, /success: \(\) => runSafely\(\(\) => Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Success\)\)/);
      assert.match(hapticsSource, /error: \(\) => runSafely\(\(\) => Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Error\)\)/);
      assert.match(hapticsSource, /impactLight: \(\) => runSafely\(\(\) => Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)\)/);
      assert.match(hapticsSource, /impactMedium: \(\) => runSafely\(\(\) => Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Medium\)\)/);
    },
  },
  {
    name: 'onboarding uses haptics for intentional user actions without React Native Vibration',
    run() {
      assert.match(onboardingSource, /import \{ haptics \} from '\.\.\/utils\/haptics'/);
      assert.doesNotMatch(onboardingSource, /Vibration/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*setSelectedLocationOptionId\(option\.id\)/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*toggleGoal\(option\.id\)/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*toggleFocusArea\(option\.area\)/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*setLevel\(option\.level\)/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*setDaysPerWeek\(option\)/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*setCautionFlags/);
      assert.match(onboardingSource, /if \(stage === 'planning'\) \{[\s\S]*void haptics\.impactMedium\(\);/);
      assert.match(onboardingSource, /void haptics\.success\(\);[\s\S]*setIsBuildingPlan\(false\)/);
    },
  },
];
