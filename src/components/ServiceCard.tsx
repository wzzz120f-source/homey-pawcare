import { Star } from "lucide-react";

interface ServiceCardProps {
  image: string;
  title: string;
  price: string;
  rating: number;
  onClick?: () => void;
}

const ServiceCard = ({ image, title, price, rating, onClick }: ServiceCardProps) => (
  <div
    onClick={onClick}
    className="flex-shrink-0 w-40 bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 cursor-pointer hover:-translate-y-1"
  >
    <div className="h-32 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover" />
    </div>
    <div className="p-3">
      <h3 className="font-bold text-sm text-foreground truncate">{title}</h3>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-primary font-extrabold text-sm">{price}</span>
        <div className="flex items-center gap-0.5">
          <Star className="w-3 h-3 fill-primary text-primary" />
          <span className="text-xs text-muted-foreground">{rating}</span>
        </div>
      </div>
    </div>
  </div>
);

export default ServiceCard;
