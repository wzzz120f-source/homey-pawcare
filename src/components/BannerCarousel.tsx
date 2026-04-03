import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
}

const BannerCarousel = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("banners")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (data) setBanners(data as any);
        setLoading(false);
      });
  }, []);

  const next = useCallback(() => {
    if (banners.length > 0) setCurrent((c) => (c + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next, banners.length]);

  if (loading) return <Skeleton className="mx-4 mt-4 h-40 rounded-2xl" />;
  if (banners.length === 0) return null;

  return (
    <div className="mx-4 mt-4 relative rounded-2xl overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((b) => (
          <div
            key={b.id}
            className="w-full shrink-0 cursor-pointer"
            onClick={() => b.link_url && navigate(b.link_url)}
          >
            <img
              src={b.image_url}
              alt={b.title}
              className="w-full h-40 object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/60 to-transparent p-4">
              <p className="text-primary-foreground font-bold text-lg">{b.title}</p>
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === current ? "bg-primary-foreground w-5" : "bg-primary-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;
