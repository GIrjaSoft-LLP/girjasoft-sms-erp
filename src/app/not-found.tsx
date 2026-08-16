import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="h-full overflow-y-auto grid place-items-center bg-[#f3f6fb] p-6">
      <div className="gs-card p-8 max-w-lg text-center space-y-3">
        <BrandMark />
        <h1 className="text-xl font-semibold">{APP_NAME}</h1>
        <p>The page you requested was not found.</p>
        <Link className="text-[#4c7eff]" href="/login">
          Return to login
        </Link>
      </div>
    </div>
  );
}
