import { useUser } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp, type Topic } from "@/context/AppContext";
import { CATEGORY_CONFIG } from "@/constants/categories";
import { VOICE_CONFIG } from "@/constants/voiceTypes";

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
  const { userDemographics, followedAccounts, lastSeenTimestamp, followAccount, unfollowAccount, markAccountSeen } = useApp();
  const cat = CATEGORY_CONFIG[topic.category];

  const isSystem = topic.createdBy === "system" || !topic.createdBy;
  const isOwnPost = user?.id === topic.createdBy;
  const isFollowed = !isSystem && !isOwnPost && followedAccounts.includes(topic.createdBy);
  const hasNewPost = isFollowed && topic.createdAt > (lastSeenTimestamp[topic.createdBy] ?? 0);
  const authorName = topic.createdByName ?? (isSystem ? "Opinion" : "Anonymous");
  const authorInitial = authorName[0]?.toUpperCase() ?? "?";

  function handleFollowPress() {
    if (isFollowed) {
      unfollowAccount(topic.createdBy);
    } else {
      followAccount(topic.createdBy, authorName);
    }
  }

  function handleAuthorPress() {
    if (isFollowed && hasNewPost) markAccountSeen(topic.createdBy);
  }

  const isTargetedAtMe = (() => {
    const td = topic.targetDemographics;
    if (!td) return false;
    const hasSomeDemo = Object.values(userDemographics).some(Boolean);
    if (!hasSomeDemo) return false;
    const fields: Array<keyof typeof userDemographics> = ["ageRange", "gender", "occupation"];
    return fields.some((f) => td[f] && td[f] === userDemographics[f]);
  })();
  const total = topic.yesCount + topic.noCount;
  const yesPercent = total > 0 ? Math.round((topic.yesCount / total) * 100) : null;
  const avg = avgRating(topic);
  const timeAgo = formatTime(topic.createdAt);

  const hasYesNo = topic.votingType === "yesno";
  const hasRating = topic.votingType === "rating";
  const hasRanking = topic.votingType === "ranking";
  const hasAspects = topic.votingType === "aspects";

  const voiceCfg = topic.voiceType ? VOICE_CONFIG[topic.voiceType] : null;

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
      style={({ pressed }) => [s.card, voiceCfg && s.cardVoice, voiceCfg && { borderColor: voiceCfg.color + "55" }, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/topic/${topic.id}`)}
    >
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.postNumber}>#{topic.topicNumber}</Text>
          <View style={[s.catBadge, { backgroundColor: cat.color + "22" }]}>
            <Icon name={cat.icon as any} size={12} color={cat.color} />
            <Text style={[s.catLabel, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {voiceCfg && (
            <View style={[s.voiceBadge, { backgroundColor: voiceCfg.color + "22", borderColor: voiceCfg.color + "55" }]}>
              <Icon name={voiceCfg.icon} size={10} color={voiceCfg.color} />
              <Text style={[s.voiceBadgeText, { color: voiceCfg.color }]}>{voiceCfg.label}</Text>
            </View>
          )}
          {isTargetedAtMe && (
            <View style={s.forYouBadge}>
              <Icon name="user-check" size={9} color="#10b981" />
              <Text style={s.forYouText}>For You</Text>
            </View>
          )}
        </View>
        <View style={s.headerRight}>
          {userVoted && (
            <View style={s.votedBadge}>
              <Icon name="check" size={10} color={colors.primary} />
              <Text style={s.votedLabel}>Voted</Text>
            </View>
          )}
          <Text style={s.time}>{timeAgo}</Text>
        </View>
      </View>

      {!isSystem && (
        <Pressable style={s.authorRow} onPress={handleAuthorPress}>
          <View style={[s.avatarRing, hasNewPost && s.avatarRingNew]}>
            <View style={[s.avatar, { backgroundColor: colors.primary + "33" }]}>
              <Text style={[s.avatarInitial, { color: colors.primary }]}>{authorInitial}</Text>
            </View>
          </View>
          <Text style={s.authorName} numberOfLines={1}>{authorName}</Text>
          {!isOwnPost && (
            <Pressable style={[s.followBtn, isFollowed && s.followBtnActive]} onPress={handleFollowPress} hitSlop={8}>
              <Text style={[s.followBtnText, isFollowed && s.followBtnTextActive]}>
                {isFollowed ? "Following" : "Follow"}
              </Text>
            </Pressable>
          )}
        </Pressable>
      )}

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
            <Icon name="star" size={13} color={colors.star} />
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

        {hasAspects && topic.aspects && topic.aspects.length > 0 && (
          <View style={s.aspectPreview}>
            {topic.aspects.slice(0, 4).map((aspect) => {
              const av = topic.aspectVotes?.[aspect] ?? { up: 0, down: 0 };
              const total = av.up + av.down;
              const upPct = total > 0 ? Math.round((av.up / total) * 100) : null;
              return (
                <View key={aspect} style={s.aspectPreviewRow}>
                  <Text style={s.aspectPreviewLabel} numberOfLines={1}>{aspect}</Text>
                  {upPct !== null ? (
                    <View style={s.aspectPreviewBarWrap}>
                      <View style={s.aspectPreviewBar}>
                        <View style={[s.aspectPreviewFill, { width: `${upPct}%` as any }]} />
                      </View>
                      <Text style={s.aspectPreviewPct}>{upPct}%</Text>
                    </View>
                  ) : (
                    <Text style={s.aspectPreviewNone}>No votes yet</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={s.voteTypePills}>
        <View style={[s.pill, { backgroundColor: colors.muted }]}>
          <Icon
            name={
              topic.votingType === "yesno" ? "thumbs-up"
              : topic.votingType === "rating" ? "star"
              : topic.votingType === "aspects" ? "layers"
              : "list"
            }
            size={10}
            color={colors.mutedForeground}
          />
          <Text style={s.pillLabel}>
            {topic.votingType === "yesno" ? "Yes/No"
              : topic.votingType === "rating" ? "Rating"
              : topic.votingType === "aspects" ? "Aspects"
              : "Ranking"}
          </Text>
        </View>
        <View style={[s.pill, { backgroundColor: colors.muted }]}>
          <Icon name="message-circle" size={10} color={colors.mutedForeground} />
          <Text style={s.pillLabel}>{topic.comments.length}</Text>
        </View>
      </View>

      <View style={s.footer}>
        <Icon name="calendar" size={10} color={colors.mutedForeground} />
        <Text style={s.footerDate}>{formatDateTime(topic.createdAt)}</Text>
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatDateTime(ts: number) {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
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
    cardVoice: {
      borderWidth: 1.5,
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
    voiceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 100,
      borderWidth: 1,
    },
    voiceBadgeText: { fontSize: 10, fontWeight: "700" },
    forYouBadge: {
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "#10b98122",
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100,
      borderWidth: 1, borderColor: "#10b98144",
    },
    forYouText: { fontSize: 10, fontWeight: "700", color: "#10b981" },
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
    aspectPreview: { gap: 5 },
    aspectPreviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    aspectPreviewLabel: { fontSize: 11, fontWeight: "600", color: colors.foreground, width: 72 },
    aspectPreviewBarWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
    aspectPreviewBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.no + "33",
      overflow: "hidden",
    },
    aspectPreviewFill: { height: "100%", borderRadius: 2, backgroundColor: colors.yes },
    aspectPreviewPct: { fontSize: 10, color: colors.mutedForeground, width: 26, textAlign: "right" },
    aspectPreviewNone: { fontSize: 10, color: colors.mutedForeground },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    avatarRing: {
      width: 30,
      height: 30,
      borderRadius: 15,
      padding: 2,
      borderWidth: 2,
      borderColor: "transparent",
    },
    avatarRingNew: {
      borderColor: colors.primary,
    },
    avatar: {
      flex: 1,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontSize: 11,
      fontWeight: "800",
    },
    authorName: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      flex: 1,
    },
    followBtn: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    followBtnActive: {
      backgroundColor: colors.primary + "22",
    },
    followBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    followBtnTextActive: {
      color: colors.primary,
    },
    postNumber: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      letterSpacing: 0.3,
    },
    voteTypePills: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerDate: { fontSize: 10, color: colors.mutedForeground },
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
