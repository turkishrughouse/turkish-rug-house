import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive', size?: 'default' | 'sm' | 'lg' | 'icon', asChild?: boolean }>(
    ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    {
                        "bg-primary text-primary-foreground hover:bg-[#0f172a]": variant === "default",
                        "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
                        "border border-slate-700 bg-slate-800 text-slate-50 hover:text-slate-50 hover:bg-slate-900 no-underline [color:var(--primary-foreground)] hover:[color:var(--primary-foreground)] [&_*]:[color:var(--primary-foreground)] [&>svg]:[color:var(--primary-foreground)]": variant === "outline",
                        "text-slate-700 hover:bg-slate-200 hover:text-slate-900": variant === "ghost",
                        "text-slate-800 underline-offset-4 hover:underline": variant === "link",
                        "h-10 px-4 py-2": size === "default",
                        "h-9 rounded-md px-3": size === "sm",
                        "h-11 rounded-md px-8": size === "lg",
                        "h-10 w-10": size === "icon",
                    },
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
