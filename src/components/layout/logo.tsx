import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "large";
  className?: string;
}

export function Logo({ variant = "default", className }: LogoProps) {
  if (variant === "large") {
    return (
      <div className={cn("flex flex-col items-center select-none", className)}>
        <Image
          src="/logo.png"
          alt="Só Puxa Quem Tem Coragem"
          width={220}
          height={220}
          priority
          className="object-contain mix-blend-screen"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center select-none", className)}>
      <Image
        src="/logo.png"
        alt="Só Puxa Quem Tem Coragem"
        width={48}
        height={48}
        className="object-contain mix-blend-screen"
      />
    </div>
  );
}
