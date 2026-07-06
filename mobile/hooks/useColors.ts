import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the active theme.
 *
 * The user's preference (Settings → Appearance) wins; "system" follows the
 * device appearance setting, defaulting to dark when it can't be determined.
 */
export function useColors() {
  const scheme = useColorScheme();
  const { preference } = useTheme();

  const effective =
    preference === "system" ? (scheme === "light" ? "light" : "dark") : preference;

  const palette = effective === "light" ? colors.light : colors.dark;
  return { ...palette, radius: colors.radius };
}
