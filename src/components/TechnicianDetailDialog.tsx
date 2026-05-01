import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, ShieldCheck, Award, BadgeCheck, Briefcase, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTechnicianStat, useTechnicianReviews } from "@/hooks/useSafetyData";
import type { Technician } from "@/types";

interface Props {
  technician: Technician | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBook?: () => void;
}


const LEVEL_META: Record<
  string,
  { labelZh: string; labelEn: string; cls: string }
> = {
  bronze: { labelZh: "铜牌", labelEn: "Bronze", cls: "bg-[hsl(var(--badge-bronze-bg))] text-[hsl(var(--badge-bronze-fg))] border-[hsl(var(--badge-bronze-border))]" },
  silver: { labelZh: "银牌", labelEn: "Silver", cls: "bg-[hsl(var(--badge-silver-bg))] text-[hsl(var(--badge-silver-fg))] border-[hsl(var(--badge-silver-border))]" },
  gold: { labelZh: "金牌", labelEn: "Gold", cls: "bg-[hsl(var(--badge-gold-bg))] text-[hsl(var(--badge-gold-fg))] border-[hsl(var(--badge-gold-border))]" },
  platinum: { labelZh: "白金", labelEn: "Platinum", cls: "bg-[hsl(var(--badge-platinum-bg))] text-[hsl(var(--badge-platinum-fg))] border-[hsl(var(--badge-platinum-border))]" },
  diamond: { labelZh: "钻石", labelEn: "Diamond", cls: "bg-[hsl(var(--badge-platinum-bg))] text-[hsl(var(--badge-platinum-fg))] border-[hsl(var(--badge-platinum-border))]" },
};

/**
 * 把前端 services.ts 的 technician id (`tech-1`) 映射到 DB 的 technician_code (`tech_001`)
 */
const toCode = (id: string | undefined): string | undefined => {
  if (!id) return undefined;
  const m = id.match(/(\d+)/);
  if (!m) return undefined;
  return `tech_${m[1].padStart(3, "0")}`;
};

const SERVICE_LABEL: Record<string, { zh: string; en: string }> = {
  pet_walking: { zh: "遛狗陪伴", en: "Dog walking" },
  pet_sitting: { zh: "上门照看", en: "Pet sitting" },
  pet_grooming: { zh: "宠物美容", en: "Grooming" },
  pet_pickup: { zh: "宠物接送", en: "Pickup" },
};

