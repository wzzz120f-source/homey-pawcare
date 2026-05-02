import { useNavigate } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePetRecommendations } from "@/hooks/usePetRecommendations";

const PetRecommendationSection = () => {
  const navigate = useNavigate();
  const { pet, recommendations, loading } = usePetRecommendations(4);

  if (!loading && recommendations.length === 0) return null;

  const heading = pet ? `专为 ${pet.name} 推荐` : "热门推荐";

  return (
    <section className="mt-6 px-5 animate-fade-in-up" aria-label={heading}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-foreground">{heading}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate(pet ? "/pets" : "/booking")}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] justify-end"
          aria-label={pet ? "查看宠物档案" : "去预约"}
        >
          {pet ? "宠物档案" : "去预约"} <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {pet && (
        <p className="text-xs text-muted-foreground mb-2">
          基于 {pet.name}（{pet.breed || pet.pet_type}）的资料智能匹配
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : recommendations.map((r) => (
              <Card
                key={r.id}
                onClick={() => navigate("/booking")}
                className="cursor-pointer hover:card-shadow-hover transition-all hover:-translate-y-0.5 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
              >
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl" aria-hidden="true">
                      {r.service_emoji || "🐾"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      推荐
                    </span>
                  </div>
                  <p className="font-bold text-sm text-foreground line-clamp-1">{r.service_title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{r.reason_text}</p>
                </CardContent>
              </Card>
            ))}
      </div>
    </section>
  );
};

export default PetRecommendationSection;
