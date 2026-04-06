import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { type Href, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_CATEGORIES, CATEGORY_CONFIG } from "@/constants/categories";
import { useApp, type Category, type VotingType } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addTopic } = useApp();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [votingTypes, setVotingTypes] = useState<VotingType[]>(["yesno"]);
  const [rankOptions, setRankOptions] = useState<string[]>(["", ""]);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const needsRankOptions = votingTypes.includes("ranking");

  function toggleVotingType(vt: VotingType) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotingTypes((prev) =>
      prev.includes(vt)
        ? prev.length === 1
          ? prev
          : prev.filter((v) => v !== vt)
        : [...prev, vt]
    );
  }

  function updateRankOption(idx: number, text: string) {
    setRankOptions((prev) => prev.map((o, i) => (i === idx ? text : o)));
  }

  function addRankOption() {
    if (rankOptions.length >= 8) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRankOptions((prev) => [...prev, ""]);
    setTimeout(() => {
      inputRefs.current[rankOptions.length]?.focus();
    }, 80);
  }

  function removeRankOption(idx: number) {
    if (rankOptions.length <= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRankOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (!isSignedIn) {
      router.replace("/(auth)/sign-in" as Href);
      return;
    }
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a topic title.");
      return;
    }
    const validRankOpts = rankOptions.filter((o) => o.trim());
    if (needsRankOptions && validRankOpts.length < 2) {
      Alert.alert("Ranking options", "Add at least 2 options for ranking.");
      return;
    }
    const isPremium = (user?.unsafeMetadata as any)?.isPremium === true;
    const accountType = isPremium
      ? (user?.unsafeMetadata as any)?.accountType
      : undefined;
    addTopic(
      {
        title: title.trim(),
        description: description.trim(),
        category,
        votingTypes,
        rankingOptions: needsRankOptions
          ? validRankOpts.map((label, i) => ({
              id: `opt_${i}_${Date.now()}`,
              label: label.trim(),
            }))
          : undefined,
      },
      accountType
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>New Topic</Text>
        <Pressable
          onPress={submit}
          style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.submitLabel}>Post</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.form,
          { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={s.field}>
          <Text style={s.label}>Topic Title *</Text>
          <TextInput
            style={s.input}
            placeholder="What's your opinion on..."
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            multiline
          />
          <Text style={s.charCount}>{title.length}/120</Text>
        </View>

        {/* Description */}
        <View style={s.field}>
          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="Add more context (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            multiline
          />
        </View>

        {/* Category */}
        <View style={s.field}>
          <Text style={s.label}>Category</Text>
          <View style={s.catGrid}>
            {ALL_CATEGORIES.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    s.catChip,
                    active && {
                      backgroundColor: cfg.color + "33",
                      borderColor: cfg.color,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(cat);
                  }}
                >
                  <Feather
                    name={cfg.icon as any}
                    size={13}
                    color={active ? cfg.color : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      s.catLabel,
                      active && { color: cfg.color, fontWeight: "700" },
                    ]}
                  >
                    {cfg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Voting Types */}
        <View style={s.field}>
          <Text style={s.label}>Voting Types</Text>
          <Text style={s.sublabel}>Choose how people can vote</Text>
          <View style={s.voteTypeRow}>
            {(
              [
                { vt: "yesno" as VotingType, icon: "thumbs-up", label: "Yes / No" },
                { vt: "rating" as VotingType, icon: "star", label: "Star Rating" },
                { vt: "ranking" as VotingType, icon: "list", label: "Ranking" },
              ] as const
            ).map(({ vt, icon, label }) => {
              const active = votingTypes.includes(vt);
              return (
                <Pressable
                  key={vt}
                  style={[
                    s.voteTypeBtn,
                    active && {
                      backgroundColor: colors.primary + "22",
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => toggleVotingType(vt)}
                >
                  <Feather
                    name={icon as any}
                    size={20}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      s.voteTypeLabel,
                      active && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    {label}
                  </Text>
                  {active && (
                    <Feather name="check" size={14} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Ranking Options */}
        {needsRankOptions && (
          <View style={s.field}>
            <Text style={s.label}>Ranking Options</Text>
            <Text style={s.sublabel}>Add 2–8 items for people to rank</Text>
            <View style={s.rankOptions}>
              {rankOptions.map((opt, idx) => (
                <View key={idx} style={s.rankOptionRow}>
                  <View style={s.rankBadge}>
                    <Text style={s.rankBadgeNum}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[idx] = ref;
                    }}
                    style={s.rankOptionInput}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={opt}
                    onChangeText={(t) => updateRankOption(idx, t)}
                    returnKeyType={idx < rankOptions.length - 1 ? "next" : "done"}
                    onSubmitEditing={() => {
                      if (idx < rankOptions.length - 1) {
                        inputRefs.current[idx + 1]?.focus();
                      } else if (rankOptions.length < 8) {
                        addRankOption();
                      }
                    }}
                    blurOnSubmit={false}
                  />
                  {rankOptions.length > 2 && (
                    <Pressable
                      onPress={() => removeRankOption(idx)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        s.removeBtn,
                        pressed && { opacity: 0.5 },
                      ]}
                    >
                      <Feather
                        name="x"
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  )}
                </View>
              ))}

              {rankOptions.length < 8 && (
                <Pressable
                  style={({ pressed }) => [
                    s.addOptionBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={addRankOption}
                >
                  <Feather
                    name="plus-circle"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={s.addOptionText}>Add another option</Text>
                  <Text style={s.addOptionCount}>
                    {rankOptions.length}/8
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
    },
    submitBtn: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 100,
    },
    submitLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    form: {
      padding: 16,
      gap: 24,
    },
    field: { gap: 8 },
    label: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sublabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: -4,
    },
    input: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputMulti: { minHeight: 80, textAlignVertical: "top" },
    charCount: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "right",
    },
    catGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    catChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },
    catLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    voteTypeRow: {
      gap: 8,
    },
    voteTypeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    voteTypeLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: colors.foreground,
    },
    rankOptions: { gap: 8 },
    rankOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    rankBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    rankBadgeNum: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    rankOptionInput: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    removeBtn: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    addOptionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + "55",
      borderStyle: "dashed",
      marginTop: 2,
    },
    addOptionText: {
      flex: 1,
      fontSize: 14,
      color: colors.primary,
      fontWeight: "600",
    },
    addOptionCount: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
  });
