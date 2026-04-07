import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import type { RankingOption } from "@/context/AppContext";

interface Props {
  options: RankingOption[];
  value?: string[]; // ordered ids
  onChange?: (ordered: string[]) => void;
  readonly?: boolean;
  rankingVotes?: Record<string, number[]>;
}

export default function RankingVote({
  options,
  value,
  onChange,
  readonly = false,
  rankingVotes,
}: Props) {
  const colors = useColors();
  const [ordered, setOrdered] = useState<string[]>(
    value ?? options.map((o) => o.id)
  );

  function move(id: string, dir: "up" | "down") {
    const idx = ordered.indexOf(id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === ordered.length - 1) return;
    const newOrder = [...ordered];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOrdered(newOrder);
    onChange?.(newOrder);
  }

  function getAvgRank(optId: string) {
    const votes = rankingVotes?.[optId];
    if (!votes || votes.length === 0) return null;
    return (votes.reduce((a, b) => a + b, 0) / votes.length).toFixed(1);
  }

  const displayOptions = readonly
    ? options.slice().sort((a, b) => {
        const ar = rankingVotes?.[a.id];
        const br = rankingVotes?.[b.id];
        const avgA = ar ? ar.reduce((x, y) => x + y, 0) / ar.length : 999;
        const avgB = br ? br.reduce((x, y) => x + y, 0) / br.length : 999;
        return avgA - avgB;
      })
    : ordered.map((id) => options.find((o) => o.id === id)!).filter(Boolean);

  return (
    <View style={styles(colors).container}>
      {displayOptions.map((opt, idx) => {
        const avg = getAvgRank(opt.id);
        return (
          <View key={opt.id} style={styles(colors).row}>
            <View style={styles(colors).rankBadge}>
              <Text style={styles(colors).rankNum}>{idx + 1}</Text>
            </View>
            <Text style={styles(colors).label} numberOfLines={1}>
              {opt.label}
            </Text>
            {readonly && avg !== null && (
              <Text style={styles(colors).avg}>avg #{avg}</Text>
            )}
            {!readonly && (
              <View style={styles(colors).controls}>
                <Pressable
                  onPress={() => move(opt.id, "up")}
                  style={({ pressed }) => [
                    styles(colors).btn,
                    pressed && { opacity: 0.5 },
                    idx === 0 && styles(colors).btnDisabled,
                  ]}
                  disabled={idx === 0}
                >
                  <Icon
                    name="chevron-up"
                    size={16}
                    color={idx === 0 ? colors.border : colors.primary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => move(opt.id, "down")}
                  style={({ pressed }) => [
                    styles(colors).btn,
                    pressed && { opacity: 0.5 },
                    idx === displayOptions.length - 1 &&
                      styles(colors).btnDisabled,
                  ]}
                  disabled={idx === displayOptions.length - 1}
                >
                  <Icon
                    name="chevron-down"
                    size={16}
                    color={
                      idx === displayOptions.length - 1
                        ? colors.border
                        : colors.primary
                    }
                  />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 10,
    },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    rankNum: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    label: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.foreground,
    },
    avg: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    controls: {
      flexDirection: "row",
      gap: 4,
    },
    btn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    btnDisabled: { opacity: 0.3 },
  });
