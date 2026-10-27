"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] touch-manipulation select-none",
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
        default: "h-8 sm:h-9 px-3.5 py-1.5 text-xs sm:text-sm min-h-[36px]",
        sm: "h-8 sm:h-8 rounded-sm px-2.5 text-xs min-h-[32px]",
        lg: "h-11 sm:h-10 rounded-md px-6 text-sm sm:text-base min-h-[44px]",
        icon: "h-9 w-9 sm:h-9 sm:w-9 rounded-md min-h-[36px] min-w-[36px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!asChild) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height) * 2.2;
        const id = Date.now() + Math.random();
        setRipples((prev) => [...prev.slice(-3), { x, y, size, id }]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      }
      props.onClick?.(e);
    };

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        onClick={handleClick}
      >
        {children}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-20 animate-button-click-ripple select-none"
            style={{
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
            }}
          />
        ))}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
