import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader, Card, ChipRow, EmptyState, Icon, PrimaryButton, SearchField } from "@/src/components/ui";
import { api, useInvalidateAll, usePrompts } from "@/src/lib/api";
import { makeStyles, useTheme } from "@/src/theme";

// Prompt Vault: prompts the user saves to reuse in OTHER tools (Midjourney, Runway, Cursor...).
const CATEGORIES: { label: string; icon: string; tone: string }[] = [
  { label: "Image Generation", icon: "image-outline", tone: "#EC4899" },
  { label: "Video Generation", icon: "video-outline", tone: "#F43F5E" },
  { label: "App Making", icon: "code-braces", tone: "#3B82F6" },
  { label: "Coding", icon: "console", tone: "#06B6D4" },
  { label: "Writing", icon: "pencil-outline", tone: "#8B5CF6" },
  { label: "Music & Voice", icon: "waveform", tone: "#10B981" },
  { label: "Research", icon: "magnify-scan", tone: "#F59E0B" },
  { label: "Other", icon: "creation", tone: "#94A3B8" },
];
const TOOLS = ["ChatGPT", "Claude", "Gemini", "Midjourney", "Runway", "Kling", "Sora", "Veo", "Leonardo", "ElevenLabs", "Suno", "Cursor", "Lovable", "Replit", "Other"];
const catOf = (label: string) => CATEGORIES.find((c) => c.label === label) || CATEGORIES[CATEGORIES.length - 1];

