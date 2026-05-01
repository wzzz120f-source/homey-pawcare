import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Phone, Stethoscope, FileWarning, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Props {
  orderId?: string | null;
  /** 平台客服电话，可被环境变量/配置覆盖 */
  supportPhone?: string;
  /** 24h 在线兽医电话 */
  vetHotline?: string;
}

type ReportKind = "call_support" | "online_vet" | "report_incident";

const EmergencySosFab = ({
  orderId,
  supportPhone = "400-800-1234",
  vetHotline = "400-900-5678",
}: Props) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isEn = i18n.language?.startsWith("en");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ReportKind | null>(null);
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const labels = {
    fab: isEn ? "Emergency" : "紧急求助",
    title: isEn ? "Emergency Help" : "紧急求助",
    subtitle: isEn
      ? "Choose the help you need — we route you instantly."
      : "选择你需要的帮助，平台会即刻介入。",
    callSupport: isEn ? "Call platform support" : "拨打平台客服",
    onlineVet: isEn ? "Connect 24h vet hotline" : "连接 24 小时宠物医院",
    report: isEn ? "Report an incident" : "上报异常情况",
    descLabel: isEn ? "Describe what happened (optional)" : "描述发生了什么（选填）",
    submit: isEn ? "Submit report" : "提交求助",
    callNow: isEn ? "Call now" : "立即拨打",
    cancel: t("common.cancel"),
    loginNeeded: isEn ? "Please sign in to file an emergency report" : "请先登录以提交紧急求助",
    submitted: isEn ? "Help is on the way" : "已上报，平台客服将立即介入",
    submitFailed: isEn ? "Submit failed, please retry" : "提交失败，请重试",
  };

  const tel = (phone: string) => {
    window.location.href = `tel:${phone.replace(/-/g, "")}`;
  };

  const submitReport = async (kind: ReportKind, contactPhone?: string) => {
    if (!user) {
      toast.error(labels.loginNeeded);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("emergency_reports" as any).insert({
      user_id: user.id,
      order_id: orderId || null,
      report_type: kind,
      description: desc.trim() || null,
      contact_phone: contactPhone || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(labels.submitFailed + (error.message ? `：${error.message}` : ""));
      return;
    }
    toast.success(labels.submitted);
    setOpen(false);
    setMode(null);
    setDesc("");
  };

  return (
    <>
      {/* 浮动按钮 — 行程页右下角 */}
      <button
        type="button"
        aria-label={labels.fab}
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-28 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-destructive-foreground shadow-xl",
          "ring-4 ring-destructive/20 hover:scale-105 active:scale-95 transition-transform",
          "animate-[pulse-ring_2.5s_ease-out_infinite]",
        )}
        style={{ background: "var(--emergency-gradient)" }}
        data-testid="emergency-sos-fab"
      >
        <AlertOctagon className="h-6 w-6" aria-hidden="true" />
        <span className="sr-only">{labels.fab}</span>
      </button>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setMode(null); setDesc(""); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" /> {labels.title}
            </SheetTitle>
            <SheetDescription>{labels.subtitle}</SheetDescription>
          </SheetHeader>

          {!mode ? (
            <div className="mt-4 space-y-2 pb-6">
              <Button
                size="lg"
                variant="destructive"
                className="w-full justify-start gap-3 h-14 shadow-md"
                onClick={() => {
                  tel(supportPhone);
                  submitReport("call_support", supportPhone);
                }}
              >
                <Phone className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="font-bold">{labels.callSupport}</p>
                  <p className="text-xs opacity-90">{supportPhone}</p>
                </div>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full justify-start gap-3 h-14 border-primary/30"
                onClick={() => {
                  tel(vetHotline);
                  submitReport("online_vet", vetHotline);
                }}
              >
                <Stethoscope className="h-5 w-5 text-primary" />
                <div className="flex-1 text-left">
                  <p className="font-bold">{labels.onlineVet}</p>
                  <p className="text-xs text-muted-foreground">{vetHotline}</p>
                </div>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full justify-start gap-3 h-14"
                onClick={() => setMode("report_incident")}
              >
                <FileWarning className="h-5 w-5" />
                <span className="font-bold">{labels.report}</span>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3 pb-6">
              <label className="block text-sm font-semibold text-foreground">
                {labels.descLabel}
              </label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                placeholder={isEn ? "e.g. pet seems unwell during transport…" : "例如：宠物在运输中出现异常……"}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMode(null)}
                  disabled={submitting}
                >
                  <X className="mr-1 h-4 w-4" /> {labels.cancel}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => submitReport("report_incident")}
                  disabled={submitting}
                >
                  {labels.submit}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default EmergencySosFab;
