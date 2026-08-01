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

      // Flat design tokens: solid purple pill, 56px tall, radius 18. The three
      // colours are the palette's own now (theme migration 2026-08-01) rather
      // than local copies of it, so the CTA can follow a theme change.
      assert.match(componentSource, /useThemedStyles\(makeStyles\)/);
      assert.match(componentSource, /backgroundColor: theme\.purpleBright/);
      assert.match(componentSource, /backgroundColor: theme\.purpleLight/);
      assert.match(componentSource, /color: theme\.faint/);
      assert.match(componentSource, /height: 56/);
      assert.match(componentSource, /borderRadius: 18/);
      assert.match(componentSource, /shadowOpacity: 0\.32/);
      assert.match(componentSource, /shadowRadius: 14/);
      assert.match(componentSource, /shadowOffset: \{ width: 0, height: 14 \}/);
      assert.match(componentSource, /fontSize: 17/);
      assert.match(componentSource, /fontWeight: '800'/);

      // Disabled state swaps colors instead of fading opacity.
      assert.match(componentSource, /buttonDisabled:\s*\{[\s\S]*backgroundColor: theme.purpleLight[\s\S]*shadowOpacity: 0[\s\S]*elevation: 0/);
      assert.match(componentSource, /labelDisabled:\s*\{[\s\S]*color: theme\.faint/);

      // No gradient remnants and no forced uppercase.
      assert.doesNotMatch(componentSource, /LinearGradient|Svg|gradientStops|toUpperCase|textTransform/);

      // Press feedback stays subtle (slight opacity/scale).
      assert.match(componentSource, /Animated\.timing\(pressProgress/);
      assert.match(componentSource, /outputRange: \[1, 0\.98\]/);
      assert.match(componentSource, /outputRange: \[1, 0\.92\]/);

      // Welcome no longer has a local CTA of its own: the Vinha design cut the
      // email sign-up, the feature row and the account link, leaving the two
      // providers and the tagline (2026-08-01). It still must not reach for
      // PrimaryCTAButton — that one belongs to onboarding.
      assert.doesNotMatch(welcomeSource, /PrimaryCTAButton/);
      assert.doesNotMatch(welcomeSource, /welcome\.signUpEmail/);
      assert.doesNotMatch(welcomeSource, /welcome\.haveAccount/);
      assert.doesNotMatch(welcomeSource, /welcome\.feature\./);
    },
  },
];
