import { useEffect, useRef, useState } from "react";
import { Printer, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CardData {
  petName: string;
  petType: string;
  breed: string;
  ownerName: string;
  ownerPhone: string;
  emergencyContact: string;
  vetAddress: string;
  vetPhone: string;
  spareKey: string;
  warnings: string;
  feedingNotes: string;
}

const EMPTY: CardData = {
  petName: "",
  petType: "",
  breed: "",
  ownerName: "",
  ownerPhone: "",
  emergencyContact: "",
  vetAddress: "",
  vetPhone: "",
  spareKey: "",
  warnings: "",
  feedingNotes: "",
};

const EmergencyCardGenerator = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CardData>(EMPTY);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: pets } = await supabase
        .from("pets")
        .select("name, pet_type, breed, allergies, behavior_notes, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1);
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();
      const pet = pets?.[0];
      if (pet) {
        setData((d) => ({
          ...d,
          petName: d.petName || pet.name || "",
          petType: d.petType || pet.pet_type || "",
          breed: d.breed || pet.breed || "",
          warnings:
            d.warnings ||
            [
              pet.allergies?.length ? `过敏：${pet.allergies.join("、")}` : "",
              pet.behavior_notes?.length ? `禁忌：${pet.behavior_notes.join("、")}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
        }));
      }
      if (profile?.username) {
        setData((d) => ({ ...d, ownerName: d.ownerName || profile.username || "" }));
      }
    })();
  }, [open, user]);

  const update = (k: keyof CardData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>宠物紧急救助卡</title>
      <meta charset="utf-8" />
      <style>
        @page { size: A6; margin: 8mm; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft Yahei", sans-serif; padding: 12px; color: #1a1a1a; }
        h1 { font-size: 18px; margin: 0 0 8px; color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 4px; }
        h2 { font-size: 12px; margin: 10px 0 4px; color: #ea580c; }
        p { font-size: 11px; margin: 2px 0; line-height: 1.5; white-space: pre-wrap; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .label { color: #6b7280; font-size: 10px; }
        .val { font-weight: 600; font-size: 12px; }
        .footer { margin-top: 10px; padding-top: 6px; border-top: 1px dashed #d1d5db; font-size: 9px; color: #6b7280; text-align: center; }
      </style></head><body>${html}<div class="footer">由「萌宠到家」生成 · ${new Date().toLocaleDateString("zh-CN")}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="w-4 h-4" />
          紧急救助卡
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>生成宠物紧急救助卡</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            填写后可一键打印贴在门口，宠托师或邻居遇到突发状况能立刻联系到你。
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">宠物昵称</Label>
              <Input value={data.petName} onChange={update("petName")} placeholder="豆豆" />
            </div>
            <div>
              <Label className="text-xs">品种</Label>
              <Input value={data.breed} onChange={update("breed")} placeholder="布偶猫" />
            </div>
            <div>
              <Label className="text-xs">主人姓名</Label>
              <Input value={data.ownerName} onChange={update("ownerName")} />
            </div>
            <div>
              <Label className="text-xs">主人电话</Label>
              <Input value={data.ownerPhone} onChange={update("ownerPhone")} placeholder="138-xxxx-xxxx" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">紧急联系人</Label>
              <Input value={data.emergencyContact} onChange={update("emergencyContact")} placeholder="妈妈 138-xxxx" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">最近的宠物医院</Label>
              <Input value={data.vetAddress} onChange={update("vetAddress")} placeholder="瑞鹏宠物医院·浦东店" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">医院电话</Label>
              <Input value={data.vetPhone} onChange={update("vetPhone")} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">备用钥匙位置</Label>
              <Input value={data.spareKey} onChange={update("spareKey")} placeholder="如：门口地垫下 / 邻居 1602" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">性格避雷 / 过敏</Label>
              <Textarea rows={2} value={data.warnings} onChange={update("warnings")} placeholder="怕雷声 · 对鸡肉过敏" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">喂食与日常</Label>
              <Textarea rows={2} value={data.feedingNotes} onChange={update("feedingNotes")} placeholder="早晚各一餐，水盆每天换水" />
            </div>
          </div>

          {/* Preview */}
          <div className="border-2 border-dashed border-primary/40 rounded-xl p-3 bg-orange-50/50 dark:bg-orange-950/20">
            <p className="text-[10px] text-muted-foreground mb-2 text-center">📌 卡片预览（A6 尺寸）</p>
            <div ref={printRef} className="bg-white dark:bg-card rounded-lg p-3 text-foreground">
              <h1 style={{ color: "#ea580c", fontSize: 18, margin: 0, borderBottom: "2px solid #ea580c", paddingBottom: 4 }}>
                🐾 宠物紧急救助卡
              </h1>
              <h2 style={{ color: "#ea580c", fontSize: 12, margin: "8px 0 2px" }}>宠物信息</h2>
              <p style={{ fontSize: 11, margin: 0 }}>
                {data.petName || "—"}（{data.breed || data.petType || "—"}）
              </p>
              <h2 style={{ color: "#ea580c", fontSize: 12, margin: "8px 0 2px" }}>主人 & 紧急联系</h2>
              <p style={{ fontSize: 11, margin: 0 }}>主人：{data.ownerName || "—"} · {data.ownerPhone || "—"}</p>
              <p style={{ fontSize: 11, margin: 0 }}>紧急：{data.emergencyContact || "—"}</p>
              <h2 style={{ color: "#ea580c", fontSize: 12, margin: "8px 0 2px" }}>就近宠物医院</h2>
              <p style={{ fontSize: 11, margin: 0 }}>{data.vetAddress || "—"}</p>
              <p style={{ fontSize: 11, margin: 0 }}>📞 {data.vetPhone || "—"}</p>
              <h2 style={{ color: "#ea580c", fontSize: 12, margin: "8px 0 2px" }}>备用钥匙</h2>
              <p style={{ fontSize: 11, margin: 0 }}>{data.spareKey || "—"}</p>
              {data.warnings && (
                <>
                  <h2 style={{ color: "#ea580c", fontSize: 12, margin: "8px 0 2px" }}>性格避雷</h2>
                  <p style={{ fontSize: 11, margin: 0, whiteSpace: "pre-wrap" }}>{data.warnings}</p>
                </>
              )}
              {data.feedingNotes && (
                <>
                  <h2 style={{ color: "#ea580c", fontSize: 12, margin: "8px 0 2px" }}>喂食与日常</h2>
                  <p style={{ fontSize: 11, margin: 0, whiteSpace: "pre-wrap" }}>{data.feedingNotes}</p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              <X className="w-4 h-4 mr-1" /> 关闭
            </Button>
            <Button className="flex-1" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> 打印 / 另存PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmergencyCardGenerator;
