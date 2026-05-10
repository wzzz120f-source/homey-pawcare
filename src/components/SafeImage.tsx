import { useState, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  /** 失败时显示的兜底图片，留空使用爪印图标 */
  fallback?: string;
  /** 占位骨架是否展示（默认 true） */
  withSkeleton?: boolean;
  /** 兜底容器的额外类 */
  fallbackClassName?: string;
}

/**
 * 安全图片：加载中显示骨架屏，失败显示统一兜底。
 */
const SafeImage = ({
  src,
  fallback,
  withSkeleton = true,
  className,
  fallbackClassName,
  alt,
  ...rest
}: Props) => {
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");

  if (state === "error") {
    if (fallback) {
      return (
        <img
          src={fallback}
          alt={alt}
          className={cn("object-cover", className)}
          {...rest}
        />
      );
    }
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
          fallbackClassName,
        )}
        aria-label={alt || "图片加载失败"}
      >
        <ImageOff className="w-1/3 h-1/3 max-w-12 max-h-12 opacity-50" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {state === "loading" && withSkeleton && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      )}
      <img
        src={src}
        alt={alt}
        className={cn("w-full h-full object-cover", state === "loading" && "opacity-0")}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
        loading="lazy"
        {...rest}
      />
    </div>
  );
};

export default SafeImage;
