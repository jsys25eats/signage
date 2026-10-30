import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { size?: "default" | "lg" }
>(({ className, size = "default", ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-border",
      size === "lg" ? "h-9 w-16" : "h-5 w-9",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
        size === "lg" ? "size-8 data-[state=checked]:translate-x-7" : "size-4 data-[state=checked]:translate-x-4",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
