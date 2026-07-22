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
    name: 'PrimaryCTAButton is the flat light-theme purple CTA from the redesign',
    run() {
      assert.match(componentSource, /interface PrimaryCTAButtonProps/);
      assert.match(componentSource, /title: string/);
      assert.match(componentSource, /disabled\?: boolean/);
      assert.match(componentSource, /style\?: StyleProp<ViewStyle>/);
      assert.match(componentSource, /export function PrimaryCTAButton/);

      // Flat design tokens: solid purple pill, 56px tall, radius 18.
      assert.match(componentSource, /const CTA_PURPLE = '#7C3AED'/);
      assert.match(componentSource, /const CTA_DISABLED_BG = '#E3DAF5'/);
      assert.match(componentSource, /const CTA_DISABLED_TEXT = '#9A93AC'/);
      assert.match(componentSource, /height: 56/);
      assert.match(componentSource, /borderRadius: 18/);
      assert.match(componentSource, /shadowOpacity: 0\.32/);
      assert.match(componentSource, /shadowRadius: 14/);
      assert.match(componentSource, /shadowOffset: \{ width: 0, height: 14 \}/);
      assert.match(componentSource, /fontSize: 17/);
      assert.match(componentSource, /fontWeight: '800'/);

      // Disabled state swaps colors instead of fading opacity.
      assert.match(componentSource, /buttonDisabled:\s*\{[\s\S]*backgroundColor: CTA_DISABLED_BG[\s\S]*shadowOpacity: 0[\s\S]*elevation: 0/);
      assert.match(componentSource, /labelDisabled:\s*\{[\s\S]*color: CTA_DISABLED_TEXT/);

      // No gradient remnants and no forced uppercase.
      assert.doesNotMatch(componentSource, /LinearGradient|Svg|gradientStops|toUpperCase|textTransform/);

      // Press feedback stays subtle (slight opacity/scale).
      assert.match(componentSource, /Animated\.timing\(pressProgress/);
      assert.match(componentSource, /outputRange: \[1, 0\.98\]/);
      assert.match(componentSource, /outputRange: \[1, 0\.92\]/);

      // Redesigned welcome renders its own local flat CTA (email sign-up).
      // Copy moved to the i18n dictionary; the screen renders it via t().
      assert.doesNotMatch(welcomeSource, /PrimaryCTAButton/);
      assert.match(welcomeSource, /t\(language, 'welcome\.signUpEmail'\)/);
      assert.match(welcomeSource, /backgroundColor: PURPLE/);
    },
  },
];
