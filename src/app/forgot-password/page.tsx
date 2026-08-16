import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";

export default function ForgotPasswordPage() {
  return (
    <div className="h-full min-h-0 overflow-y-auto grid place-items-center bg-[#f3f6fb] p-6">
      <div className="gs-card max-w-md p-8 space-y-4">
        <BrandMark />
        <h1 className="text-xl font-semibold">{APP_NAME}</h1>
        <p className="text-slate-600">
          If an account exists, a workspace administrator can reset the password from User
          Management. Platform Super Admin resets are performed through the secure setup process.
        </p>
        <Link className="text-[#4c7eff]" href="/login">
          Back to login
        </Link>
      </div>
    </div>
  );
}
