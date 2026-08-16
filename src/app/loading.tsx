import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";

export default function Loading() {
  return (
    <div className="h-full grid place-items-center bg-[#0b1b3a] text-white">
      <div className="text-center space-y-4">
        <BrandMark />
        <p className="tracking-[0.3em] text-sm uppercase text-blue-200">{APP_NAME}</p>
        <p>Loading…</p>
      </div>
    </div>
  );
}
