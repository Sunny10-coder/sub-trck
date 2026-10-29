import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll } from "@/src/lib/api";
import { AppHeader, Card, Icon, PrimaryButton } from "@/src/components/ui";
import { FormScroll, TextField } from "@/src/components/form";
import { makeStyles, useTheme } from "@/src/theme";

export default function AddNote() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const [text, setText] = useState("");

  const save = useMutation({
    mutationFn: () => api.ingestText(text.trim(), "note"),
    onSuccess: () => {
      invalidate();
      router.replace("/(tabs)/inbox");
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title="Add a Quick Note"
        subtitle="Unstructured text auto-parsed by AI"
        back
      />
      <FormScroll>
        <Card style={styles.hint}>
          <View style={styles.hintIconBox}>
            <Icon name="creation" size={18} color={colors.brandSecondary} />
          </View>
          <Text style={styles.hintText}>
            Type or paste any subscription info, renewal date or promo code. AI will
            interpret and file it into your inbox.
          </Text>
        </Card>
        <Card style={styles.card}>
          <TextField
            label="Your Note"
            value={text}
            onChangeText={setText}
            placeholder="e.g. Notion Plus AED 40/month, renewing on Nov 3, charged to Amex…"
            multiline
            testID="note-text"
          />
        </Card>
      </FormScroll>
      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title="Process with AI"
            icon="creation"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!text.trim()}
            testID="note-save"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  card: {
    padding: 18,
  },
  hint: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.pastelLavender,
    borderColor: colors.brandSecondary + "33",
    padding: 14,
  },
  hintIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  bar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
