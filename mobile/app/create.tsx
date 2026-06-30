import { useAuth, useUser } from "@clerk/expo";
import { Icon } from "@/components/Icon";
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
  View,
} from "react-native";
import ThemedInput from "@/components/ThemedInput";
import type { TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_CATEGORIES, CATEGORY_CONFIG } from "@/constants/categories";
import { useApp, type Category, type VotingType, type UserDemographics } from "@/context/AppContext";
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
  const [votingType, setVotingType] = useState<VotingType>("yesno");
  const [rankOptions, setRankOptions] = useState<string[]>(["", ""]);
  const [aspectItems, setAspectItems] = useState<string[]>(["Service", "Punctuality", "Staff", "Cleanliness", "Price", "Quality"]);
  const [tagsInput, setTagsInput] = useState("");
  const [targetAgeRange, setTargetAgeRange] = useState("");
  const [targetGender, setTargetGender] = useState("");
  const [targetOccupation, setTargetOccupation] = useState("");
  const [showTargeting, setShowTargeting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const aspectRefs = useRef<Array<TextInput | null>>([]);

  const needsRankOptions = votingType === "ranking";
  const needsAspects = votingType === "aspects";

  const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"];
  const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
  const OCCUPATIONS = ["Student", "Employed", "Self-employed", "Unemployed", "Retired"];

  const targetingCount = [targetAgeRange, targetGender, targetOccupation].filter(Boolean).length;

  const parsedTags = tagsInput
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  function selectVotingType(vt: VotingType) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotingType(vt);
  }

  function updateRankOption(idx: number, text: string) {
    setRankOptions((prev) => prev.map((o, i) => (i === idx ? text : o)));
  }

  function addRankOption() {
    if (rankOptions.length >= 8) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIdx = rankOptions.length;
    setRankOptions((prev) => [...prev, ""]);
    // Use captured index — avoids stale closure from setTimeout referencing
    // rankOptions.length which doesn't update until the next render
    requestAnimationFrame(() => {
      inputRefs.current[nextIdx]?.focus();
    });
  }

  function removeRankOption(idx: number) {
    if (rankOptions.length <= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRankOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAspectItem(idx: number, text: string) {
    setAspectItems((prev) => prev.map((a, i) => (i === idx ? text : a)));
  }

  function addAspectItem() {
    if (aspectItems.length >= 10) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIdx = aspectItems.length;
    setAspectItems((prev) => [...prev, ""]);
    requestAnimationFrame(() => {
      aspectRefs.current[nextIdx]?.focus();
    });
  }

  function removeAspectItem(idx: number) {
    if (aspectItems.length <= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAspectItems((prev) => prev.filter((_, i) => i !== idx));
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
    const validAspects = aspectItems.filter((a) => a.trim());
    if (needsAspects && validAspects.length < 2) {
      Alert.alert("Aspects", "Add at least 2 aspects for people to rate.");
      return;
    }
    const isPremium = (user?.unsafeMetadata as any)?.isPremium === true;
    const accountType = isPremium
      ? (user?.unsafeMetadata as any)?.accountType
      : undefined;
    const targetDemographics: UserDemographics | undefined =
      targetAgeRange || targetGender || targetOccupation
        ? {
            ageRange: targetAgeRange || undefined,
            gender: targetGender || undefined,
            occupation: targetOccupation || undefined,
          }
        : undefined;

    setSubmitting(true);
    try {
      addTopic(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          votingType,
          rankingOptions: needsRankOptions
            ? validRankOpts.map((label, i) => ({
                id: `opt_${i}_${Date.now()}`,
                label: label.trim(),
              }))
            : undefined,
          aspects: needsAspects ? validAspects.map((a) => a.trim()) : undefined,
          targetDemographics,
          hashtags: parsedTags.length > 0 ? parsedTags : undefined,
        },
        accountType
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create topic. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 16 : insets.top + 8 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>New Topic</Text>
        <Pressable
          onPress={submit}
          disabled={!title.trim() || submitting}
          style={({ pressed }) => [
            s.submitBtn,
            (!title.trim() || submitting) && { opacity: 0.4 },
            pressed && title.trim() && !submitting && { opacity: 0.8 },
          ]}
        >
          <Text style={s.submitLabel}>{submitting ? "Posting..." : "Post"}</Text>
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
          <ThemedInput
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
          <ThemedInput
            style={[s.input, s.inputMulti]}
            placeholder="Add more context (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            multiline
          />
        </View>

        {/* Hashtags */}
        <View style={s.field}>
          <Text style={s.label}>Hashtags</Text>
          <ThemedInput
            style={s.input}
            placeholder="#pizza #food #debate"
            placeholderTextColor={colors.mutedForeground}
            value={tagsInput}
            onChangeText={setTagsInput}
            autoCapitalize="none"
          />
          {parsedTags.length > 0 && (
            <View style={s.tagsRow}>
              {parsedTags.map((tag) => (
                <View key={tag} style={s.tagChip}>
                  <Text style={s.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
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
                  <Icon
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

        {/* Voting Type */}
        <View style={s.field}>
          <Text style={s.label}>Voting Type</Text>
          <Text style={s.sublabel}>Choose one way for people to respond</Text>
          <View style={s.voteTypeRow}>
            {(
              [
                { vt: "yesno" as VotingType, icon: "thumbs-up", label: "Yes / No", desc: "Simple agree or disagree" },
                { vt: "rating" as VotingType, icon: "star", label: "Star Rating", desc: "Score from 1 to 5 stars" },
                { vt: "ranking" as VotingType, icon: "list", label: "Ranking", desc: "Order a list of options" },
                { vt: "aspects" as VotingType, icon: "layers", label: "Aspects", desc: "Rate multiple criteria with thumbs up/down" },
              ] as const
            ).map(({ vt, icon, label, desc }) => {
              const active = votingType === vt;
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
                  onPress={() => selectVotingType(vt)}
                >
                  <Icon
                    name={icon as any}
                    size={20}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.voteTypeLabel,
                        active && { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {label}
                    </Text>
                    <Text style={s.voteTypeDesc}>{desc}</Text>
                  </View>
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Aspect Items */}
        {needsAspects && (
          <View style={s.field}>
            <Text style={s.label}>Aspects to Rate</Text>
            <Text style={s.sublabel}>People will give each a thumbs up or down</Text>
            <View style={s.rankOptions}>
              {aspectItems.map((item, idx) => (
                <View key={idx} style={s.rankOptionRow}>
                  <View style={[s.rankBadge, { backgroundColor: colors.primary + "22" }]}>
                    <Icon name="layers" size={13} color={colors.primary} />
                  </View>
                  <ThemedInput
                    ref={(ref) => { aspectRefs.current[idx] = ref; }}
                    style={s.rankOptionInput}
                    placeholder={`Aspect ${idx + 1} (e.g. Service)`}
                    placeholderTextColor={colors.mutedForeground}
                    value={item}
                    onChangeText={(t) => updateAspectItem(idx, t)}
                    returnKeyType={idx < aspectItems.length - 1 ? "next" : "done"}
                    onSubmitEditing={() => {
                      if (idx < aspectItems.length - 1) {
                        aspectRefs.current[idx + 1]?.focus();
                      } else if (aspectItems.length < 10) {
                        addAspectItem();
                      }
                    }}
                    blurOnSubmit={false}
                  />
                  {aspectItems.length > 2 && (
                    <Pressable
                      onPress={() => removeAspectItem(idx)}
                      hitSlop={8}
                      style={({ pressed }) => [s.removeBtn, pressed && { opacity: 0.5 }]}
                    >
                      <Icon name="x" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              ))}
              {aspectItems.length < 10 && (
                <Pressable
                  style={({ pressed }) => [s.addOptionBtn, pressed && { opacity: 0.7 }]}
                  onPress={addAspectItem}
                >
                  <Icon name="plus-circle" size={16} color={colors.primary} />
                  <Text style={s.addOptionText}>Add another aspect</Text>
                  <Text style={s.addOptionCount}>{aspectItems.length}/10</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Target Audience */}
        <View style={s.field}>
          <Pressable
            style={s.targetingHeader}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowTargeting((v) => !v);
            }}
          >
            <View style={s.targetingHeaderLeft}>
              <Icon name="users" size={15} color={targetingCount > 0 ? colors.primary : colors.mutedForeground} />
              <Text style={[s.targetingTitle, targetingCount > 0 && { color: colors.primary }]}>
                Target Audience
              </Text>
              {targetingCount > 0 && (
                <View style={s.targetingBadge}>
                  <Text style={s.targetingBadgeText}>{targetingCount} set</Text>
                </View>
              )}
            </View>
            <Icon
              name={showTargeting ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>

          {showTargeting && (
            <View style={s.targetingBody}>
              <Text style={s.targetingHint}>
                Optionally narrow who you want responses from. Leave blank for everyone.
              </Text>

              <View style={s.targetSection}>
                <Text style={s.targetSectionLabel}>Age range</Text>
                <View style={s.chipRow}>
                  {AGE_RANGES.map((v) => {
                    const active = v === targetAgeRange;
                    return (
                      <Pressable
                        key={v}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTargetAgeRange(active ? "" : v);
                        }}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{v}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={s.targetSection}>
                <Text style={s.targetSectionLabel}>Gender</Text>
                <View style={s.chipRow}>
                  {GENDERS.map((v) => {
                    const active = v === targetGender;
                    return (
                      <Pressable
                        key={v}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTargetGender(active ? "" : v);
                        }}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{v}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={s.targetSection}>
                <Text style={s.targetSectionLabel}>Occupation</Text>
                <View style={s.chipRow}>
                  {OCCUPATIONS.map((v) => {
                    const active = v === targetOccupation;
                    return (
                      <Pressable
                        key={v}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTargetOccupation(active ? "" : v);
                        }}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{v}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
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
                  <ThemedInput
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
                      <Icon
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
                  <Icon
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
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
    },
    tagChip: {
      backgroundColor: colors.primary + "22",
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 100,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tagChipText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600",
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
      fontSize: 15,
      fontWeight: "500",
      color: colors.foreground,
    },
    voteTypeDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
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
    targetingHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    targetingHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    targetingTitle: { fontSize: 14, fontWeight: "600", color: colors.mutedForeground },
    targetingBadge: {
      backgroundColor: colors.primary + "22",
      borderRadius: 100,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    targetingBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
    targetingBody: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 16,
      marginTop: 8,
    },
    targetingHint: { fontSize: 12, color: colors.mutedForeground, lineHeight: 17 },
    targetSection: { gap: 8 },
    targetSectionLabel: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 11, paddingVertical: 6,
      borderRadius: 100, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.muted,
    },
    chipActive: { backgroundColor: colors.primary + "22", borderColor: colors.primary },
    chipText: { fontSize: 12, color: colors.mutedForeground, fontWeight: "500" },
    chipTextActive: { color: colors.primary, fontWeight: "700" },
  });
