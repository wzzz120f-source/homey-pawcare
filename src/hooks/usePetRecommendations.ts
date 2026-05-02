import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RecommendationRule {
  id: string;
  pet_type: string | null;
  breed_keywords: string[] | null;
  age_min_months: number | null;
  age_max_months: number | null;
  service_id: string;
  service_title: string;
  service_emoji: string | null;
  reason_text: string;
  priority: number;
}

export interface DefaultPet {
  id: string;
  name: string;
  pet_type: string;
  breed: string | null;
  birthday: string | null;
}

interface MatchedRecommendation extends RecommendationRule {
  matchScore: number;
}

function ageInMonths(birthday: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
}

function matchRule(rule: RecommendationRule, pet: DefaultPet): number | null {
  let score = rule.priority;
  if (rule.pet_type && rule.pet_type !== pet.pet_type) return null;
  if (rule.pet_type === pet.pet_type) score += 10;

  if (rule.breed_keywords && rule.breed_keywords.length > 0) {
    const breed = (pet.breed || "").toLowerCase();
    const hit = rule.breed_keywords.some((k) => breed.includes(k.toLowerCase()));
    if (!hit) return null;
    score += 30;
  }

  const months = ageInMonths(pet.birthday);
  if (rule.age_min_months !== null || rule.age_max_months !== null) {
    if (months === null) return null;
    if (rule.age_min_months !== null && months < rule.age_min_months) return null;
    if (rule.age_max_months !== null && months > rule.age_max_months) return null;
    score += 20;
  }
  return score;
}

export function usePetRecommendations(limit = 4) {
  const { user } = useAuth();
  const [pet, setPet] = useState<DefaultPet | null>(null);
  const [recommendations, setRecommendations] = useState<MatchedRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      let chosenPet: DefaultPet | null = null;
      if (user) {
        const { data: pets } = await supabase
          .from("pets")
          .select("id, name, pet_type, breed, birthday, is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .limit(1);
        chosenPet = (pets?.[0] as DefaultPet) || null;
      }
      if (!mounted) return;
      setPet(chosenPet);

      const { data: rules } = await supabase
        .from("service_recommendation_rules")
        .select("id, pet_type, breed_keywords, age_min_months, age_max_months, service_id, service_title, service_emoji, reason_text, priority")
        .eq("is_active", true);

      if (!mounted) return;
      if (!chosenPet || !rules) {
        // Fallback: top general rules
        const sorted = (rules || []).slice().sort((a, b) => b.priority - a.priority).slice(0, limit);
        setRecommendations(sorted.map((r) => ({ ...(r as RecommendationRule), matchScore: r.priority })));
      } else {
        const matched: MatchedRecommendation[] = [];
        for (const r of rules as RecommendationRule[]) {
          const score = matchRule(r, chosenPet);
          if (score !== null) matched.push({ ...r, matchScore: score });
        }
        matched.sort((a, b) => b.matchScore - a.matchScore);
        setRecommendations(matched.slice(0, limit));
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user, limit]);

  return { pet, recommendations, loading };
}
