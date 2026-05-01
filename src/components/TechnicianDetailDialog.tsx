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

const TechnicianDetailDialog = ({ technician, open, onOpenChange, onBook }: Props) => {
  const { i18n, t } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const code = toCode(technician?.id);
  const { data: stat, isLoading } = useTechnicianStat(open ? code : undefined);

  const level = stat ? LEVEL_META[stat.level] || LEVEL_META.silver : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
          <div className="space-y-4">
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

            {/* 简介 */}
            {stat?.bio && (
              <p className="rounded-lg bg-secondary/40 p-3 text-sm text-foreground">
                {stat.bio}
              </p>
            )}

            {/* 认证 */}
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

            {/* 保险 */}
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

            <Button className="w-full" size="lg" onClick={onBook}>
              {isEn ? "Book this sitter" : t("booking.submit", "立即预约")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TechnicianDetailDialog;
