const assert = require('assert');
const fs = require('fs');
const path = require('path');

const componentSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'PrimaryCTAButton.tsx'),
  'utf8',
);
const welcomeSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'WelcomeScreen.tsx'),
  'utf8',
);

module.exports = [
  {
    name: 'PrimaryCTAButton defines reusable premium gradient CTA; welcome uses its own flat light-theme CTA',
    run() {
      assert.match(componentSource, /import Svg, \{ Defs, LinearGradient, Rect, Stop \} from 'react-native-svg'/);
      assert.match(componentSource, /interface PrimaryCTAButtonProps/);
      assert.match(componentSource, /title: string/);
      assert.match(componentSource, /disabled\?: boolean/);
      assert.match(componentSource, /style\?: StyleProp<ViewStyle>/);
      assert.match(componentSource, /export function PrimaryCTAButton/);
      assert.match(componentSource, /title\.toUpperCase\(\)/);
      assert.match(componentSource, /\{ offset: '0', color: '#5F4EE8' \}/);
      assert.match(componentSource, /\{ offset: '0\.52', color: '#8B5CF6' \}/);
      assert.match(componentSource, /\{ offset: '1', color: '#D06CFF' \}/);
      assert.match(componentSource, /fill="url\(#primaryCtaGradient\)"/);
      assert.match(componentSource, /fill="url\(#primaryCtaBloom\)"/);
      assert.match(componentSource, /shadowColor: '#8B5CF6'/);
      assert.match(componentSource, /shadowOpacity: 0\.14/);
      assert.match(componentSource, /shadowRadius: 20/);
      assert.match(componentSource, /shadowOffset: \{ width: 0, height: 8 \}/);
      assert.match(componentSource, /elevation: 8/);
      assert.match(componentSource, /width: '90%'/);
      assert.match(componentSource, /height: 64/);
      assert.match(componentSource, /borderRadius: 32/);
      assert.match(componentSource, /buttonDisabled:\s*\{[\s\S]*opacity: 0\.45[\s\S]*shadowOpacity: 0[\s\S]*elevation: 0/);
      assert.match(componentSource, /overflow: 'hidden'/);
      assert.match(componentSource, /backgroundColor: 'rgba\(255,255,255,0\.08\)'/);
      assert.match(componentSource, /Animated\.timing\(pressProgress/);
      assert.match(componentSource, /duration: 120/);
      assert.match(componentSource, /outputRange: \[1, 0\.98\]/);
      assert.match(componentSource, /outputRange: \[1, 0\.92\]/);
      assert.match(componentSource, /topEdgeHighlight/);
      assert.match(componentSource, /height: 2/);
      assert.match(componentSource, /opacity: 0\.3/);
      assert.match(componentSource, /fontSize: 16/);
      assert.match(componentSource, /fontWeight: '700'/);
      assert.match(componentSource, /letterSpacing: 1\.2/);
      assert.match(componentSource, /textTransform: 'uppercase'/);
      assert.doesNotMatch(componentSource, /expo-linear-gradient|GymlogIcon|Phosphor|Arrow|Chevron|rightCapFill|borderWidth:/);
      // Redesigned welcome (light theme) renders its own flat purple CTA instead of the gradient button.
      assert.doesNotMatch(welcomeSource, /PrimaryCTAButton/);
      assert.match(welcomeSource, /Start free/);
      assert.match(welcomeSource, /backgroundColor: PURPLE/);
    },
  },
];
