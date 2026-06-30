import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { RankingOption } from "@/context/AppContext";

interface Props {
  options: RankingOption[];
  value?: string[];
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

  // Memoize styles — was being recreated on every render (once per list item)
  const s = useMemo(() => styles(colors), [colors]);

  // Build an id→option lookup to avoid find() inside map
  const optionMap = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options]
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

  function getAvgRank(optId: string): string | null {
    const votes = rankingVotes?.[optId];
    if (!votes || votes.length === 0) return null;
    return (votes.reduce((a, b) => a + b, 0) / votes.length).toFixed(1);
  }

  const displayOptions = useMemo(() => {
    if (readonly) {
      return options.slice().sort((a, b) => {
        const ar = rankingVotes?.[a.id];
        const br = rankingVotes?.[b.id];
        const avgA = ar && ar.length ? ar.reduce((x, y) => x + y, 0) / ar.length : 999;
        const avgB = br && br.length ? br.reduce((x, y) => x + y, 0) / br.length : 999;
        return avgA - avgB;
      });
    }
    // Use the lookup map — no non-null assertion or crash risk
    return ordered.reduce<RankingOption[]>((acc, id) => {
      const opt = optionMap.get(id);
      if (opt) acc.push(opt);
      return acc;
    }, []);
  }, [readonly, ordered, options, rankingVotes, optionMap]);

  return (
    <View style={s.container}>
      {displayOptions.map((opt, idx) => {
        const avg = getAvgRank(opt.id);
        const isFirst = idx === 0;
        const isLast = idx === displayOptions.length - 1;

        return (
          <View key={opt.id} style={s.row}>
            <View style={s.rankBadge}>
              <Text style={s.rankNum}>{idx + 1}</Text>
            </View>

            <Text style={s.label} numberOfLines={1}>
              {opt.label}
            </Text>

            {readonly && avg !== null && (
              <Text style={s.avg}>avg #{avg}</Text>
            )}

            {!readonly && (
              <View style={s.controls}>
                <Pressable
                  onPress={() => move(opt.id, "up")}
                  style={({ pressed }) => [
                    s.btn,
                    isFirst && s.btnDisabled,
                    pressed && !isFirst && { opacity: 0.5 },
                  ]}
                  disabled={isFirst}
                  hitSlop={4}
                >
                  <Icon
                    name="chevron-up"
                    size={16}
                    color={isFirst ? colors.border : colors.primary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => move(opt.id, "down")}
                  style={({ pressed }) => [
                    s.btn,
                    isLast && s.btnDisabled,
                    pressed && !isLast && { opacity: 0.5 },
                  ]}
                  disabled={isLast}
                  hitSlop={4}
                >
                  <Icon
                    name="chevron-down"
                    size={16}
                    color={isLast ? colors.border : colors.primary}
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
    rankNum: { fontSize: 13, fontWeight: "700", color: colors.primary },
    label: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.foreground },
    avg: { fontSize: 12, color: colors.mutedForeground },
    controls: { flexDirection: "row", gap: 4 },
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
