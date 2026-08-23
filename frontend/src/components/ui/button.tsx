import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white hover:bg-zinc-800 hover:text-zinc-300 shadow-xs transition-colors",
        destructive:
          "bg-red-500 text-white shadow-xs hover:bg-red-600 hover:text-zinc-200 transition-colors",
        outline:
          "border border-zinc-300 bg-white text-zinc-900 shadow-xs hover:bg-zinc-100 hover:text-zinc-700 transition-colors",
        secondary:
          "bg-zinc-100 text-zinc-900 shadow-xs hover:bg-zinc-200/80 hover:text-zinc-700 transition-colors",
        ghost: "hover:bg-zinc-100 hover:text-zinc-900 transition-colors",
        link: "text-zinc-900 underline-offset-4 hover:underline transition-colors",
        pill: "bg-black text-white hover:bg-zinc-800 hover:text-zinc-300 rounded-full px-5 py-2 font-medium shadow-xs transition-colors",
        pillOutline: "border border-zinc-300 text-zinc-900 bg-white hover:bg-zinc-100 hover:text-zinc-700 rounded-full px-5 py-2 font-medium transition-colors",
        purpleGradient: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 hover:text-zinc-200 shadow-md transition-colors",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-9 w-9",
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
