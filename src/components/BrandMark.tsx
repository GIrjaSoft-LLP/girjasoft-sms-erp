import Image from "next/image";
import { APP_NAME, LOGO_MARK, LOGO_WORDMARK } from "@/config/branding";

type Props = {
  variant?: "full" | "mark" | "wordmark";
  size?: number;
};

export function BrandMark({ variant = "full", size = 40 }: Props) {
  if (variant === "wordmark") {
    return (
      <Image
        src={LOGO_WORDMARK}
        alt={APP_NAME}
        width={180}
        height={32}
        priority
        className="h-8 w-auto"
      />
    );
  }

  if (variant === "mark") {
    return (
      <Image
        src={LOGO_MARK}
        alt={APP_NAME}
        width={size}
        height={size}
        priority
        className="rounded-full bg-white shrink-0"
      />
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Image
        src={LOGO_MARK}
        alt={APP_NAME}
        width={size}
        height={size}
        priority
        className="rounded-full bg-white"
      />
      <Image
        src={LOGO_WORDMARK}
        alt={APP_NAME}
        width={160}
        height={28}
        priority
        className="h-7 w-auto"
      />
    </div>
  );
}
