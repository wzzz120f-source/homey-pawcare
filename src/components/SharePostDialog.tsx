import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Loader2 } from "lucide-react";

interface SharePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  authorName: string;
  authorAvatar?: string | null;
  contentSnippet: string;
  coverImage?: string | null;
}

const SharePostDialog = ({
  open,
  onOpenChange,
  postId,
  authorName,
  authorAvatar,
  contentSnippet,
  coverImage,
}: SharePostDialogProps) => {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const shareUrl = `${window.location.origin}/post/${postId}`;
  const shareTitle = `${authorName}在萌宠到家分享了一条动态`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(shareUrl, { width: 240, margin: 1, color: { dark: "#3a2a1a", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [open, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "链接已复制", description: "快去分享给好友吧 ✨" });
    } catch {
      toast({ title: "复制失败", description: "请手动复制链接", variant: "destructive" });
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `萌宠到家-动态-${postId.slice(0, 8)}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "卡片已保存", description: "分享到朋友圈传递爱心 ❤️" });
      });
    } catch {
      toast({ title: "保存失败", description: "请重试", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const shareToWeibo = () => {
    const url = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle + " - " + contentSnippet.slice(0, 60))}${coverImage ? `&pic=${encodeURIComponent(coverImage)}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToWeChat = async () => {
    await copyLink();
    toast({
      title: "已复制链接",
      description: "打开微信粘贴给好友，或保存卡片图片分享朋友圈",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">分享动态</DialogTitle>
        </DialogHeader>

        {/* Shareable card preview */}
        <div className="px-4 pb-4">
          <div
            ref={cardRef}
            className="rounded-2xl overflow-hidden border border-border/60"
            style={{
              background: "linear-gradient(160deg, hsl(35 95% 96%) 0%, hsl(25 90% 88%) 100%)",
            }}
          >
            <div className="p-4">
              <div className="flex items-center gap-2.5">
                {authorAvatar ? (
                  <img
                    src={authorAvatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border-2 border-white/80"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold border-2 border-white/80">
                    {authorName[0] || "宠"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#3a2a1a] truncate">{authorName}</p>
                  <p className="text-[11px] text-[#7a5a3a]">来自萌宠到家 · 爱心广场</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-[#3a2a1a] leading-relaxed line-clamp-4 break-words">
                {contentSnippet || "记录与宠物的暖心日常"}
              </p>

              {coverImage && (
                <img
                  src={coverImage}
                  alt=""
                  className="mt-3 w-full aspect-video object-cover rounded-xl"
                  crossOrigin="anonymous"
                />
              )}
            </div>

            <div className="bg-white/70 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="二维码" className="w-16 h-16 rounded-lg bg-white p-1" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white/50 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#3a2a1a]">扫码查看完整动态</p>
                <p className="text-[11px] text-[#7a5a3a] mt-0.5">萌宠到家 · 让每一份爱被看见</p>
                <p className="text-[10px] text-[#a08060] mt-0.5 truncate">{shareUrl}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={copyLink} className="min-h-11 gap-2">
              <Copy className="w-4 h-4" /> 复制链接
            </Button>
            <Button variant="outline" onClick={downloadCard} disabled={downloading} className="min-h-11 gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              保存卡片
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={shareToWeChat}
              className="min-h-11 rounded-md bg-[#07C160] hover:bg-[#06AD56] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span className="text-base">💬</span> 微信
            </button>
            <button
              onClick={shareToWeibo}
              className="min-h-11 rounded-md bg-[#E6162D] hover:bg-[#C81428] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span className="text-base">🌐</span> 微博
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePostDialog;
