import { cn } from "@/lib/utils"

interface PreviewProductCardProps {
    product: {
        title: string
        price: number
        image: string
        badge?: string
    }
    settings: {
        cardRatio: 'square' | 'portrait' | 'landscape'
        titleSize: 'sm' | 'md' | 'lg'
        priceStyle: 'simple' | 'bold'
        badgeStyle: 'minimal' | 'solid'
    }
}

export function PreviewProductCard({ product, settings }: PreviewProductCardProps) {
    const ratioClass = {
        square: "aspect-square",
        portrait: "aspect-[3/4]",
        landscape: "aspect-[4/3]",
    }[settings.cardRatio]

    const titleClass = {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
    }[settings.titleSize]

    return (
        <div className="group relative flex flex-col gap-3">
            <div className={cn("relative overflow-hidden bg-secondary w-full", ratioClass)}>
                <img
                    src={product.image}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {product.badge && (
                    <div className={cn(
                        "absolute top-2 left-2 px-2 py-1 text-xs uppercase tracking-wider",
                        settings.badgeStyle === 'solid' ? "bg-primary text-primary-foreground" : "bg-white/80 backdrop-blur text-black"
                    )}>
                        {product.badge}
                    </div>
                )}
            </div>
            <div>
                <h3 className={cn("font-medium", titleClass)}>{product.title}</h3>
                <p className={cn("text-muted-foreground", settings.priceStyle === 'bold' ? "font-bold text-black" : "")}>
                    ${product.price}
                </p>
            </div>
        </div>
    )
}
