import { Platform, StyleProp, ViewStyle } from 'react-native';

/**
 * Apple's own "Continue with Apple" button. App Review wants the system
 * button, or a copy of it to the letter (HIG, Sign in with Apple), and the
 * system one is the only way to be sure of that.
 *
 * Renders nothing where the native module is absent: Android, web, and an
 * iPhone build from before it was added — same lazy rule as appleAuth.
 */
type ButtonStyleName = 'white' | 'whiteOutline' | 'black';

interface AppleButtonModule {
  AppleAuthenticationButton: React.ComponentType<{
    buttonType: number;
    buttonStyle: number;
    cornerRadius?: number;
    style?: StyleProp<ViewStyle>;
    onPress: () => void;
  }>;
}

// The library's enum values (AppleAuthentication.types).
const BUTTON_TYPE_CONTINUE = 1;
const BUTTON_STYLES: Record<ButtonStyleName, number> = { white: 0, whiteOutline: 1, black: 2 };

function loadButton(): AppleButtonModule['AppleAuthenticationButton'] | null {
  if (Platform.OS !== 'ios') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('expo-apple-authentication') as AppleButtonModule).AppleAuthenticationButton ?? null;
  } catch {
    return null;
  }
}

export function AppleSignInButton({
  onPress,
  disabled = false,
  variant = 'white',
  cornerRadius = 16,
  height = 52,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonStyleName;
  cornerRadius?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const Button = loadButton();
  if (!Button) {
    return null;
  }
  return (
    <Button
      buttonType={BUTTON_TYPE_CONTINUE}
      buttonStyle={BUTTON_STYLES[variant]}
      cornerRadius={cornerRadius}
      // The native button has no disabled state of its own; a press while
      // busy is dropped, and the dimming says so.
      style={[{ height, alignSelf: 'stretch' }, disabled && { opacity: 0.4 }, style]}
      onPress={() => {
        if (!disabled) {
          onPress();
        }
      }}
    />
  );
}
