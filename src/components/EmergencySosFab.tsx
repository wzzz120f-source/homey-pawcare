import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Phone, Stethoscope, FileWarning, X, CheckCircle2, Clock, Copy, ChevronLeft } from "lucide-react";
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
  supportPhone?: string;
  vetHotline?: string;
}

type ReportKind = "call_support" | "online_vet" | "report_incident";

interface TicketResult {
  ticket_no: string;
  eta_minutes: number;
  status: string;
  kind: ReportKind;
  created_at: string;
}

const KIND_META: Record<ReportKind, { etaFallback: number; iconColorCls: string }> = {
  call_support: { etaFallback: 2, iconColorCls: "text-destructive" },
  online_vet: { etaFallback: 5, iconColorCls: "text-primary" },
  report_incident: { etaFallback: 15, iconColorCls: "text-amber-600" },
};

const EmergencySosFab = ({
  orderId,
  supportPhone = "400-800-1234",
  vetHotline = "400-900-5678",
}: Props) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isEn = i18n.language?.startsWith("en");
  const [open, setOpen] = useState(false);

  // Stage machine: list → confirm → form (only for incident report) → submitting → result
  type Stage = "list" | "confirm" | "form" | "result";
  const [stage, setStage] = useState<Stage>("list");
  const [pendingKind, setPendingKind] = useState<ReportKind | null>(null);
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<TicketResult | null>(null);

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
    callNow: isEn ? "Confirm & call now" : "确认并立即拨打",
    confirmConnect: isEn ? "Confirm & connect" : "确认并接通",
    cancel: t("common.cancel"),
    back: t("common.back"),
    loginNeeded: isEn ? "Please sign in to file an emergency report" : "请先登录以提交紧急求助",
    submitFailed: isEn ? "Submit failed, please retry" : "提交失败，请重试",
    eta: isEn ? "Estimated response" : "预计响应时间",
    minutes: isEn ? "minutes" : "分钟",
    ticketNo: isEn ? "Ticket No." : "工单号",
    statusOpen: isEn ? "Open · in queue" : "已建单 · 处理中",
    trackable: isEn ? "Track this ticket in My Reports anytime." : "可在「我的求助」中持续追踪进展。",
    copyTicket: isEn ? "Copy ticket number" : "复制工单号",
    copied: isEn ? "Copied" : "已复制",
    done: isEn ? "Done" : "完成",
    confirmTitle: {
      call_support: isEn ? "Confirm calling support?" : "确认拨打客服？",
      online_vet: isEn ? "Confirm connecting to vet hotline?" : "确认连接 24 小时兽医？",
      report_incident: isEn ? "Confirm submitting an incident report?" : "确认上报异常情况？",
    } as Record<ReportKind, string>,
    confirmDesc: {
      call_support: isEn
        ? "Your phone app will open and call our 7×24 support line. A ticket will also be created so we can follow up."
        : "我们将打开拨号界面并拨打平台 7×24 客服热线，同时为你建立工单便于回访。",
      online_vet: isEn
        ? "We'll dial the partnered vet emergency line and create a tracking ticket."
        : "将拨打合作宠物医院 24 小时急诊电话，并建立可追踪工单。",
      report_incident: isEn
        ? "Submit details to platform safety team. A specialist will reach out shortly."
        : "提交后平台安全专员将主动联系你处理。",
    } as Record<ReportKind, string>,
  };

  const tel = (phone: string) => {
    window.location.href = `tel:${phone.replace(/-/g, "")}`;
  };

  const resetAll = () => {
    setStage("list");
    setPendingKind(null);
    setDesc("");
    setTicket(null);
  };

  const requestKind = (kind: ReportKind) => {
    setPendingKind(kind);
    setStage(kind === "report_incident" ? "confirm" : "confirm");
  };

  const phoneFor = (kind: ReportKind) =>
    kind === "call_support" ? supportPhone : kind === "online_vet" ? vetHotline : null;

  const submitReport = async () => {
    if (!pendingKind) return;
    if (!user) {
      toast.error(labels.loginNeeded);
      return;
    }
    setSubmitting(true);
    const phone = phoneFor(pendingKind);
    const { data, error } = await supabase
      .from("emergency_reports" as any)
      .insert({
        user_id: user.id,
        order_id: orderId || null,
        report_type: pendingKind,
        description: desc.trim() || null,
        contact_phone: phone || null,
      } as any)
      .select("ticket_no, eta_minutes, status, report_type, created_at")
      .maybeSingle();
    setSubmitting(false);
    if (error || !data) {
      toast.error(labels.submitFailed + (error?.message ? `：${error.message}` : ""));
      return;
    }
    const row = data as any;
    setTicket({
      ticket_no: row.ticket_no || "—",
      eta_minutes: row.eta_minutes ?? KIND_META[pendingKind].etaFallback,
      status: row.status || "open",
      kind: pendingKind,
      created_at: row.created_at,
    });
    if (phone) tel(phone);
    setStage("result");
  };

  const copyTicket = async () => {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket.ticket_no);
      toast.success(labels.copied);
    } catch {
      toast.error(t("common.copyFailed", "复制失败"));
    }
  };

  const renderListItem = (
    kind: ReportKind,
    Icon: typeof Phone,
    title: string,
    sub: string,
    variant: "destructive" | "outline" | "secondary",
  ) => (
    <Button
      size="lg"
      variant={variant}
      className={cn(
        "w-full justify-start gap-3 h-14",
        variant === "destructive" && "shadow-md",
        variant === "outline" && "border-primary/30",
      )}
      onClick={() => requestKind(kind)}
      data-testid={`sos-action-${kind}`}
    >
      <Icon className={cn("h-5 w-5", variant !== "destructive" && KIND_META[kind].iconColorCls)} />
      <div className="flex-1 text-left">
        <p className="font-bold">{title}</p>
        <p className={cn("text-xs", variant === "destructive" ? "opacity-90" : "text-muted-foreground")}>
          {sub} · ETA ≤ {KIND_META[kind].etaFallback} {labels.minutes}
        </p>
      </div>
    </Button>
  );

  return (
    <>
      <button
        type="button"
        aria-label={labels.fab}
        onClick={() => { resetAll(); setOpen(true); }}
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

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" />
              {stage === "result"
                ? (isEn ? "Help is on the way" : "已建立工单，平台已介入")
                : labels.title}
            </SheetTitle>
            <SheetDescription>
              {stage === "list" && labels.subtitle}
              {stage === "confirm" && pendingKind && labels.confirmDesc[pendingKind]}
              {stage === "result" && labels.trackable}
            </SheetDescription>
          </SheetHeader>

          {/* Stage: action list */}
          {stage === "list" && (
            <div className="mt-4 space-y-2 pb-6">
              {renderListItem("call_support", Phone, labels.callSupport, supportPhone, "destructive")}
              {renderListItem("online_vet", Stethoscope, labels.onlineVet, vetHotline, "outline")}
              {renderListItem("report_incident", FileWarning, labels.report, isEn ? "Safety team follows up" : "安全专员主动跟进", "secondary")}
            </div>
          )}

          {/* Stage: confirm */}
          {stage === "confirm" && pendingKind && (
            <div className="mt-4 space-y-4 pb-6">
              <div className="rounded-xl border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">{labels.confirmTitle[pendingKind]}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {labels.eta}: ≤ {KIND_META[pendingKind].etaFallback} {labels.minutes}
                </div>
                {phoneFor(pendingKind) && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {isEn ? "Will dial" : "将拨打"}: <span className="font-mono text-foreground">{phoneFor(pendingKind)}</span>
                  </div>
                )}
              </div>

              {pendingKind === "report_incident" && (
                <div className="space-y-1.5">
                  <label htmlFor="sos-desc" className="block text-sm font-semibold text-foreground">
                    {labels.descLabel}
                  </label>
                  <Textarea
                    id="sos-desc"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value.slice(0, 300))}
                    rows={4}
                    placeholder={isEn ? "e.g. pet seems unwell during transport…" : "例如：宠物在运输中出现异常……"}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStage("list")} disabled={submitting}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> {labels.back}
                </Button>
                <Button
                  variant={pendingKind === "report_incident" ? "destructive" : "destructive"}
                  className="flex-1"
                  onClick={submitReport}
                  disabled={submitting}
                  data-testid="sos-confirm-submit"
                >
                  {submitting
                    ? (isEn ? "Submitting…" : "提交中…")
                    : pendingKind === "report_incident"
                      ? labels.submit
                      : pendingKind === "online_vet"
                        ? labels.confirmConnect
                        : labels.callNow}
                </Button>
              </div>
            </div>
          )}

          {/* Stage: result/ticket */}
          {stage === "result" && ticket && (
            <div className="mt-4 space-y-3 pb-6">
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold">{labels.statusOpen}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{labels.ticketNo}</p>
                    <p className="font-mono font-bold text-foreground" data-testid="sos-ticket-no">{ticket.ticket_no}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={copyTicket} className="h-8">
                    <Copy className="mr-1 h-3.5 w-3.5" /> {labels.copyTicket}
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-primary/20 pt-2">
                  <Clock className="h-3.5 w-3.5" />
                  {labels.eta}: ≤ {ticket.eta_minutes} {labels.minutes}
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={() => { setOpen(false); resetAll(); }}>
                {labels.done}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default EmergencySosFab;
