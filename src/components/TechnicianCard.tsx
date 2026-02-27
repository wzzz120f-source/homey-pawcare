import { Star, MapPin } from "lucide-react";

interface TechnicianCardProps {
  name: string;
  avatar: string;
  specialty: string;
  rating: number;
  reviews: number;
  distance: string;
  onClick?: () => void;
}

const TechnicianCard = ({ name, avatar, specialty, rating, reviews, distance, onClick }: TechnicianCardProps) => (
  <div
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-card rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-300 cursor-pointer"
  >
    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20">
      <img src={avatar} alt={name} className="w-full h-full object-cover" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-foreground">{name}</h3>
      <p className="text-sm text-muted-foreground">{specialty}</p>
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-0.5">
          <Star className="w-3.5 h-3.5 fill-primary text-primary" />
          <span className="text-sm font-semibold text-foreground">{rating}</span>
          <span className="text-xs text-muted-foreground">({reviews})</span>
        </div>
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span className="text-xs">{distance}</span>
        </div>
      </div>
    </div>
  </div>
);

export default TechnicianCard;
