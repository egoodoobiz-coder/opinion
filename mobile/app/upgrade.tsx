import { useUser } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import { Icon } from "@/components/Icon";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Plan = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceNote: string;
  accountType: "company" | "celebrity";
  icon: string;
  color: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "company",
    name: "Company",
    description: "For brands and businesses",
    price: "$9.99",
    priceNote: "per month",
    accountType: "company",
    icon: "briefcase",
    color: "#7c3aed",
    features: [
      "Verified company badge",
      "Topics promoted to top of feed",
      "Detailed analytics dashboard",
      "Priority support",
    ],
  },
  {
    id: "celebrity",
    name: "Celebrity",
    description: "For public figures & creators",
    price: "$19.99",
    priceNote: "per month",
    accountType: "celebrity",
    icon: "zap",
    color: "#f59e0b",
    features: [
      "Verified celebrity badge",
      "Topics promoted to top of feed",
      "Detailed analytics dashboard",
      "Priority support",
      "Enhanced visibility in search",
    ],
  },
];

/** Activates premium directly via Clerk unsafeMetadata (no Stripe required) */
async function activateDirectly(
  user: NonNullable<ReturnType<typeof useUser>["user"]>,
  plan: Plan
) {
  await user.update({
    unsafeMetadata: {
      ...(user.unsafeMetadata as any),
      isPremium: true,
      accountType: plan.accountType,
    },
  });
}

