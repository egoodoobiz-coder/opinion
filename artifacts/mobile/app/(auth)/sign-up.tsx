import { useSSO, useSignUp } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import { type Href, Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignUp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (!url.startsWith("http")) {
            router.replace("/(tabs)" as Href);
          }
        },
      });
    }
  };

  const handleGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async () => {
            router.replace("/(tabs)" as Href);
          },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router]);

  const s = styles(colors, insets);

  // Email verification step
  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View style={[s.container, { paddingTop: Platform.OS === "web" ? 80 : insets.top + 60 }]}>
        <Text style={s.logoText}>Opinion</Text>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.subtitle}>
          We sent a verification code to {email}
        </Text>
        <TextInput
          style={s.input}
          placeholder="6-digit code"
          placeholderTextColor={colors.mutedForeground}
          value={code}
          onChangeText={setCode}
          keyboardType="numeric"
          autoFocus
        />
        {errors?.fields?.code && (
          <Text style={s.error}>{errors.fields.code.message}</Text>
        )}
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching"}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.btnText}>Verify Email</Text>
          )}
        </Pressable>
        <Pressable onPress={() => signUp.verifications.sendEmailCode()}>
          <Text style={[s.link, { textAlign: "center" }]}>Resend code</Text>
        </Pressable>
        <View nativeID="clerk-captcha" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { paddingTop: Platform.OS === "web" ? 80 : insets.top + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.logoText}>Opinion</Text>
      <Text style={s.title}>Create an account</Text>
      <Text style={s.subtitle}>Join and start sharing opinions</Text>

      <Pressable
        style={({ pressed }) => [
          s.googleBtn,
          pressed && { opacity: 0.85 },
          googleLoading && { opacity: 0.6 },
        ]}
        onPress={handleGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <>
            <Text style={s.googleIcon}>G</Text>
            <Text style={s.googleText}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>or</Text>
        <View style={s.dividerLine} />
      </View>

      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input}
        placeholder="you@company.com"
        placeholderTextColor={colors.mutedForeground}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      {errors?.fields?.emailAddress && (
        <Text style={s.error}>{errors.fields.emailAddress.message}</Text>
      )}

      <Text style={s.label}>Password</Text>
      <TextInput
        style={s.input}
        placeholder="Create a strong password"
        placeholderTextColor={colors.mutedForeground}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      {errors?.fields?.password && (
        <Text style={s.error}>{errors.fields.password.message}</Text>
      )}

      <Pressable
        style={({ pressed }) => [
          s.btn,
          (!email || !password || fetchStatus === "fetching") && s.btnDisabled,
          pressed && { opacity: 0.85 },
        ]}
        onPress={handleSignUp}
        disabled={!email || !password || fetchStatus === "fetching"}
      >
        {fetchStatus === "fetching" ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={s.btnText}>Create Account</Text>
        )}
      </Pressable>

      <View style={s.footer}>
        <Text style={s.footerText}>Already have an account? </Text>
        <Link href="/(auth)/sign-in">
          <Text style={s.link}>Sign in</Text>
        </Link>
      </View>

      <View nativeID="clerk-captcha" />
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    logoText: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.primary,
      marginBottom: 24,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      marginBottom: 32,
    },
    googleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
      marginBottom: 20,
    },
    googleIcon: {
      fontSize: 18,
      fontWeight: "800",
      color: "#4285F4",
    },
    googleText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 20,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 13, color: colors.mutedForeground },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 4,
      marginBottom: 20,
    },
    btnDisabled: { opacity: 0.4 },
    btnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    footerText: { fontSize: 14, color: colors.mutedForeground },
    link: { fontSize: 14, fontWeight: "700", color: colors.primary },
    error: {
      fontSize: 12,
      color: colors.destructive,
      marginTop: -10,
      marginBottom: 10,
    },
  });
