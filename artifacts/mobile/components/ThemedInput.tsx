import React from "react";
import { Platform, TextInput, type TextInputProps } from "react-native";

const webStyle =
  Platform.OS === "web"
    ? ({
        backgroundColor: "transparent",
        outlineStyle: "none",
      } as any)
    : {};

const ThemedInput = React.forwardRef<TextInput, TextInputProps>(
  ({ style, ...props }, ref) => {
    return <TextInput ref={ref} style={[webStyle, style]} {...props} />;
  }
);

ThemedInput.displayName = "ThemedInput";

export default ThemedInput;
