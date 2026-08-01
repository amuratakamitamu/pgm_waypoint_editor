import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva("inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-slate-900 text-white hover:bg-slate-700", outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50", ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900", destructive: "text-rose-600 hover:bg-rose-50" }, size: { default: "h-10 px-4", icon: "h-9 w-9" } }, defaultVariants: { variant: "default", size: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button className={cn(variants({ variant, size }), className)} ref={ref} {...props} />);
Button.displayName = "Button";
