import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RankingVote from "@/components/RankingVote";
import StarRating from "@/components/StarRating";
import { CATEGORY_CONFIG } from "@/constants/categories";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { topics, getUserVote, voteYesNo, voteRating, voteRanking } = useApp();

  const topic = useMemo(() => topics.find((t) => t.id === id), [topics, id]);
  const userVote = getUserVote(id ?? "");

  const [pendingRanking, setPendingRanking] = useState<string[] | null>(null);

  if (!topic) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.foreground }}>Topic not found</Text>
      </View>
    );
  }

  const cat = CATEGORY_CONFIG[topic.category];
  const total = topic.yesCount + topic.noCount;
  const yesPercent = total > 0 ? Math.round((topic.yesCount / total) * 100) : 0;
  const noPercent = total > 0 ? 100 - yesPercent : 0;
  const avgRating =
    topic.ratingCount > 0
      ? (topic.totalRating / topic.ratingCount).toFixed(1)
      : null;

  const hasYesNo = topic.votingType === "yesno";
  const hasRating = topic.votingType === "rating";
  const hasRanking = topic.votingType === "ranking";

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
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={[s.catBadge, { backgroundColor: cat.color + "22" }]}>
          <Feather name={cat.icon as any} size={12} color={cat.color} />
          <Text style={[s.catLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>{topic.title}</Text>
        {!!topic.description && (
          <Text style={s.desc}>{topic.description}</Text>
        )}

        {hasYesNo && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Feather name="thumbs-up" size={15} color={colors.yes} />
              <Text style={s.sectionTitle}>Yes or No</Text>
              {total > 0 && (
                <Text style={s.voteCount}>{total.toLocaleString()} votes</Text>
              )}
            </View>

            {total > 0 && (
              <View style={s.yesnoResults}>
                <View style={s.yesnoBar}>
                  <View
                    style={[
                      s.yesBarFill,
                      { flex: yesPercent, backgroundColor: colors.yes },
                    ]}
                  />
                  <View
                    style={[
                      s.noBarFill,
                      { flex: noPercent, backgroundColor: colors.no },
                    ]}
                  />
                </View>
                <View style={s.yesnoLabels}>
                  <View style={s.yesnoLabelRow}>
                    <View style={[s.dot, { backgroundColor: colors.yes }]} />
                    <Text style={[s.percentText, { color: colors.yes }]}>
                      {yesPercent}% Yes
                    </Text>
                    <Text style={s.absCount}>({topic.yesCount.toLocaleString()})</Text>
                  </View>
                  <View style={s.yesnoLabelRow}>
                    <View style={[s.dot, { backgroundColor: colors.no }]} />
                    <Text style={[s.percentText, { color: colors.no }]}>
                      {noPercent}% No
                    </Text>
                    <Text style={s.absCount}>({topic.noCount.toLocaleString()})</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={s.voteButtons}>
              <Pressable
                style={({ pressed }) => [
                  s.yesBtn,
                  userVote?.yesno === "yes" && s.yesBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  voteYesNo(topic.id, "yes");
                }}
              >
                <Feather
                  name="thumbs-up"
                  size={18}
                  color={
                    userVote?.yesno === "yes"
                      ? colors.primaryForeground
                      : colors.yes
                  }
                />
                <Text
                  style={[
                    s.voteLabel,
                    { color: userVote?.yesno === "yes" ? colors.primaryForeground : colors.yes },
                  ]}
                >
                  Yes
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.noBtn,
                  userVote?.yesno === "no" && s.noBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  voteYesNo(topic.id, "no");
                }}
              >
                <Feather
                  name="thumbs-down"
                  size={18}
                  color={
                    userVote?.yesno === "no"
                      ? colors.primaryForeground
                      : colors.no
                  }
                />
                <Text
                  style={[
                    s.voteLabel,
                    { color: userVote?.yesno === "no" ? colors.primaryForeground : colors.no },
                  ]}
                >
                  No
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {hasRating && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Feather name="star" size={15} color={colors.star} />
              <Text style={s.sectionTitle}>Star Rating</Text>
              {topic.ratingCount > 0 && (
                <Text style={s.voteCount}>
                  {topic.ratingCount.toLocaleString()} ratings
                </Text>
              )}
            </View>

            {avgRating !== null && (
              <View style={s.ratingResult}>
                <Text style={s.avgRatingNum}>{avgRating}</Text>
                <StarRating value={Math.round(parseFloat(avgRating))} readonly size={22} />
                <Text style={s.avgRatingLabel}>community average</Text>
              </View>
            )}

            <View style={s.ratingInteractive}>
              <Text style={s.ratingPrompt}>
                {userVote?.rating ? `Your rating: ${userVote.rating}/5` : "Tap to rate"}
              </Text>
              <StarRating
                value={userVote?.rating ?? 0}
                onChange={(val) => {
                  voteRating(topic.id, val);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                size={36}
              />
            </View>
          </View>
        )}

        {hasRanking && topic.rankingOptions && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Feather name="list" size={15} color={colors.rank} />
              <Text style={s.sectionTitle}>Community Ranking</Text>
            </View>

            {Object.keys(topic.rankingVotes).length > 0 && (
              <>
                <Text style={s.rankResultLabel}>Results so far</Text>
                <RankingVote
                  options={topic.rankingOptions}
                  readonly
                  rankingVotes={topic.rankingVotes}
                />
              </>
            )}

            <View style={s.rankVoteSection}>
              <Text style={s.rankPrompt}>
                {userVote?.ranking ? "Your ranking (tap to change)" : "Drag to rank your preference"}
              </Text>
              <RankingVote
                options={topic.rankingOptions}
                value={userVote?.ranking ?? topic.rankingOptions.map((o) => o.id)}
                onChange={(ordered) => setPendingRanking(ordered)}
              />
              <Pressable
                style={({ pressed }) => [
                  s.submitRankBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  if (pendingRanking) {
                    voteRanking(topic.id, pendingRanking);
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                    setPendingRanking(null);
                  }
                }}
              >
                <Feather name="check" size={16} color={colors.primaryForeground} />
                <Text style={s.submitRankLabel}>
                  {userVote?.ranking ? "Update Ranking" : "Submit Ranking"}
                </Text>
              </Pressable>
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
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    catBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
    },
    catLabel: { fontSize: 12, fontWeight: "600" },
    content: { padding: 16, gap: 20 },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.foreground,
      lineHeight: 30,
    },
    desc: {
      fontSize: 15,
      color: colors.mutedForeground,
      lineHeight: 22,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
      flex: 1,
    },
    voteCount: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    yesnoResults: { gap: 10 },
    yesnoBar: {
      flexDirection: "row",
      height: 10,
      borderRadius: 5,
      overflow: "hidden",
    },
    yesBarFill: { borderRadius: 5 },
    noBarFill: { borderRadius: 5 },
    yesnoLabels: { flexDirection: "row", justifyContent: "space-between" },
    yesnoLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    percentText: { fontSize: 14, fontWeight: "700" },
    absCount: { fontSize: 12, color: colors.mutedForeground },
    voteButtons: {
      flexDirection: "row",
      gap: 12,
    },
    yesBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.yes,
      backgroundColor: colors.yesBg ?? colors.muted,
    },
    yesBtnActive: {
      backgroundColor: colors.yes,
    },
    noBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.no,
      backgroundColor: colors.noBg ?? colors.muted,
    },
    noBtnActive: {
      backgroundColor: colors.no,
    },
    voteLabel: {
      fontSize: 16,
      fontWeight: "700",
    },
    ratingResult: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    avgRatingNum: {
      fontSize: 48,
      fontWeight: "800",
      color: colors.star,
    },
    avgRatingLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    ratingInteractive: {
      alignItems: "center",
      gap: 8,
      paddingTop: 4,
    },
    ratingPrompt: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    rankResultLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    rankVoteSection: {
      gap: 12,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rankPrompt: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    submitRankBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    submitRankLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
  });
