import { APP_NAME, COMPANY_NAME } from "@/config/branding";

export type Letterhead = {
  appName?: string;
  companyName?: string;
  schoolName: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  code?: string;
};

export function DocumentLetterhead({
  letterhead,
  title,
}: {
  letterhead: Letterhead;
  title: string;
}) {
  return (
    <header className="document-letterhead flex gap-4 items-start border-b-2 border-[#0b1b3a] pb-4 mb-6">
      {letterhead.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={letterhead.logo}
          alt={letterhead.schoolName}
          className="h-20 w-20 object-contain bg-white"
        />
      ) : null}
      <div className="flex-1">
        <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
          {letterhead.appName ?? APP_NAME}
        </p>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">{letterhead.schoolName}</h1>
        <p className="text-sm text-slate-600">
          {[letterhead.address, letterhead.phone, letterhead.email].filter(Boolean).join(" · ")}
        </p>
        {letterhead.website ? <p className="text-sm text-slate-500">{letterhead.website}</p> : null}
        <p className="mt-2 text-lg font-semibold">{title}</p>
      </div>
      <div className="text-right text-xs text-slate-500">
        <div>{letterhead.companyName ?? COMPANY_NAME}</div>
        {letterhead.code ? <div>{letterhead.code}</div> : null}
      </div>
    </header>
  );
}
