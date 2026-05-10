import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ServiceCheckinChecklist from "@/components/ServiceCheckinChecklist";

export default function ServiceCheckinPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return null;
  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1">服务打卡</h1>
      </header>
      <main className="max-w-lg mx-auto p-4">
        <ServiceCheckinChecklist orderId={id} onAllComplete={() => navigate(`/order/${id}`)} />
      </main>
    </div>
  );
}
