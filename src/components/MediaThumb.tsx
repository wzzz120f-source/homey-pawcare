/**
 * 统一渲染数据库中的媒体（image / video / live_photo_image / live_photo_video）
 * 给定 media_type 与 url，自动选择 <img> 或 <video> 并显示对应角标
 */
import { Sparkles, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaThumbProps {
  url: string;
  mediaType: string;
  alt?: string;
  className?: string;
  /** 视频是否启用 controls，默认 true */
  videoControls?: boolean;
  /** 是否显示左下角角标，默认 true */
  showBadge?: boolean;
}

const MediaThumb = ({
  url,
  mediaType,
  alt = "",
  className,
  videoControls = true,
  showBadge = true,
}: MediaThumbProps) => {
  const isVideo = mediaType === "video" || mediaType === "live_photo_video";
  const isLivePhoto = mediaType === "live_photo_image";

  return (
    <div className={cn("relative bg-muted overflow-hidden", className)}>
      {isVideo ? (
        <video
          src={url}
          className="w-full h-full object-cover"
          controls={videoControls}
          playsInline
          preload="metadata"
        />
      ) : (
        <img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      )}

      {showBadge && isVideo && mediaType === "video" && (
        <span className="absolute bottom-1 left-1 bg-foreground/70 text-background text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 pointer-events-none">
          <Video className="w-2.5 h-2.5" /> 视频
        </span>
      )}
      {showBadge && isLivePhoto && (
        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold pointer-events-none">
          <Sparkles className="w-2.5 h-2.5" /> Live
        </span>
      )}
    </div>
  );
};

export default MediaThumb;
