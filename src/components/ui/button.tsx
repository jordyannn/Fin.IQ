import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-[#047857]",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border border-border bg-background shadow-2xs hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-2xs hover:bg-secondary/80",
        chip: "bg-secondary/80 text-secondary-foreground font-bold hover:bg-secondary border border-secondary shadow-2xs",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        income: "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700",
        expense: "bg-rose-600 text-white shadow-xs hover:bg-rose-700",
      },
      size: {
        default: "h-8 sm:h-9 px-3.5 py-1.5 text-xs sm:text-sm",
        sm: "h-7 sm:h-8 rounded-sm px-2.5 text-xs",
        lg: "h-10 rounded-md px-6 text-sm sm:text-base",
        icon: "h-8 w-8 sm:h-9 sm:w-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