const formatTime = (iso: string, isEn: boolean) => {
  const d = new Date(iso);
  const now = Date.now();
  const diffH = (now - d.getTime()) / 3600000;
  if (diffH < 1) return isEn ? "Just now" : "刚刚";
  if (diffH < 24) return isEn ? `${Math.floor(diffH)}h ago` : `${Math.floor(diffH)} 小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return isEn ? `${diffD}d ago` : `${diffD} 天前`;
  return d.toLocaleDateString(isEn ? "en-US" : "zh-CN", { month: "2-digit", day: "2-digit" });
};

const TechnicianDetailDialog = ({ technician, open, onOpenChange, onBook }: Props) => {
  const { i18n, t } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const code = toCode(technician?.id);
  const { data: stat, isLoading } = useTechnicianStat(open ? code : undefined);

  // ── Reviews state: 等级筛选 + 分页加载 ──
  const [reviewLevel, setReviewLevel] = useState<string>("all");
  const [reviewLimit, setReviewLimit] = useState<number>(5);
  const { data: reviews = [], isLoading: reviewsLoading } = useTechnicianReviews(
    open ? code : undefined,
    reviewLevel,
    reviewLimit,
  );
  const canLoadMore = reviews.length >= reviewLimit;

  const level = stat ? LEVEL_META[stat.level] || LEVEL_META.silver : null;

  const filterChips: { value: string; label: string }[] = [
    { value: "all", label: isEn ? "All levels" : "全部等级" },
    { value: "gold", label: isEn ? "Gold" : "金牌" },
    { value: "platinum", label: isEn ? "Platinum" : "白金" },
    { value: "silver", label: isEn ? "Silver" : "银牌" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {technician?.name}
            {level && (
              <Badge variant="outline" className={level.cls}>
                <Award className="mr-1 h-3 w-3" />
                {isEn ? level.labelEn : level.labelZh}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{technician?.specialty}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-2">
              {/* 关键指标 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Star className="mx-auto h-4 w-4 fill-primary text-primary" aria-hidden="true" />
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {stat?.avg_rating?.toFixed(2) ?? technician?.rating?.toFixed(1) ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isEn ? "Rating" : "评分"}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <BadgeCheck className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {stat?.total_services?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isEn ? "Services" : "服务次数"}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Briefcase className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {stat?.years_of_experience ?? "—"}
                    <span className="text-xs font-medium text-muted-foreground">
                      {isEn ? "y" : "年"}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isEn ? "Experience" : "从业年限"}
                  </p>
                </div>
              </div>

              {stat?.bio && (
                <p className="rounded-lg bg-secondary/40 p-3 text-sm text-foreground">
                  {stat.bio}
                </p>
              )}

              {stat?.certifications && stat.certifications.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    {isEn ? "Certifications" : "专业认证"}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {stat.certifications.map((c) => (
                      <Badge key={c} variant="secondary" className="text-[11px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {stat?.insurance_no && (
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">
                      {isEn ? "Insurance covered" : "保险覆盖"}
                    </p>
                    <p className="font-mono text-muted-foreground">{stat.insurance_no}</p>
                  </div>
                </div>
              )}

              {/* ── 最近评价 ── */}
              <section aria-label={isEn ? "Recent reviews" : "最近评价"}>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    {isEn ? "Recent reviews" : "最近评价"}
                  </h4>
                </div>

                {/* 等级筛选 */}
                <div role="radiogroup" aria-label={isEn ? "Filter by level" : "按等级筛选"} className="mb-2 flex flex-wrap gap-1.5">
                  {filterChips.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={reviewLevel === c.value}
                      onClick={() => { setReviewLevel(c.value); setReviewLimit(5); }}
                      className={
                        "h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors " +
                        (reviewLevel === c.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted")
                      }
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {reviewsLoading && reviews.length === 0 ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                    {isEn ? "No reviews under this level yet." : "该等级暂无评价"}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reviews.map((r) => {
                      const svc = SERVICE_LABEL[r.service_type];
                      return (
                        <li key={r.id} className="rounded-lg border bg-card p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-foreground truncate">{r.reviewer_name}</span>
                              <span className="flex items-center" aria-label={`${isEn ? "Rating" : "评分"} ${r.rating}/5`}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={
                                      "h-3 w-3 " +
                                      (i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30")
                                    }
                                    aria-hidden="true"
                                  />
                                ))}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatTime(r.created_at, isEn)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] py-0 h-4">
                              {svc ? (isEn ? svc.en : svc.zh) : r.service_type}
                            </Badge>
                            {LEVEL_META[r.technician_level] && (
                              <Badge variant="outline" className={"text-[10px] py-0 h-4 " + LEVEL_META[r.technician_level].cls}>
                                {isEn ? LEVEL_META[r.technician_level].labelEn : LEVEL_META[r.technician_level].labelZh}
                              </Badge>
                            )}
                          </div>
                          <p className="text-foreground/90 leading-relaxed">{r.content}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canLoadMore && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-xs"
                    onClick={() => setReviewLimit((n) => n + 5)}
                    disabled={reviewsLoading}
                  >
                    {reviewsLoading ? (isEn ? "Loading…" : "加载中…") : (isEn ? "View more history" : "查看更多历史记录")}
                  </Button>
                )}
              </section>

              <Button className="w-full sticky bottom-0" size="lg" onClick={onBook}>
                {isEn ? "Book this sitter" : t("booking.submit", "立即预约")}
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TechnicianDetailDialog;
