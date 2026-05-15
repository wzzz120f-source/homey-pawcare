import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Star, Award, PawPrint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats { orders_done: number; avg_rating: number; review_count: number }
interface Profile { username?: string | null; avatar_url?: string | null; bio?: string | null }
interface Review { id: string; rating: number; content: string | null; created_at: string }

export default function ProviderPublicPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [verified, setVerified] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: s }, { data: app }, { data: gr }] = await Promise.all([
        supabase.from("profiles").select("username, avatar_url, bio").eq("user_id", uid).maybeSingle(),
        (supabase as any).rpc("get_provider_stats", { provider_uid: uid }),
        supabase.from("driver_applications").select("id").eq("user_id", uid).eq("status", "approved").limit(1),
        supabase.from("groomer_ratings").select("id, overall, content, created_at").eq("groomer_id", uid).order("created_at", { ascending: false }).limit(10),
      ]);
      setProfile((p as any) || null);
      const row = Array.isArray(s) ? s[0] : s;
      setStats(row ? { orders_done: Number(row.orders_done || 0), avg_rating: Number(row.avg_rating || 5), review_count: Number(row.review_count || 0) } : null);
      setVerified((app as any[])?.length > 0);
      setReviews(((gr as any[]) || []).map((r) => ({ id: r.id, rating: r.overall, content: r.content, created_at: r.created_at })));
      setLoading(false);
    })();
  }, [uid]);

  if (!uid) return null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-30 bg-card border-b px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1">服务者主页</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">加载中…</p>
        ) : (
          <>
            <section className="bg-card rounded-2xl p-5 card-shadow flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PawPrint className="w-full h-full p-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-extrabold text-lg truncate">{profile?.username || "服务者"}</h2>
                  {verified && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />已实名审核
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 flex items-center gap-1">
                    <Award className="w-3 h-3" />宠物护理证
                  </span>
                </div>
                {profile?.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>}
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2">
              <Stat label="服务单数" value={stats?.orders_done ?? 0} />
              <Stat label="平均评分" value={(stats?.avg_rating ?? 5).toFixed(1)} icon={<Star className="w-3 h-3 text-amber-500 fill-amber-500" />} />
              <Stat label="评价数" value={stats?.review_count ?? 0} />
            </section>

            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h3 className="font-bold text-sm mb-3">真实历史评价</h3>
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无评价</p>
              ) : (
                <ul className="space-y-3">
                  {reviews.map((r) => (
                    <li key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                        ))}
                        <span className="text-[11px] text-muted-foreground ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.content && <p className="text-sm">{r.content}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-3 text-center card-shadow">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-xl font-extrabold text-primary">{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
