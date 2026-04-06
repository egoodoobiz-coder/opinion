import { useSSO, useSignIn } from "@clerk/expo";
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

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            // handled externally
          } else {
            router.replace("/(tabs)" as Href);
          }
        },
      });
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code: verifyCode });
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: () => {
          router.replace("/(tabs)" as Href);
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

  if (signIn.status === "needs_client_trust") {
    return (
      <View style={s.container}>
        <Text style={s.title}>Verify your account</Text>
        <Text style={s.subtitle}>Enter the code sent to your email</Text>
        <TextInput
          style={s.input}
          placeholder="Verification code"
          placeholderTextColor={colors.mutedForeground}
          value={verifyCode}
          onChangeText={setVerifyCode}
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
            <Text style={s.btnText}>Verify</Text>
          )}
        </Pressable>
        <Pressable onPress={() => signIn.mfa.sendEmailCode()}>
          <Text style={s.link}>Resend code</Text>
        </Pressable>
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
      <Text style={s.title}>Welcome back</Text>
      <Text style={s.subtitle}>Sign in to share your opinions</Text>

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
        placeholder="you@example.com"
        placeholderTextColor={colors.mutedForeground}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      {errors?.fields?.identifier && (
        <Text style={s.error}>{errors.fields.identifier.message}</Text>
      )}

      <Text style={s.label}>Password</Text>
      <TextInput
        style={s.input}
        placeholder="Your password"
        placeholderTextColor={colors.mutedForeground}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
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
        onPress={handleEmailSignIn}
        disabled={!email || !password || fetchStatus === "fetching"}
      >
        {fetchStatus === "fetching" ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={s.btnText}>Sign In</Text>
        )}
      </Pressable>

      <View style={s.footer}>
        <Text style={s.footerText}>Don't have an account? </Text>
        <Link href="/(auth)/sign-up">
          <Text style={s.link}>Sign up</Text>
        </Link>
      </View>
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
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
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
    footerText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    link: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    error: {
      fontSize: 12,
      color: colors.destructive,
      marginTop: -10,
      marginBottom: 10,
    },
  });
