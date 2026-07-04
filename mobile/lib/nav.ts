import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

// router.back() with no history (e.g. a screen opened via deep link or a
// direct URL on web) triggers "GO_BACK was not handled" and does nothing.
// Fall back to a sensible screen instead.
export function goBack(router: Router, fallback: string = "/(tabs)") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
