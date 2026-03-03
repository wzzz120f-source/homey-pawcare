import { Star } from "lucide-react";
import type { Service } from "@/types";

type ServiceCardProps = Pick<Service, "image" | "title" | "price" | "rating"> & {
  onClick?: () => void;
};

const ServiceCard = ({ image, title, price, rating, onClick }: ServiceCardProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${title} - ${price}`}
    className="flex-shrink-0 w-40 bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 cursor-pointer hover:-translate-y-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-[44px]"
  >
    <div className="h-32 overflow-hidden">
      <img
        src={image}
        alt={title}
        className="w-full h-full object-cover will-change-transform"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="p-3">
      <h3 className="font-bold text-sm text-foreground truncate">{title}</h3>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-primary font-extrabold text-sm">{price}</span>
        <div className="flex items-center gap-0.5" aria-label={`评分 ${rating}`}>
          <Star className="w-3 h-3 fill-primary text-primary" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">{rating}</span>
        </div>
      </div>
    </div>
  </button>
);

export default ServiceCard;
