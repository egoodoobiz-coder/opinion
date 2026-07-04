import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Android's SecureStore (backed by EncryptedSharedPreferences on many devices)
// silently fails to write values above ~2048 bytes. Clerk session JWTs grow
// with unsafeMetadata (isPremium, voiceType, demographics, etc.) and can
// exceed that limit, which breaks session persistence without any error
// surfacing — the sign-in appears to succeed but is signed out on next check.
// This cache transparently splits large values across multiple keys.

const CHUNK_SIZE = 1800;
const secureStoreOpts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

function chunkKey(key: string, index: number) {
  return `${key}_chunk_${index}`;
}

async function clearChunks(key: string) {
  const countRaw = await SecureStore.getItemAsync(`${key}_chunk_count`, secureStoreOpts).catch(() => null);
  const count = countRaw ? parseInt(countRaw, 10) : 0;
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i), secureStoreOpts).catch(() => {});
  }
  await SecureStore.deleteItemAsync(`${key}_chunk_count`, secureStoreOpts).catch(() => {});
}

const nativeTokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const countRaw = await SecureStore.getItemAsync(`${key}_chunk_count`, secureStoreOpts);
      if (countRaw) {
        const count = parseInt(countRaw, 10);
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const part = await SecureStore.getItemAsync(chunkKey(key, i), secureStoreOpts);
          if (part === null) return null;
          parts.push(part);
        }
        return parts.join("");
      }
      return await SecureStore.getItemAsync(key, secureStoreOpts);
    } catch {
      await clearChunks(key).catch(() => {});
      await SecureStore.deleteItemAsync(key, secureStoreOpts).catch(() => {});
      return null;
    }
  },

  async saveToken(key: string, token: string): Promise<void> {
    await clearChunks(key).catch(() => {});
    await SecureStore.deleteItemAsync(key, secureStoreOpts).catch(() => {});

    if (token.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, token, secureStoreOpts);
      return;
    }

    const count = Math.ceil(token.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      const part = token.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(chunkKey(key, i), part, secureStoreOpts);
    }
    await SecureStore.setItemAsync(`${key}_chunk_count`, String(count), secureStoreOpts);
  },
};

// SecureStore only exists on native; on web Clerk manages its own storage
// (same as @clerk/expo's default, which passes undefined outside native).
export const tokenCache = Platform.OS === "web" ? undefined : nativeTokenCache;
