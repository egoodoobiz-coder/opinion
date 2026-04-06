import { useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Topic } from "@/context/AppContext";
import { CATEGORY_CONFIG } from "@/constants/categories";

interface Props {
  topic: Topic;
  userVoted?: boolean;
}

function avgRating(topic: Topic) {
  if (topic.ratingCount === 0) return null;
  return (topic.totalRating / topic.ratingCount).toFixed(1);
}

function avgRank(topic: Topic, optionId: string) {
  const votes = topic.rankingVotes[optionId];
  if (!votes || votes.length === 0) return null;
  return votes.reduce((a, b) => a + b, 0) / votes.length;
}

export default function TopicCard({ topic, userVoted }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useUser();
  const cat = CATEGORY_CONFIG[topic.category];
  const total = topic.yesCount + topic.noCount;
  const yesPercent = total > 0 ? Math.round((topic.yesCount / total) * 100) : null;
  const avg = avgRating(topic);
  const timeAgo = formatTime(topic.createdAt);

  const hasYesNo = topic.votingType === "yesno";
  const hasRating = topic.votingType === "rating";
  const hasRanking = topic.votingType === "ranking";

  // Check if topic creator is premium (stored in topic.premiumAccountType)
  const isPremiumTopic = !!(topic as any).premiumAccountType;
  const premiumType: string = (topic as any).premiumAccountType ?? "";

  const topRanked =
    hasRanking && topic.rankingOptions
      ? [...topic.rankingOptions]
          .map((o) => ({ ...o, avgRank: avgRank(topic, o.id) ?? 999 }))
          .sort((a, b) => a.avgRank - b.avgRank)
          .slice(0, 3)
      : [];

  const s = styles(colors);

  return (
    <Pressable
      style={({ pressed }) => [s.card, isPremiumTopic && s.cardPremium, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/topic/${topic.id}`)}
    >
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.catBadge, { backgroundColor: cat.color + "22" }]}>
            <Feather name={cat.icon as any} size={12} color={cat.color} />
            <Text style={[s.catLabel, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {isPremiumTopic && (
            <View style={[s.verifiedBadge, premiumType === "celebrity" ? s.verifiedCelebrity : s.verifiedCompany]}>
              <Feather name="check-circle" size={10} color="#fff" />
              <Text style={s.verifiedText}>
                {premiumType === "celebrity" ? "Celebrity" : "Company"}
              </Text>
            </View>
          )}
        </View>
        <View style={s.headerRight}>
          {userVoted && (
            <View style={s.votedBadge}>
              <Feather name="check" size={10} color={colors.primary} />
              <Text style={s.votedLabel}>Voted</Text>
            </View>
          )}
          <Text style={s.time}>{timeAgo}</Text>
        </View>
      </View>

      <Text style={s.title} numberOfLines={2}>
        {topic.title}
      </Text>

      {topic.description ? (
        <Text style={s.desc} numberOfLines={1}>
          {topic.description}
        </Text>
      ) : null}

      <View style={s.stats}>
        {hasYesNo && yesPercent !== null && (
          <View style={s.stat}>
            <View style={s.yesnoBar}>
              <View
                style={[
                  s.yesBarFill,
                  { width: `${yesPercent}%` as any, backgroundColor: colors.yes },
                ]}
              />
            </View>
            <Text style={s.statLabel}>
              {yesPercent}% Yes · {total.toLocaleString()} votes
            </Text>
          </View>
        )}

        {hasRating && avg !== null && (
          <View style={s.ratingRow}>
            <Feather name="star" size={13} color={colors.star} />
            <Text style={s.ratingText}>{avg}</Text>
            <Text style={s.ratingCount}>({topic.ratingCount.toLocaleString()})</Text>
          </View>
        )}

        {hasRanking && topRanked.length > 0 && (
          <View style={s.rankPreview}>
            {topRanked.map((o, i) => (
              <View key={o.id} style={s.rankItem}>
                <Text style={s.rankNum}>#{i + 1}</Text>
                <Text style={s.rankLabel} numberOfLines={1}>
                  {o.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={s.voteTypePills}>
        <View style={[s.pill, { backgroundColor: colors.muted }]}>
          <Feather
            name={topic.votingType === "yesno" ? "thumbs-up" : topic.votingType === "rating" ? "star" : "list"}
            size={10}
            color={colors.mutedForeground}
          />
          <Text style={s.pillLabel}>
            {topic.votingType === "yesno" ? "Yes/No" : topic.votingType === "rating" ? "Rating" : "Ranking"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPremium: {
      borderColor: colors.primary + "55",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    catBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 100,
    },
    catLabel: { fontSize: 11, fontWeight: "600" },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 100,
    },
    verifiedCompany: { backgroundColor: colors.primary },
    verifiedCelebrity: { backgroundColor: colors.star },
    verifiedText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    votedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: colors.primary + "22",
      borderRadius: 100,
    },
    votedLabel: { fontSize: 10, color: colors.primary, fontWeight: "600" },
    time: { fontSize: 11, color: colors.mutedForeground },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      lineHeight: 22,
      marginBottom: 4,
    },
    desc: { fontSize: 13, color: colors.mutedForeground, marginBottom: 10 },
    stats: { gap: 8, marginBottom: 10 },
    stat: { gap: 4 },
    yesnoBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.no + "44",
      overflow: "hidden",
    },
    yesBarFill: { height: "100%", borderRadius: 3 },
    statLabel: { fontSize: 12, color: colors.mutedForeground },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontSize: 14, fontWeight: "700", color: colors.star },
    ratingCount: { fontSize: 12, color: colors.mutedForeground },
    rankPreview: { gap: 2 },
    rankItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    rankNum: { fontSize: 11, fontWeight: "700", color: colors.primary, width: 22 },
    rankLabel: { fontSize: 12, color: colors.foreground, flex: 1 },
    voteTypePills: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 100,
    },
    pillLabel: { fontSize: 10, color: colors.mutedForeground },
  });
