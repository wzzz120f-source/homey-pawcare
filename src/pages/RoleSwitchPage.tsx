import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, User, Heart, Scissors, Car, Store, ShieldCheck, Check, Lock, Info, Hotel } from "lucide-react";
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
  user:     { label: "铲屎官", icon: User,        toneLabel: "暖橙",   toneHex: "#FF8C00", home: "/",                desc: "预约上门服务、查看宠物档案、接收实时报告" },
  sitter:   { label: "宠托师", icon: Heart,       toneLabel: "明黄",   toneHex: "#FFD700", home: "/worker?tab=schedule", desc: "查看今日待办、GPS 打卡、一键生成图文日志", applyPath: "/sitter/apply" },
  groomer:  { label: "护理师", icon: Scissors,    toneLabel: "医用绿", toneHex: "#2E8B57", home: "/worker?tab=services", desc: "结构化健康评估、AI 医疗建议、等级徽章",     applyPath: "/groomer/apply" },
  driver:   { label: "司机",   icon: Car,         toneLabel: "天空蓝", toneHex: "#1E90FF", home: "/worker?tab=route",    desc: "实时地图、接送任务单、里程结算",            applyPath: "/driver/apply" },
  merchant: { label: "商家",   icon: Store,       toneLabel: "深靛青", toneHex: "#000080", home: "/merchant",        desc: "考勤看板、SKU 定价、扫码核销、营业额看板",   applyPath: "/merchant/apply" },
  admin:    { label: "审核员", icon: ShieldCheck, toneLabel: "深蓝",   toneHex: "#1E3A8A", home: "/admin/review",    desc: "内容与商家审核、违规处理、申诉裁决" },
  hotel_owner: { label: "酒店方", icon: Hotel, toneLabel: "暖橙", toneHex: "#FF8C00", home: "/merchant/hotel", desc: "管理房型、入住打卡、上传探视照片、退房结算" },
};

const ALL_ROLES: ActiveRole[] = ["user", "sitter", "groomer", "driver", "merchant", "admin", "hotel_owner"];

const ROLE_ALLOWED_PREFIXES: Record<ActiveRole, string[]> = {
  user:     ["/", "/community", "/shop", "/customer-service", "/profile", "/orders", "/booking", "/pet-hotel", "/post", "/product", "/points", "/charity-footprint", "/pets", "/track", "/rate", "/group-booking"],
  sitter:   ["/worker", "/orders", "/profile"],
  groomer:  ["/worker", "/orders", "/profile"],
  driver:   ["/worker", "/orders", "/profile", "/track"],
  merchant: ["/merchant", "/orders", "/profile", "/shop"],
  admin:    ["/admin", "/", "/community", "/shop", "/profile", "/orders"],
  hotel_owner: ["/merchant/hotel", "/orders", "/profile"],
};

const isCompatible = (role: ActiveRole, pathname: string) => {
  const prefixes = ROLE_ALLOWED_PREFIXES[role];
  return prefixes.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")));
};

const RoleSwitchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const { activeRole, availableRoles, setActiveRole, loading } = useUserRoles();

  const highlight = sp.get("highlight") as ActiveRole | null;
  const from = sp.get("from") || "";
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (highlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlight]);

  const returnUrl = useMemo(() => location.pathname + location.search, [location.pathname, location.search]);

  const handleSwitch = (r: ActiveRole) => {
    if (!availableRoles.includes(r)) {
      const meta = ROLE_META[r];
      if (!meta.applyPath) {
        toast.info(`${meta.label}暂未开放申请`);
        return;
      }
      navigate(`${meta.applyPath}?return=${encodeURIComponent(returnUrl)}`);
      return;
    }
    setActiveRole(r === "user" ? null : r);
    toast.success(`已切换到「${ROLE_META[r].label}」`);
    // 跳转优先级：from > 兼容则停留 > 角色 home
    if (from) {
      navigate(from, { replace: true });
    } else if (isCompatible(r, location.pathname) && location.pathname !== "/roles") {
      // 已经在兼容路径上则保留
      // noop
    } else {
      navigate(ROLE_META[r].home);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-2 px-3 h-14 max-w-lg mx-auto">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)} aria-label="返回" className="min-w-[44px] min-h-[44px]">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-extrabold text-lg flex-1">身份切换</h1>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
            当前 · {ROLE_META[activeRole].label}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {highlight && ROLE_META[highlight] && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2" role="status">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs text-foreground leading-relaxed">
              {from ? <>你刚才尝试访问 <code className="px-1 py-0.5 rounded bg-muted text-[11px]">{decodeURIComponent(from)}</code>，</> : null}
              需要切换到 <strong className="text-primary">{ROLE_META[highlight].label}</strong> 身份。
              {!availableRoles.includes(highlight) && ROLE_META[highlight].applyPath && "（你尚未拥有该身份，可点击下方卡片申请）"}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          选择一个身份进入对应工作台。未授权的角色可点击「去申请」提交资质审核。
        </p>

        <ul className="space-y-3" aria-label="角色列表">
          {ALL_ROLES.map((r) => {
            const m = ROLE_META[r];
            const Icon = m.icon;
            const isActive = r === activeRole;
            const isAvailable = availableRoles.includes(r);
            const isHighlight = highlight === r;
            return (
              <li key={r} ref={isHighlight ? highlightRef : undefined}>
                <button
                  type="button"
                  onClick={() => handleSwitch(r)}
                  disabled={loading}
                  aria-current={isActive ? "true" : undefined}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition-all min-h-[88px] flex items-center gap-4 ${
                    isHighlight
                      ? "border-primary bg-primary/10 animate-pulse"
                      : isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : isAvailable
                      ? "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                      : "border-border/60 bg-muted/30 hover:border-border"
                  }`}
                  style={{ boxShadow: isActive ? `0 4px 18px -6px ${m.toneHex}55` : undefined }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${m.toneHex}1A`, color: m.toneHex }}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-foreground">{m.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${m.toneHex}1A`, color: m.toneHex }}>{m.toneLabel}</span>
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
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Check className="w-4 h-4" />使用中</span>
                    ) : isAvailable ? (
                      <span className="text-xs font-medium text-muted-foreground">切换 →</span>
                    ) : m.applyPath ? (
                      <span className="text-xs font-medium text-primary">去申请</span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">未开放</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 p-3 rounded-xl bg-muted/40 text-[11px] text-muted-foreground leading-relaxed">
          提示：身份切换会改变底部导航栏与主功能区。若当前页面与新角色兼容，将保留你正在浏览的页面与筛选条件；否则跳转到该角色的工作台。
        </div>
      </main>
    </div>
  );
};

export default RoleSwitchPage;