export default function PromptsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const invalidate = useInvalidateAll();

  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [category, setCategory] = useState("Image Generation");
  const [tool, setTool] = useState("Midjourney");
  const [tagsText, setTagsText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const promptsQuery = usePrompts(activeCategory === "All" ? undefined : activeCategory, query);
  const rows = promptsQuery.data || [];

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!res.canceled && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        prompt: promptText.trim(),
        category,
        tool,
        tags: tagsText.split(/[,#\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
        link_url: linkUrl.trim() || null,
        photo_url: photoUri || null,
        icon: catOf(category).icon,
      };
      return editingId ? api.updatePrompt(editingId, body) : api.createPrompt(body);
    },
    onSuccess: () => {
      invalidate();
      closeModal();
    },
    onError: (e) => Alert.alert("Could not save", e instanceof Error ? e.message : "Try again."),
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.deletePrompt(id), onSuccess: invalidate });
  const favMutation = useMutation({
    mutationFn: (item: any) => api.updatePrompt(item.id, { favorite: !item.favorite }),
    onSuccess: invalidate,
  });

  const openAdd = () => {
    setEditingId(null);
    setTitle("");
    setPromptText("");
    setCategory(activeCategory !== "All" ? activeCategory : "Image Generation");
    setTool("Midjourney");
    setTagsText("");
    setLinkUrl("");
    setPhotoUri(null);
    setModalVisible(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title);
    setPromptText(item.prompt);
    setCategory(item.category || "Other");
    setTool(item.tool || "Other");
    setTagsText((item.tags || []).join(", "));
    setLinkUrl(item.link_url || "");
    setPhotoUri(item.photo_url || null);
    setModalVisible(true);
  };

  const copy = async (item: any) => {
    await Clipboard.setStringAsync(item.prompt);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 1800);
  };

  const confirmDelete = (item: any) =>
    Alert.alert("Delete prompt", `Remove "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
    ]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Prompt Vault"
        subtitle="Prompts you saved for your AI tools"
        back
        right={
          <Pressable onPress={openAdd} style={styles.addBtn} hitSlop={8} testID="add-prompt-btn">
            <Icon name="plus" size={20} color={colors.brandPrimary} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 6 }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search prompt, tool or #tag…" />
      </View>
      <ChipRow
        items={[{ label: "All", value: "All" }, ...CATEGORIES.map((c) => ({ label: c.label, value: c.label, tone: c.tone, icon: c.icon }))]}
        value={activeCategory}
        onChange={setActiveCategory}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {rows.length === 0 ? (
          <EmptyState
            icon="creation"
            title={query || activeCategory !== "All" ? "No prompts found" : "Your prompt vault is empty"}
            message="Save the prompts that worked in Midjourney, Runway, Cursor… so you can reuse them any time."
            action={<PrimaryButton title="Save a prompt" icon="plus" onPress={openAdd} />}
          />
        ) : (
          rows.map((item: any) => {
            const cat = catOf(item.category);
            return (
              <Card key={item.id} style={[styles.promptCard, { borderColor: cat.tone + "66" }]}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconBox, { backgroundColor: cat.tone + "28" }]}>
                    <Icon name={cat.icon} size={20} color={cat.tone} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promptTitle}>{item.title}</Text>
                    <View style={styles.badgeRow}>
                      {item.tool ? (
                        <View style={[styles.badge, { backgroundColor: cat.tone + "28" }]}>
                          <Text style={[styles.badgeText, { color: cat.tone }]}>{item.tool}</Text>
                        </View>
                      ) : null}
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.category || "Other"}</Text>
                      </View>
                    </View>
                  </View>
                  <Pressable onPress={() => favMutation.mutate(item)} hitSlop={8} style={styles.iconBtn}>
                    <Icon name={item.favorite ? "star" : "star-outline"} size={18} color={item.favorite ? colors.accentYellow : colors.muted} />
                  </Pressable>
                  <Pressable onPress={() => openEdit(item)} hitSlop={8} style={styles.iconBtn}>
                    <Icon name="pencil-outline" size={18} color={colors.muted} />
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={styles.iconBtn}>
                    <Icon name="delete-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>

                <Text style={styles.promptBody}>{item.prompt}</Text>

                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.promptImage} contentFit="cover" /> : null}

                {item.tags?.length ? (
                  <View style={styles.badgeRow}>
                    {item.tags.slice(0, 6).map((t: string) => (
                      <Pressable key={t} onPress={() => setQuery(`#${t}`)}>
                        <Text style={styles.tag}>#{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <View style={styles.footer}>
                  <Pressable style={[styles.copyBtn, { backgroundColor: copiedId === item.id ? colors.success : cat.tone }]} onPress={() => copy(item)} testID={`copy-prompt-${item.id}`}>
                    <Icon name={copiedId === item.id ? "check" : "content-copy"} size={16} color="#FFFFFF" />
                    <Text style={styles.copyText}>{copiedId === item.id ? "Copied" : "Copy prompt"}</Text>
                  </Pressable>
                  {item.link_url ? (
                    <Pressable style={styles.openBtn} onPress={() => WebBrowser.openBrowserAsync(item.link_url).catch(() => {})}>
                      <Icon name="open-in-new" size={16} color={colors.brandPrimary} />
                      <Text style={styles.openText}>Open tool</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{editingId ? "Edit prompt" : "Save a prompt"}</Text>
              <Pressable onPress={closeModal} hitSlop={8}>
                <Icon name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Neon city night shot" placeholderTextColor={colors.muted} />

              <Text style={styles.label}>Used for</Text>
              <ChipRow items={CATEGORIES.map((c) => ({ label: c.label, value: c.label, tone: c.tone }))} value={category} onChange={setCategory} />

              <Text style={styles.label}>Tool it is for</Text>
              <ChipRow items={TOOLS} value={tool} onChange={setTool} />

              <Text style={styles.label}>Prompt *</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                value={promptText}
                onChangeText={setPromptText}
                placeholder="Paste the full prompt, parameters and settings…"
                placeholderTextColor={colors.muted}
                multiline
              />

              <Text style={styles.label}>Tags (comma separated)</Text>
              <TextInput style={styles.input} value={tagsText} onChangeText={setTagsText} placeholder="portrait, cinematic, 4k" placeholderTextColor={colors.muted} autoCapitalize="none" />

              <Text style={styles.label}>Tool / reference link (optional)</Text>
              <TextInput style={styles.input} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://…" placeholderTextColor={colors.muted} keyboardType="url" autoCapitalize="none" />

              <Text style={styles.label}>Sample output (optional)</Text>
              {photoUri ? (
                <View>
                  <Image source={{ uri: photoUri }} style={styles.promptImage} contentFit="cover" />
                  <Pressable onPress={() => setPhotoUri(null)} style={styles.removePhoto}>
                    <Icon name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={pickImage} style={styles.upload}>
                  <Icon name="image-plus" size={20} color={colors.brandPrimary} />
                  <Text style={styles.openText}>Add a sample image</Text>
                </Pressable>
              )}

              <PrimaryButton
                title={editingId ? "Update prompt" : "Save prompt"}
                icon="content-save-outline"
                onPress={() => saveMutation.mutate()}
                disabled={!title.trim() || !promptText.trim()}
                loading={saveMutation.isPending}
                style={{ marginTop: 10 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  addBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.glass, borderWidth: 1.5,
    borderColor: colors.glassBorder, alignItems: "center", justifyContent: "center",
  },
  promptCard: { gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 4 },
  iconBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  promptTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" },
  badge: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800" },
  tag: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  promptBody: { color: colors.onSurface, fontSize: 13, lineHeight: 20, opacity: 0.92 },
  promptImage: { width: "100%", height: 160, borderRadius: 14 },
  footer: { flexDirection: "row", gap: 8 },
  copyBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 12 },
  copyText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  openBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: colors.glass, borderWidth: 1.5, borderColor: colors.glassBorder,
  },
  openText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSolid, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20,
    maxHeight: "92%", borderWidth: 1.5, borderColor: colors.glassBorder,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "800" },
  label: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "800", marginTop: 6 },
  input: {
    backgroundColor: colors.glass, borderWidth: 1.5, borderColor: colors.glassBorder, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.onSurface,
  },
  upload: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong,
  },
  removePhoto: {
    position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },
}));
