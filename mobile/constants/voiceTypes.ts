export type VoiceType = "expert" | "brand" | "public" | "creator";

export const VOICE_CONFIG: Record<VoiceType, { label: string; icon: string; color: string; description: string }> = {
  expert: {
    label: "Expert Voice",
    icon: "shield",
    color: "#3b82f6",
    description: "Verified specialist — doctor, lawyer, economist, academic",
  },
  brand: {
    label: "Brand Voice",
    icon: "briefcase",
    color: "#8b5cf6",
    description: "Verified business or organisation",
  },
  public: {
    label: "Public Voice",
    icon: "award",
    color: "#f59e0b",
    description: "Verified public figure or celebrity",
  },
  creator: {
    label: "Creator Voice",
    icon: "mic",
    color: "#10b981",
    description: "Verified content creator or community builder",
  },
};

export const ALL_VOICE_TYPES: VoiceType[] = ["expert", "brand", "public", "creator"];
