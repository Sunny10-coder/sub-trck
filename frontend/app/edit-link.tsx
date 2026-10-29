import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll } from "@/src/lib/api";
import { CATEGORIES } from "@/src/lib/format";
import { AppHeader, PrimaryButton } from "@/src/components/ui";
import { FormScroll, SelectField, TextField } from "@/src/components/form";
import { makeStyles } from "@/src/theme";

export default function EditLink() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [f, setF] = useState<any>({
    title: "",
    url: "",
    category: "Other",
    note: "",
    summary: "",
  });
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api
      .link(id)
      .then((row) => {
        setF({
          title: row.title || "",
          url: row.url || "",
          category: row.category || "Other",
          note: row.note || "",
          summary: row.summary || "",
        });
      })
      .catch(() => {});
  }, [id]);

  const save = useMutation({
    mutationFn: () => api.updateLink(id!, f),
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader title="Edit saved item" back />
      <FormScroll>
        <TextField
          label="Title"
          value={f.title}
          onChangeText={set("title")}
          placeholder="What to check later"
          testID="link-title"
        />
        <TextField
          label="URL"
          value={f.url}
          onChangeText={set("url")}
          placeholder="https://… (optional)"
          testID="link-url"
        />
        <SelectField
          label="Category"
          options={[...CATEGORIES, "Check later"]}
          value={f.category}
          onChange={set("category")}
          testID="link-category"
        />
        <TextField
          label="Summary"
          value={f.summary}
          onChangeText={set("summary")}
          placeholder="What this is"
          multiline
          testID="link-summary"
        />
        <TextField
          label="Note"
          value={f.note}
          onChangeText={set("note")}
          placeholder="Why check later"
          multiline
          testID="link-note"
        />
      </FormScroll>
      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title="Save changes"
            icon="check"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!f.title}
            testID="link-save"
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
  bar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
