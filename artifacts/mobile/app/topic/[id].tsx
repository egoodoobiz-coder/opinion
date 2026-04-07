import { useUser } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ThemedInput from "@/components/ThemedInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RankingVote from "@/components/RankingVote";
import StarRating from "@/components/StarRating";
import { CATEGORY_CONFIG } from "@/constants/categories";
import { useApp, type DemoBreakdown } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { topics, getUserVote, voteYesNo, voteRating, voteRanking, voteAspect, addComment, userId } = useApp();
  const { user } = useUser();

  const topic = useMemo(() => topics.find((t) => t.id === id), [topics, id]);
  const userVote = getUserVote(id ?? "");

  const [pendingRanking, setPendingRanking] = useState<string[] | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function submitComment() {
    if (!commentText.trim() || !topic) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmittingComment(true);
    const authorId = user?.id ?? userId;
    const authorName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "Anonymous"
      : "Anonymous";
    addComment(topic.id, commentText.trim(), authorId, authorName);
    setCommentText("");
    setSubmittingComment(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

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
  const hasAspects = topic.votingType === "aspects";

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 16 : insets.top + 4 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={[s.catBadge, { backgroundColor: cat.color + "22" }]}>
          <Icon name={cat.icon as any} size={12} color={cat.color} />
          <Text style={[s.catLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          s.content,
          { paddingBottom: 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>{topic.title}</Text>
        {!!topic.description && (
          <Text style={s.desc}>{topic.description}</Text>
        )}

        {hasYesNo && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Icon name="thumbs-up" size={15} color={colors.yes} />
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
                <Icon
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
                <Icon
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
              <Icon name="star" size={15} color={colors.star} />
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
              <Icon name="list" size={15} color={colors.rank} />
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
                <Icon name="check" size={16} color={colors.primaryForeground} />
                <Text style={s.submitRankLabel}>
                  {userVote?.ranking ? "Update Ranking" : "Submit Ranking"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        {hasAspects && topic.aspects && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Icon name="layers" size={15} color={colors.primary} />
              <Text style={s.sectionTitle}>Aspect Rating</Text>
              <Text style={s.voteCount}>
                {topic.aspects.length} criteria
              </Text>
            </View>

            <View style={s.aspectList}>
              {topic.aspects.map((aspect) => {
                const av = topic.aspectVotes?.[aspect] ?? { up: 0, down: 0 };
                const total = av.up + av.down;
                const upPct = total > 0 ? Math.round((av.up / total) * 100) : 0;
                const userChoice = userVote?.aspectChoices?.[aspect];

                return (
                  <View key={aspect} style={s.aspectRow}>
                    <View style={s.aspectTopRow}>
                      <Text style={s.aspectLabel}>{aspect}</Text>
                      <View style={s.aspectVoteBtns}>
                        <Pressable
                          style={({ pressed }) => [
                            s.aspectBtn,
                            s.aspectBtnUp,
                            userChoice === "up" && s.aspectBtnUpActive,
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            voteAspect(topic.id, aspect, "up");
                          }}
                        >
                          <Icon
                            name="thumbs-up"
                            size={13}
                            color={userChoice === "up" ? "#fff" : colors.yes}
                          />
                          <Text style={[s.aspectBtnLabel, { color: userChoice === "up" ? "#fff" : colors.yes }]}>
                            {av.up}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            s.aspectBtn,
                            s.aspectBtnDown,
                            userChoice === "down" && s.aspectBtnDownActive,
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            voteAspect(topic.id, aspect, "down");
                          }}
                        >
                          <Icon
                            name="thumbs-down"
                            size={13}
                            color={userChoice === "down" ? "#fff" : colors.no}
                          />
                          <Text style={[s.aspectBtnLabel, { color: userChoice === "down" ? "#fff" : colors.no }]}>
                            {av.down}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    {total > 0 && (
                      <View style={s.aspectBarWrap}>
                        <View style={s.aspectBarBg}>
                          <View
                            style={[s.aspectBarFill, { width: `${upPct}%` as any, backgroundColor: colors.yes }]}
                          />
                        </View>
                        <Text style={s.aspectPct}>{upPct}% 👍</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Demographic Breakdown */}
        {topic.demoBreakdown && Object.keys(topic.demoBreakdown).length > 0 && (
          <DemoBreakdownPanel breakdown={topic.demoBreakdown} colors={colors} s={s} />
        )}

        {/* Comments Section */}
        <View style={s.commentsSection}>
          <View style={s.commentsSectionHeader}>
            <Icon name="message-circle" size={15} color={colors.mutedForeground} />
            <Text style={s.commentsSectionTitle}>
              {topic.comments.length === 0
                ? "No comments yet"
                : `${topic.comments.length} Comment${topic.comments.length === 1 ? "" : "s"}`}
            </Text>
          </View>
          {topic.comments.length === 0 && (
            <Text style={s.noCommentsText}>Be the first to share your thoughts.</Text>
          )}
          {topic.comments.map((c) => (
            <View key={c.id} style={s.commentItem}>
              <View style={s.commentAvatar}>
                <Text style={s.commentAvatarText}>
                  {c.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={s.commentBody}>
                <View style={s.commentMeta}>
                  <Text style={s.commentAuthor}>{c.authorName}</Text>
                  <Text style={s.commentTime}>{formatTime(c.createdAt)}</Text>
                </View>
                <Text style={s.commentText}>{c.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Comment Input Bar */}
      <View
        style={[
          s.inputBar,
          { paddingBottom: Platform.OS === "ios" ? insets.bottom + 8 : 12 },
        ]}
      >
        <ThemedInput
          style={s.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={colors.mutedForeground}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={submitComment}
        />
        <Pressable
          onPress={submitComment}
          disabled={!commentText.trim() || submittingComment}
          style={({ pressed }) => [
            s.sendBtn,
            { opacity: !commentText.trim() ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="send" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const DEMO_LABELS: Record<keyof DemoBreakdown, string> = {
  ageRange: "Age Range",
  gender: "Gender",
  country: "Country",
  occupation: "Occupation",
};

function DemoBreakdownPanel({
  breakdown,
  colors,
  s,
}: {
  breakdown: DemoBreakdown;
  colors: ReturnType<typeof useColors>;
  s: any;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const fields = (Object.keys(breakdown) as Array<keyof DemoBreakdown>).filter(
    (k) => breakdown[k] && Object.keys(breakdown[k]!).length > 0
  );
  if (fields.length === 0) return null;

  return (
    <View style={s.section}>
      <Pressable
        style={s.sectionHeader}
        onPress={() => setExpanded((v) => !v)}
      >
        <Icon name="bar-chart-2" size={15} color={colors.primary} />
        <Text style={s.sectionTitle}>Who Voted</Text>
        <Text style={s.voteCount}>{fields.length} breakdown{fields.length > 1 ? "s" : ""}</Text>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={s.breakdownBody}>
          {fields.map((field) => {
            const data = breakdown[field]!;
            const total = Object.values(data).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
            return (
              <View key={field} style={s.breakdownGroup}>
                <Text style={s.breakdownGroupLabel}>{DEMO_LABELS[field]}</Text>
                {sorted.map(([key, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <View key={key} style={s.breakdownRow}>
                      <Text style={s.breakdownKey} numberOfLines={1}>{key}</Text>
                      <View style={s.breakdownBarWrap}>
                        <View style={s.breakdownBarBg}>
                          <View style={[s.breakdownBarFill, { width: `${pct}%` as any }]} />
                        </View>
                        <Text style={s.breakdownPct}>{pct}%</Text>
                      </View>
                      <Text style={s.breakdownCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
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
    aspectList: { gap: 14 },
    aspectRow: { gap: 6 },
    aspectTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    aspectLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
      flex: 1,
      marginRight: 8,
    },
    aspectVoteBtns: {
      flexDirection: "row",
      gap: 6,
    },
    aspectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    aspectBtnUp: {
      borderColor: colors.yes,
      backgroundColor: colors.yes + "18",
    },
    aspectBtnUpActive: {
      backgroundColor: colors.yes,
    },
    aspectBtnDown: {
      borderColor: colors.no,
      backgroundColor: colors.no + "18",
    },
    aspectBtnDownActive: {
      backgroundColor: colors.no,
    },
    aspectBtnLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    aspectBarWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    aspectBarBg: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.no + "33",
      overflow: "hidden",
    },
    aspectBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    aspectPct: {
      fontSize: 11,
      color: colors.mutedForeground,
      width: 50,
      textAlign: "right",
    },
    commentsSection: {
      gap: 12,
      paddingTop: 4,
    },
    commentsSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    commentsSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    noCommentsText: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      paddingVertical: 12,
    },
    commentItem: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    commentAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    commentAvatarText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    commentBody: {
      flex: 1,
      gap: 3,
    },
    commentMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    commentAuthor: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    commentTime: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    commentText: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 20,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    breakdownBody: { gap: 16 },
    breakdownGroup: { gap: 8 },
    breakdownGroupLabel: {
      fontSize: 12, fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.6,
    },
    breakdownRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    breakdownKey: {
      fontSize: 12, color: colors.foreground,
      width: 90, fontWeight: "500",
    },
    breakdownBarWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
    breakdownBarBg: {
      flex: 1, height: 6, borderRadius: 3,
      backgroundColor: colors.border, overflow: "hidden",
    },
    breakdownBarFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
    breakdownPct: { fontSize: 11, color: colors.mutedForeground, width: 32, textAlign: "right" },
    breakdownCount: { fontSize: 11, color: colors.mutedForeground, width: 28, textAlign: "right" },
  });

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
