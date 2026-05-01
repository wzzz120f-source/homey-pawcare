import { Star, MapPin, ChevronRight } from "lucide-react";
import type { Technician } from "@/types";

type TechnicianCardProps = Technician & {
  onClick?: () => void;
};

const TechnicianCard = ({ name, avatar, specialty, rating, reviews, distance, onClick }: TechnicianCardProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`技师 ${name} - ${specialty}，点击查看详情`}
    className="group flex items-center gap-4 p-4 bg-card rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-300 cursor-pointer text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-[44px]"
  >
    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20">
      <img
        src={avatar}
        alt={`${name}头像`}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-foreground">{name}</h3>
      <p className="text-sm text-muted-foreground">{specialty}</p>
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-0.5" aria-label={`评分 ${rating}，${reviews} 条评价`}>
          <Star className="w-3.5 h-3.5 fill-primary text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">{rating}</span>
          <span className="text-xs text-muted-foreground">({reviews})</span>
        </div>
        <div className="flex items-center gap-0.5 text-muted-foreground" aria-label={`距离 ${distance}`}>
          <MapPin className="w-3 h-3" aria-hidden="true" />
          <span className="text-xs">{distance}</span>
        </div>
      </div>
    </div>
    <ChevronRight
      className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      aria-hidden="true"
    />
  </button>
);

export default TechnicianCard;
