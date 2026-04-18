/**
 * 通用媒体选择器：图片 / 视频 / Live Photo 全支持
 * 同时显示 Live Photo 角标，提示用户可以多选 .heic + .mov 配对
 */
import { useRef } from "react";
import { Camera, Image as ImageIcon, Video, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  MEDIA_ACCEPT,
  type PreparedMedia,
  prepareMediaFiles,
  validateMediaFile,
  revokePreviews,
} from "@/lib/mediaUpload";
import { cn } from "@/lib/utils";

interface MediaPickerProps {
  value: PreparedMedia[];
  onChange: (next: PreparedMedia[]) => void;
  maxItems?: number;
  /** 是否显示帮助文案（默认显示） */
  showHint?: boolean;
  /** 自定义触发按钮容器 className */
  className?: string;
  /** 单个预览缩略图尺寸 className（默认 w-20 h-20） */
  thumbClassName?: string;
}

const MediaPicker = ({
  value,
  onChange,
  maxItems = 9,
  showHint = true,
  className,
  thumbClassName = "w-20 h-20",
}: MediaPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting same file
    if (!files.length) return;

    for (const f of files) {
      const err = validateMediaFile(f);
      if (err) {
        toast.error(err);
        return;
      }
    }
    const prepared = prepareMediaFiles(files);
    const merged = [...value, ...prepared];
    if (merged.length > maxItems) {
      revokePreviews(prepared);
      toast.error(`最多 ${maxItems} 个文件（含 Live Photo 配对）`);
      return;
    }
    onChange(merged);
  };

  const remove = (idx: number) => {
    const item = value[idx];
    // 如果是 Live Photo，连同配对一起删
    const next = value.filter((m, i) => {
      if (i === idx) return false;
      if (item.liveGroup && m.liveGroup === item.liveGroup) return false;
      return true;
    });
    revokePreviews(value.filter((_, i) => i === idx));
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        hidden
        onChange={handleSelect}
        aria-label="选择图片或视频"
      />

      <div className="flex gap-2 flex-wrap">
        {value.map((m, i) => {
          const isLive = !!m.liveGroup;
          const isPrimary = isLive && m.mediaType === "live_photo_image";
          // Live Photo 视频片段折叠在主图上，不另显示
          if (isLive && m.mediaType === "live_photo_video") return null;
          return (
            <div
              key={`${m.previewUrl}-${i}`}
              className={cn(
                "relative rounded-lg overflow-hidden bg-muted group ring-1 ring-border",
                thumbClassName
              )}
            >
              {m.previewKind === "video" ? (
                <video src={m.previewUrl} className="w-full h-full object-cover" muted playsInline />
              ) : (
                <img
                  src={m.previewUrl}
                  alt={m.file.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}

              {m.previewKind === "video" && !isLive && (
                <span className="absolute bottom-1 left-1 bg-foreground/70 text-background text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Video className="w-2.5 h-2.5" /> 视频
                </span>
              )}
              {isPrimary && (
                <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold">
                  <Sparkles className="w-2.5 h-2.5" /> Live
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="移除"
                className="absolute top-0.5 right-0.5 w-6 h-6 min-w-[24px] min-h-[24px] bg-foreground/70 text-background rounded-full flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {value.filter((m) => m.mediaType !== "live_photo_video").length < maxItems && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[44px]",
              thumbClassName
            )}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">图/视/Live</span>
          </button>
        )}
      </div>

      {showHint && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          支持图片、mp4 视频、Live Photo（同时选择同名 .heic 与 .mov 文件即可识别）。单文件 ≤ 50MB。
        </p>
      )}
    </div>
  );
};

export default MediaPicker;
