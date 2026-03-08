import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

// I need cva. I'll stick to simple or install it? Prompt says "Modern SaaS".
// Radix Label is installed. I will install 'class-variance-authority' to follow standard patterns if I need variants,
// but for Label it's usually just base.
// I'll skip CVA for now to reduce overhead unless I strongly need it. I'll just use CN.

const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            className
        )}
        {...props}
    />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
