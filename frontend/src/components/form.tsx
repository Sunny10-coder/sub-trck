import { ReactNode, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export function FormScroll({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 140, gap: 18 }}
      showsVerticalScrollIndicator={false}
      bottomOffset={20}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  testID,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  textContentType,
  helperText,
  error,
}: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        style={[
          styles.input,
          multiline && { height: 104, textAlignVertical: "top" },
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
        value={value === null || value === undefined ? "" : String(value)}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// Options are plain strings or {label, value} pairs (a bare object used to be
// rendered as a React child, which crashed the Add/Edit Subscription screens).
export function SelectField({ label, options, value, onChange, testID }: any) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optRow}>
        {options.map((option: any) => {
          const opt = typeof option === "string" ? { label: option, value: option } : option;
          return (
            <Chip
              key={String(opt.value)}
              label={opt.label}
              active={value === opt.value}
              onPress={() => onChange(opt.value)}
              testID={`${testID}-${opt.value}`}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  field: {
    gap: 8,
  },
  label: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 2,
    letterSpacing: -0.1,
  },
  input: {
    backgroundColor: colors.glass,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.onSurface,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  inputFocused: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.glassStrong,
  },
  inputError: {
    borderColor: colors.error,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 4,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  optRow: {
    gap: 8,
    paddingVertical: 2,
  },
}));
