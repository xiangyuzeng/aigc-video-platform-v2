/** Task status values matching backend enum */
export const TASK_STATUS = {
  DRAFT: "draft",
  QUEUED: "queued",
  UPLOADING: "uploading",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

/** Video status values */
export const VIDEO_STATUS = {
  READY: "ready",
  ASSIGNED: "assigned",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

/** Supported platforms */
export const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
] as const;

/** Timezone presets — ordered by usage frequency */
export const TIMEZONE_PRESETS = [
  { value: "America/Mexico_City", label: "🇲🇽 墨西哥 (Mexico City)" },
  { value: "America/New_York", label: "🇺🇸 美东 (New York)" },
  { value: "America/Chicago", label: "🇺🇸 美中 (Chicago)" },
  { value: "America/Los_Angeles", label: "🇺🇸 美西 (Los Angeles)" },
  { value: "Asia/Shanghai", label: "🇨🇳 中国 (Shanghai)" },
  { value: "Asia/Tokyo", label: "🇯🇵 日本 (Tokyo)" },
  { value: "Europe/London", label: "🇬🇧 伦敦 (London)" },
] as const;

/** Default timezone for new tasks */
export const DEFAULT_TIMEZONE = "America/Mexico_City";
