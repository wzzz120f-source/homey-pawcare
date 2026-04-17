import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface UserBadge {
  id?: string;
  badge_code: string;
  badge_name: string;
  badge_icon: string;
  badge_level?: string;
}

const LEVEL_STYLES: Record<string, string> = {
  bronze: "bg-badge-bronze text-badge-bronze-foreground border-badge-bronze-border",
  silver: "bg-badge-silver text-badge-silver-foreground border-badge-silver-border",
  gold: "bg-badge-gold text-badge-gold-foreground border-badge-gold-border",
  platinum: "bg-badge-platinum text-badge-platinum-foreground border-badge-platinum-border",
};

interface Props {
  badge: UserBadge;
  size?: "xs" | "sm";
  className?: string;
}

export const UserBadgeChip = ({ badge, size = "xs", className }: Props) => {
  const style = LEVEL_STYLES[badge.badge_level || "bronze"] || LEVEL_STYLES.bronze;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-0.5 font-semibold border",
        size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        style,
        className,
      )}
      title={badge.badge_name}
    >
      <span>{badge.badge_icon}</span>
      <span>{badge.badge_name}</span>
    </Badge>
  );
};

export const UserBadgeRow = ({ badges, max = 2 }: { badges: UserBadge[]; max?: number }) => {
  if (!badges || badges.length === 0) return null;
  const visible = badges.slice(0, max);
  const rest = badges.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((b) => (
        <UserBadgeChip key={b.badge_code} badge={b} />
      ))}
      {rest > 0 && (
        <span className="text-[10px] text-muted-foreground">+{rest}</span>
      )}
    </div>
  );
};
