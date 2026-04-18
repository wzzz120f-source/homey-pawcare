/**
 * 统一媒体处理工具：支持图片、视频、Live Photo（HEIC + MOV 配对）
 * - mp4 / mov / webm 视频
 * - HEIC 静态图（iOS Live Photo 主图）
 * - HEIC + MOV 同名配对自动识别为 Live Photo（live-photo-image / live-photo-video）
 *
 * media_type 取值约定（写入数据库）：
 *  - "image"             普通图片
 *  - "video"             普通视频
 *  - "live_photo_image"  Live Photo 主图（HEIC/JPEG）
 *  - "live_photo_video"  Live Photo 动态片段（MOV）
 *
 * 50MB 单文件上限。超出会被拒绝。
 */

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const VIDEO_MIME_PREFIX = "video/";
export const IMAGE_MIME_PREFIX = "image/";
export const HEIC_EXT = /\.(heic|heif)$/i;
export const LIVE_VIDEO_EXT = /\.mov$/i;

// 浏览器可接受的 file picker accept 字符串
export const MEDIA_ACCEPT =
  "image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.heic,.heif,.mov";

export type MediaKind =
  | "image"
  | "video"
  | "live_photo_image"
  | "live_photo_video";

export interface PreparedMedia {
  file: File;
  /** 数据库 media_type 字段值 */
  mediaType: MediaKind;
  /** 与 Live Photo 配对的 group key（同 group 表示一个 Live Photo） */
  liveGroup?: string;
  /** 浏览器内预览用的 URL.createObjectURL(file) */
  previewUrl: string;
  /** 适合预览的 thumbnail kind，方便 UI 决定是否显示 video 标签 */
  previewKind: "image" | "video";
}

const stripExt = (name: string) =>
  name.replace(/\.[^.]+$/, "").toLowerCase().trim();

/**
 * 校验单个文件，返回 user-facing 错误（null 表示通过）
 */
export function validateMediaFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} 超过 50MB 上限`;
  }
  const isImg = file.type.startsWith(IMAGE_MIME_PREFIX) || HEIC_EXT.test(file.name);
  const isVid = file.type.startsWith(VIDEO_MIME_PREFIX) || LIVE_VIDEO_EXT.test(file.name);
  if (!isImg && !isVid) {
    return `${file.name} 文件类型不支持`;
  }
  return null;
}

/**
 * 把用户挑选的多文件分组：
 *  - 同名 .heic + .mov → Live Photo
 *  - 其余按图片 / 视频归类
 */
export function prepareMediaFiles(files: File[]): PreparedMedia[] {
  const byBase = new Map<string, File[]>();
  for (const f of files) {
    const base = stripExt(f.name);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push(f);
  }

  const out: PreparedMedia[] = [];
  for (const [base, group] of byBase.entries()) {
    const heic = group.find((f) => HEIC_EXT.test(f.name));
    const mov = group.find((f) => LIVE_VIDEO_EXT.test(f.name));

    if (heic && mov) {
      // Live Photo 配对
      const liveGroup = `${base}-${Date.now()}`;
      out.push({
        file: heic,
        mediaType: "live_photo_image",
        liveGroup,
        previewUrl: URL.createObjectURL(heic),
        previewKind: "image",
      });
      out.push({
        file: mov,
        mediaType: "live_photo_video",
        liveGroup,
        previewUrl: URL.createObjectURL(mov),
        previewKind: "video",
      });
      continue;
    }

    for (const f of group) {
      const isVid = f.type.startsWith(VIDEO_MIME_PREFIX) || LIVE_VIDEO_EXT.test(f.name);
      out.push({
        file: f,
        mediaType: isVid ? "video" : "image",
        previewUrl: URL.createObjectURL(f),
        previewKind: isVid ? "video" : "image",
      });
    }
  }
  return out;
}

export function revokePreviews(items: PreparedMedia[]) {
  for (const it of items) {
    try {
      URL.revokeObjectURL(it.previewUrl);
    } catch {
      /* noop */
    }
  }
}

/**
 * 上传到 Supabase storage，返回 public URL
 */
export async function uploadPreparedMedia(
  supabase: any,
  bucket: string,
  userId: string,
  item: PreparedMedia,
  folder = "media"
): Promise<{ url: string; mediaType: MediaKind; liveGroup?: string }> {
  const ext = item.file.name.split(".").pop() || "bin";
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, item.file, {
    contentType: item.file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, mediaType: item.mediaType, liveGroup: item.liveGroup };
}