export default function UpgradeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();

  // Read env var inside component — always fresh
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [loading, setLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Prevents duplicate taps firing two checkout requests
  const processingRef = useRef(false);

  const s = styles(colors, insets);

  async function handleSelectPlan(plan: Plan) {
    if (!user || processingRef.current) return;
    processingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setPendingPlan(plan);
    setPendingSessionId(null);

    try {
      const email = user.emailAddresses?.[0]?.emailAddress ?? "";

      // No API — direct Clerk metadata upgrade (dev / no-backend mode)
      if (!API_URL) {
        await activateDirectly(user, plan);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Welcome to Premium!",
          `Your ${plan.name} account is now active.`,
          [{ text: "Awesome!", onPress: () => router.back() }]
        );
        setPendingPlan(null);
        return;
      }

      // Fetch Stripe products
      const productsRes = await fetch(`${API_URL}/api/products-with-prices`);
      if (!productsRes.ok) throw new Error("Could not load pricing information");

      let products: any[] = [];
      try {
        const json = await productsRes.json();
        products = json.data ?? [];
      } catch {
        throw new Error("Invalid response from server");
      }

      const product = products.find(
        (p: any) =>
          p.metadata?.accountType === plan.accountType ||
          p.name?.toLowerCase().includes(plan.accountType)
      );

      // No matching Stripe product — fall back to direct upgrade
      if (!product || !product.prices?.[0]) {
        await activateDirectly(user, plan);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Welcome to Premium!",
          `Your ${plan.name} account is now active.`,
          [{ text: "Awesome!", onPress: () => router.back() }]
        );
        setPendingPlan(null);
        return;
      }

      const priceId = product.prices[0].id;

      const checkoutRes = await fetch(`${API_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email,
          priceId,
          accountType: plan.accountType,
        }),
      });

      if (!checkoutRes.ok) {
        let errMsg = "Could not create checkout session";
        try {
          const errJson = await checkoutRes.json();
          if (errJson.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }

      let sessionData: any = {};
      try {
        sessionData = await checkoutRes.json();
      } catch {
        throw new Error("Invalid checkout response from server");
      }

      if (sessionData.sessionId) {
        setPendingSessionId(sessionData.sessionId);
      }

      if (sessionData.url) {
        await Linking.openURL(sessionData.url);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong. Please try again.");
      setPendingPlan(null);
      setPendingSessionId(null);
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }

  async function handleVerifyPayment() {
    if (!user || !pendingPlan || verifying) return;
    setVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (pendingSessionId && API_URL) {
        // Verify specific checkout session
        const verifyRes = await fetch(
          `${API_URL}/api/checkout-verify?sessionId=${encodeURIComponent(pendingSessionId)}&userId=${encodeURIComponent(user.id)}&accountType=${encodeURIComponent(pendingPlan.accountType)}`
        );

        if (!verifyRes.ok) throw new Error(`Server error (${verifyRes.status})`);

        const { success } = await verifyRes.json();
        if (success) {
          await activateDirectly(user, pendingPlan);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Payment confirmed!",
            `Welcome to ${pendingPlan.name} Premium. Your account is now verified.`,
            [{ text: "Let's go!", onPress: () => router.back() }]
          );
          setPendingPlan(null);
          setPendingSessionId(null);
          return;
        }

        Alert.alert(
          "Payment not found",
          "We couldn't verify your payment yet. Please wait a moment and try again.",
          [{ text: "OK" }]
        );
      } else if (API_URL) {
        // No session ID — check subscription status
        const subRes = await fetch(
          `${API_URL}/api/subscription?userId=${encodeURIComponent(user.id)}`
        );

        if (!subRes.ok) throw new Error(`Server error (${subRes.status})`);

        const { isPremium, accountType } = await subRes.json();
        if (isPremium && accountType) {
          await user.update({
            unsafeMetadata: {
              ...(user.unsafeMetadata as any),
              isPremium: true,
              accountType,
            },
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Payment confirmed!", "Your premium account is now active.", [
            { text: "Great!", onPress: () => router.back() },
          ]);
          setPendingPlan(null);
          return;
        }

        Alert.alert(
          "Not yet confirmed",
          "Your payment hasn't been confirmed yet. Please wait a moment and try again."
        );
      } else {
        // No API and no session — shouldn't happen, but handle gracefully
        Alert.alert("Error", "Cannot verify payment without a backend configured.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not verify payment. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Icon name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={s.headerTitle}>Go Premium</Text>
        <View style={s.closeBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Icon name="star" size={28} color={colors.star} />
          </View>
          <Text style={s.heroTitle}>Amplify your voice</Text>
          <Text style={s.heroSubtitle}>
            Get a verified badge, promote your topics to the top of the feed,
            and unlock powerful analytics for your account.
          </Text>
        </View>

        {/* Plans */}
        {PLANS.map((plan) => (
          <Pressable
            key={plan.id}
            style={({ pressed }) => [
              s.planCard,
              { borderColor: plan.color + "66" },
              pressed && { opacity: 0.85 },
              loading && s.planCardDisabled,
            ]}
            onPress={() => handleSelectPlan(plan)}
            disabled={loading}
          >
            <View style={[s.planHeader, { backgroundColor: plan.color + "22" }]}>
              <View style={[s.planIconWrap, { backgroundColor: plan.color + "33" }]}>
                <Icon name={plan.icon} size={20} color={plan.color} />
              </View>
              <View style={s.planNameWrap}>
                <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
                <Text style={s.planDesc}>{plan.description}</Text>
              </View>
              <View style={s.planPriceWrap}>
                <Text style={[s.planPrice, { color: plan.color }]}>{plan.price}</Text>
                <Text style={s.planPriceNote}>{plan.priceNote}</Text>
              </View>
            </View>

            <View style={s.planFeatures}>
              {plan.features.map((feature, i) => (
                <View key={i} style={s.featureRow}>
                  <Icon name="check" size={14} color={plan.color} />
                  <Text style={s.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={[s.subscribeBtn, { backgroundColor: plan.color }]}>
              {loading && pendingPlan?.id === plan.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name={plan.icon} size={16} color="#fff" />
                  <Text style={s.subscribeBtnText}>Subscribe as {plan.name}</Text>
                </>
              )}
            </View>
          </Pressable>
        ))}

        {/* Verify payment card — shown after browser checkout */}
        {pendingPlan && !loading && (
          <View style={s.verifyCard}>
            <Icon name="info" size={16} color={colors.primary} />
            <View style={s.verifyContent}>
              <Text style={s.verifyTitle}>Completed checkout?</Text>
              <Text style={s.verifyDesc}>
                After completing your payment in the browser, tap below to activate
                your premium account.
              </Text>
              <Pressable
                style={({ pressed }) => [s.verifyBtn, pressed && { opacity: 0.85 }]}
                onPress={handleVerifyPayment}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.verifyBtnText}>Verify & Activate</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={s.disclaimer}>
          Subscriptions renew automatically. Cancel anytime from your account settings.
          Prices shown in USD.
        </Text>
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
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: { padding: 16, paddingBottom: insets.bottom + 32, gap: 16 },
    hero: { alignItems: "center", gap: 10, paddingVertical: 8 },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.star + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 300,
    },
    planCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1.5,
      overflow: "hidden",
    },
    planCardDisabled: { opacity: 0.7 },
    planHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
    },
    planIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    planNameWrap: { flex: 1 },
    planName: { fontSize: 17, fontWeight: "800" },
    planDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    planPriceWrap: { alignItems: "flex-end" },
    planPrice: { fontSize: 22, fontWeight: "800" },
    planPriceNote: { fontSize: 11, color: colors.mutedForeground },
    planFeatures: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureText: { fontSize: 13, color: colors.foreground, flex: 1 },
    subscribeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      margin: 16,
      marginTop: 4,
      paddingVertical: 14,
      borderRadius: 14,
    },
    subscribeBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    verifyCard: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    verifyContent: { flex: 1, gap: 8 },
    verifyTitle: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    verifyDesc: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18 },
    verifyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    verifyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    disclaimer: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 16,
    },
  });
