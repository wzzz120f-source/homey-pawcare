import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Heart, Scissors, Car, Store, ShieldCheck, Check, Lock } from "lucide-react";
import { useUserRoles, type ActiveRole } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Meta = {
  label: string;
  icon: typeof User;
  toneLabel: string;
  toneHex: string;
  home: string;
  desc: string;
  applyPath?: string;
};

const ROLE_META: Record<ActiveRole, Meta> = {
  user: {
    label: "铲屎官",
    icon: User,
    toneLabel: "暖橙",
    toneHex: "#FF8C00",
    home: "/",
    desc: "预约上门服务、查看宠物档案、接收实时报告",
  },
  sitter: {
    label: "宠托师",
    icon: Heart,
    toneLabel: "明黄",
    toneHex: "#FFD700",
    home: "/worker?tab=schedule",
    desc: "查看今日待办、GPS 打卡、一键生成图文日志",
    applyPath: "/driver/apply",
  },
  groomer: {
    label: "护理师",
    icon: Scissors,
    toneLabel: "医用绿",
    toneHex: "#2E8B57",
    home: "/worker?tab=services",
    desc: "结构化健康评估、AI 医疗建议、等级徽章",
    applyPath: "/driver/apply",
  },
  driver: {
    label: "司机",
    icon: Car,
    toneLabel: "天空蓝",
    toneHex: "#1E90FF",
    home: "/worker?tab=route",
    desc: "实时地图、接送任务单、里程结算",
    applyPath: "/driver/apply",
  },
  merchant: {
    label: "商家",
    icon: Store,
    toneLabel: "深靛青",
    toneHex: "#000080",
    home: "/merchant",
    desc: "考勤看板、SKU 定价、扫码核销、营业额看板",
    applyPath: "/merchant/apply",
  },
  admin: {
    label: "审核员",
    icon: ShieldCheck,
    toneLabel: "深蓝",
    toneHex: "#1E3A8A",
    home: "/admin/review",
    desc: "内容与商家审核、违规处理、申诉裁决",
  },
};

const ALL_ROLES: ActiveRole[] = ["user", "sitter", "groomer", "driver", "merchant", "admin"];

const RoleSwitchPage = () => {
  const navigate = useNavigate();
  const { activeRole, availableRoles, setActiveRole, loading } = useUserRoles();

  const handleSwitch = (r: ActiveRole) => {
    if (!availableRoles.includes(r)) {
      const meta = ROLE_META[r];
      toast.info(`你还不是${meta.label}`, {
        description: meta.applyPath ? "前往申请页面提交资质" : "暂无申请入口",
        action: meta.applyPath
          ? { label: "去申请", onClick: () => navigate(meta.applyPath!) }
          : undefined,
      });
      return;
    }
    setActiveRole(r === "user" ? null : r);
    toast.success(`已切换到「${ROLE_META[r].label}」`);
    navigate(ROLE_META[r].home);
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-2 px-3 h-14 max-w-lg mx-auto">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="min-w-[44px] min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-extrabold text-lg flex-1">身份切换</h1>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
            当前 · {ROLE_META[activeRole].label}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        <p className="text-sm text-muted-foreground mb-4">
          选择一个身份进入对应工作台。未授权的角色可点击「去申请」提交资质审核。
        </p>

        <ul className="space-y-3" aria-label="角色列表">
          {ALL_ROLES.map((r) => {
            const m = ROLE_META[r];
            const Icon = m.icon;
            const isActive = r === activeRole;
            const isAvailable = availableRoles.includes(r);
            return (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => handleSwitch(r)}
                  disabled={loading}
                  aria-current={isActive ? "true" : undefined}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition-all min-h-[88px] flex items-center gap-4 ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : isAvailable
                      ? "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                      : "border-border/60 bg-muted/30 hover:border-border"
                  }`}
                  style={{
                    boxShadow: isActive ? `0 4px 18px -6px ${m.toneHex}55` : undefined,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${m.toneHex}1A`, color: m.toneHex }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">{m.label}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: `${m.toneHex}1A`, color: m.toneHex }}
                      >
                        {m.toneLabel}
                      </span>
                      {!isAvailable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />未授权
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.desc}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Check className="w-4 h-4" />使用中
                      </span>
                    ) : isAvailable ? (
                      <span className="text-xs font-medium text-muted-foreground">切换 →</span>
                    ) : (
                      <span className="text-xs font-medium text-primary">去申请</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 p-3 rounded-xl bg-muted/40 text-[11px] text-muted-foreground leading-relaxed">
          提示：身份切换会改变底部导航栏与主功能区。商家与审核员路由受 RoleGuard 保护，未授权访问将自动跳回首页。
        </div>
      </main>
    </div>
  );
};

export default RoleSwitchPage;
