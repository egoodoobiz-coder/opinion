import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSSO, useSignIn } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import { type Href, Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import { DRAFT_KEY } from "@/constants/draft";
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
import ThemedInput from "@/components/ThemedInput";
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

/** Maps Clerk error codes to user-friendly messages */
function clerkMessage(err: any): string {
  const code = err?.errors?.[0]?.code ?? err?.code ?? "";
  const msg = err?.errors?.[0]?.message ?? err?.message ?? "";
  if (code === "form_password_incorrect") return "Incorrect password. Please try again.";
  if (code === "form_identifier_not_found") return "No account found with that email.";
  if (code === "too_many_requests") return "Too many attempts. Please wait a moment.";
  if (code === "network_error" || err?.name === "TypeError") return "Network error. Check your connection.";
  return msg || "Something went wrong. Please try again.";
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Forgot password state ──────────────────────────────────────────────
  const [forgotStep, setForgotStep] = useState<"none" | "email" | "reset">("none");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  // Clear inline error when user starts editing
  function clearError() {
    if (errorMsg) setErrorMsg(null);
  }

  const postSignInRoute = useCallback(async (): Promise<Href> => {
    const draft = await AsyncStorage.getItem(DRAFT_KEY);
    return (draft ? "/create" : "/(tabs)") as Href;
  }, []);

  const handleEmailSignIn = async () => {
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await signIn.password({ emailAddress: email, password });
      if (error) {
        setErrorMsg(clerkMessage(error));
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: async ({ decorateUrl }) => {
            const url = decorateUrl("/");
            if (!url.startsWith("http")) {
              router.replace(await postSignInRoute());
            }
          },
        });
        if (finalizeError) setErrorMsg(clerkMessage(finalizeError));
      }
    } catch (err: any) {
      setErrorMsg(clerkMessage(err));
    }
  };

  const handleVerify = async () => {
    setErrorMsg(null);
    try {
      await signIn.mfa.verifyEmailCode({ code: verifyCode });
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: async () => {
            router.replace(await postSignInRoute());
          },
        });
        if (finalizeError) setErrorMsg(clerkMessage(finalizeError));
      }
    } catch (err: any) {
      setErrorMsg(clerkMessage(err));
    }
  };

  const handleResendCode = async () => {
    try {
      await signIn.mfa.sendEmailCode();
      Alert.alert("Code sent", "A new verification code has been sent to your email.");
    } catch (err: any) {
      Alert.alert("Error", clerkMessage(err));
    }
  };

  // ── Forgot password handlers ─────────────────────────────────────────────
  const handleSendResetCode = async () => {
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForgotBusy(true);
    try {
      const { error: createError } = await signIn.create({ identifier: resetEmail });
      if (createError) {
        setErrorMsg(clerkMessage(createError));
        return;
      }
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setErrorMsg(clerkMessage(sendError));
        return;
      }
      setForgotStep("reset");
    } catch (err: any) {
      setErrorMsg(clerkMessage(err));
    } finally {
      setForgotBusy(false);
    }
  };

  const handleResendResetCode = async () => {
    try {
      await signIn.resetPasswordEmailCode.sendCode();
      Alert.alert("Code sent", "A new reset code has been sent to your email.");
    } catch (err: any) {
      Alert.alert("Error", clerkMessage(err));
    }
  };

  const handleSubmitReset = async () => {
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForgotBusy(true);
    try {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code: resetCode });
      if (verifyError) {
        setErrorMsg(clerkMessage(verifyError));
        return;
      }
      const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });
      if (submitError) {
        setErrorMsg(clerkMessage(submitError));
        return;
      }
      if (signIn.status === "complete") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const { error: finalizeError } = await signIn.finalize({
          navigate: async () => {
            router.replace(await postSignInRoute());
          },
        });
        if (finalizeError) setErrorMsg(clerkMessage(finalizeError));
      }
    } catch (err: any) {
      setErrorMsg(clerkMessage(err));
    } finally {
      setForgotBusy(false);
    }
  };

  function openForgotPassword() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMsg(null);
    setResetEmail(email);
    setResetCode("");
    setNewPassword("");
    setForgotStep("email");
  }

  function closeForgotPassword() {
    setErrorMsg(null);
    setForgotStep("none");
  }

  const handleGoogle = useCallback(async () => {
    setErrorMsg(null);
    try {
      setGoogleLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { createdSessionId, setActive, signIn, authSessionResult } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async () => {
            router.replace(await postSignInRoute());
          },
        });
      } else if (authSessionResult?.type === "success" || authSessionResult?.type === "opened") {
        // The OAuth round-trip completed but Clerk didn't hand back a session —
        // this usually means an account with this email already exists via a
        // different sign-in method and needs to be linked/verified explicitly.
        const status = signIn?.status;
        if (status) {
          setErrorMsg(
            `Google sign-in didn't complete (status: ${status}). This email may already have an account set up with a password — try signing in with email + password instead.`
          );
        } else {
          setErrorMsg(
            "Google sign-in didn't complete. This email may already have an account with a password — try signing in with email + password instead."
          );
        }
      }
      // authSessionResult?.type === "cancel" / "dismiss" — user backed out, no error shown.
    } catch (err: any) {
      const msg = clerkMessage(err);
      if (!msg.toLowerCase().includes("cancel")) {
        setErrorMsg(msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router, postSignInRoute]);

  const s = styles(colors, insets);

  // ── Forgot password: enter email step ────────────────────────────────────
  if (forgotStep === "email") {
    return (
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Platform.OS === "web" ? 80 : insets.top + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.logoText}>Opinion</Text>
        <Text style={s.title}>Reset your password</Text>
        <Text style={s.subtitle}>Enter your email and we'll send you a reset code</Text>

        <Text style={s.label}>Email</Text>
        <ThemedInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          value={resetEmail}
          onChangeText={(t) => { setResetEmail(t); clearError(); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSendResetCode}
        />

        {errorMsg && <Text style={s.error}>{errorMsg}</Text>}

        <Pressable
          style={({ pressed }) => [
            s.btn,
            (!resetEmail || forgotBusy) && s.btnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSendResetCode}
          disabled={!resetEmail || forgotBusy}
        >
          {forgotBusy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.btnText}>Send Reset Code</Text>
          )}
        </Pressable>

        <Pressable onPress={closeForgotPassword}>
          <Text style={[s.link, { textAlign: "center" }]}>Back to sign in</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Forgot password: enter code + new password step ──────────────────────
  if (forgotStep === "reset") {
    return (
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Platform.OS === "web" ? 80 : insets.top + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.logoText}>Opinion</Text>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.subtitle}>Enter the code sent to {resetEmail} and choose a new password</Text>

        <Text style={s.label}>Reset code</Text>
        <ThemedInput
          style={s.input}
          placeholder="6-digit code"
          placeholderTextColor={colors.mutedForeground}
          value={resetCode}
          onChangeText={(t) => { setResetCode(t); clearError(); }}
          keyboardType="numeric"
          autoFocus
          returnKeyType="next"
        />

        <Text style={s.label}>New password</Text>
        <ThemedInput
          style={s.input}
          placeholder="Choose a new password"
          placeholderTextColor={colors.mutedForeground}
          value={newPassword}
          onChangeText={(t) => { setNewPassword(t); clearError(); }}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleSubmitReset}
        />

        {errorMsg && <Text style={s.error}>{errorMsg}</Text>}

        <Pressable
          style={({ pressed }) => [
            s.btn,
            (!resetCode || !newPassword || forgotBusy) && s.btnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSubmitReset}
          disabled={!resetCode || !newPassword || forgotBusy}
        >
          {forgotBusy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.btnText}>Reset Password</Text>
          )}
        </Pressable>

        <Pressable onPress={handleResendResetCode}>
          <Text style={[s.link, { textAlign: "center" }]}>Resend code</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── MFA verification step ────────────────────────────────────────────────
  if (signIn.status === "needs_client_trust") {
    return (
      <View
        style={[
          s.container,
          { paddingTop: Platform.OS === "web" ? 80 : insets.top + 60 },
        ]}
      >
        <Text style={s.logoText}>Opinion</Text>
        <Text style={s.title}>Verify your account</Text>
        <Text style={s.subtitle}>Enter the code sent to your email</Text>

        <ThemedInput
          style={s.input}
          placeholder="Verification code"
          placeholderTextColor={colors.mutedForeground}
          value={verifyCode}
          onChangeText={(t) => { setVerifyCode(t); clearError(); }}
          keyboardType="numeric"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        {/* Clerk field errors */}
        {errors?.fields?.code && (
          <Text style={s.error}>{errors.fields.code.message}</Text>
        )}
        {/* Caught errors */}
        {errorMsg && <Text style={s.error}>{errorMsg}</Text>}

        <Pressable
          style={({ pressed }) => [
            s.btn,
            (!verifyCode || fetchStatus === "fetching") && s.btnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleVerify}
          disabled={!verifyCode || fetchStatus === "fetching"}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.btnText}>Verify</Text>
          )}
        </Pressable>

        <Pressable onPress={handleResendCode}>
          <Text style={[s.link, { textAlign: "center" }]}>Resend code</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main sign-in form ────────────────────────────────────────────────────
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

      {/* Google SSO */}
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

      {/* Google error shown inline (not modal) */}
      {errorMsg && !fetchStatus && (
        <Text style={[s.error, { marginTop: -8, marginBottom: 12 }]}>
          {errorMsg}
        </Text>
      )}

      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>or</Text>
        <View style={s.dividerLine} />
      </View>

      <Text style={s.label}>Email</Text>
      <ThemedInput
        style={s.input}
        placeholder="you@example.com"
        placeholderTextColor={colors.mutedForeground}
        value={email}
        onChangeText={(t) => { setEmail(t); clearError(); }}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="next"
      />
      {errors?.fields?.identifier && (
        <Text style={s.error}>{errors.fields.identifier.message}</Text>
      )}

      <Text style={s.label}>Password</Text>
      <ThemedInput
        style={s.input}
        placeholder="Your password"
        placeholderTextColor={colors.mutedForeground}
        value={password}
        onChangeText={(t) => { setPassword(t); clearError(); }}
        secureTextEntry
        autoComplete="password"
        returnKeyType="done"
        onSubmitEditing={handleEmailSignIn}
      />
      {errors?.fields?.password && (
        <Text style={s.error}>{errors.fields.password.message}</Text>
      )}

      <Pressable onPress={openForgotPassword} style={{ alignSelf: "flex-end", marginBottom: 14, marginTop: -6 }}>
        <Text style={s.link}>Forgot password?</Text>
      </Pressable>

      {/* Caught sign-in errors shown here */}
      {errorMsg && fetchStatus !== "fetching" && (
        <Text style={[s.error, { marginBottom: 8 }]}>{errorMsg}</Text>
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
    googleIcon: { fontSize: 18, fontWeight: "800", color: "#4285F4" },
    googleText: { fontSize: 15, fontWeight: "600", color: colors.foreground },
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
    btnText: { fontSize: 16, fontWeight: "700", color: colors.primaryForeground },
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
