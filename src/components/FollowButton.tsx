import { Button } from "@/components/ui/button";
import { useFollow } from "@/hooks/useFollow";
import { useAuth } from "@/hooks/useAuth";
import { Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  targetUserId?: string | null;
  size?: "sm" | "default";
  className?: string;
}

const FollowButton = ({ targetUserId, size = "sm", className }: FollowButtonProps) => {
  const { user } = useAuth();
  const { isFollowing, loading, toggle } = useFollow(targetUserId);

  if (!targetUserId || (user && user.id === targetUserId)) return null;

  return (
    <Button
      size={size}
      variant={isFollowing ? "secondary" : "default"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      }}
      disabled={loading}
      className={cn("rounded-full gap-1 min-h-[32px] text-xs font-bold", className)}
      aria-label={isFollowing ? "已关注，点击取消" : "关注"}
    >
      {isFollowing ? (
        <>
          <Check className="w-3.5 h-3.5" /> 已关注
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" /> 关注
        </>
      )}
    </Button>
  );
};

export default FollowButton;
