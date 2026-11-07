import { Capacitor } from "@capacitor/core";

/** True inside the Capacitor iOS shell, false in any browser. */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export type HapticKind = "tap" | "success" | "error";

/** Fire-and-forget haptic. No-op off native or when disabled. Never throws. */
export async function haptic(kind: HapticKind, enabled: boolean): Promise<void> {
  if (!enabled || !isNative()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "tap") await Haptics.impact({ style: ImpactStyle.Light });
    else await Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Error });
  } catch {
    /* haptics are decoration; gameplay never depends on them */
  }
}
