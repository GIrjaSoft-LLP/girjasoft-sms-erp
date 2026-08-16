import type { LetterheadTheme, SchoolBrand } from "@/config/theme";
import { schoolContactLine } from "@/config/theme";

function Logo({ src, name, size = 56 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="object-contain bg-white" style={{ width: size, height: size }} />
    );
  }
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="grid place-items-center font-semibold text-white"
      style={{ width: size, height: size, background: "#94a3b8", fontSize: size > 40 ? 14 : 10 }}
    >
      {letters || "LOGO"}
    </div>
  );
}

export function LetterheadPreview({
  brand,
  theme,
  compact,
}: {
  brand: SchoolBrand;
  theme: LetterheadTheme;
  compact?: boolean;
}) {
  const contact = schoolContactLine(brand) || "School address and contact";
  const tagline = brand.tagline || "Official School Letterhead";
  const minH = compact ? 140 : 420;

  if (theme.design === "sidebar") {
    return (
      <div className="overflow-hidden border bg-white text-[10px]" style={{ minHeight: minH, borderColor: theme.accent }}>
        <div className="flex min-h-full">
          <div className="flex w-[22%] flex-col items-center gap-2 px-2 py-4 text-white" style={{ background: theme.primary }}>
            <Logo src={brand.logo} name={brand.schoolName} size={compact ? 28 : 52} />
            {!compact ? <p className="text-center text-[9px] leading-tight">{brand.code}</p> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="border-b px-3 py-2" style={{ borderColor: theme.accent, color: theme.secondary }}>
              <p className="truncate text-sm font-semibold" style={{ color: theme.secondary }}>
                {brand.schoolName || "School Name"}
              </p>
              <p className="truncate text-[9px]" style={{ color: theme.primary }}>
                {tagline}
              </p>
              {!compact ? <p className="mt-1 truncate text-[9px] text-slate-600">{contact}</p> : null}
            </div>
            {!compact ? (
              <div className="px-3 py-8 text-center text-slate-400">Document content</div>
            ) : (
              <div className="h-10" />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (theme.design === "elegant") {
    return (
      <div className="border bg-white px-3 py-3 text-center" style={{ minHeight: minH, borderColor: theme.accent }}>
        <div className="flex justify-center">
          <Logo src={brand.logo} name={brand.schoolName} size={compact ? 28 : 56} />
        </div>
        <p className="mt-1 text-sm font-semibold tracking-wide" style={{ color: theme.secondary }}>
          {brand.schoolName || "School Name"}
        </p>
        <p className="text-[9px] italic" style={{ color: theme.primary }}>
          {tagline}
        </p>
        {!compact ? <p className="mt-1 text-[9px] text-slate-600">{contact}</p> : null}
        <div className="mx-auto my-2 h-px w-2/3" style={{ background: theme.accent }} />
        {!compact ? <div className="py-10 text-slate-400">Document content</div> : <div className="h-8" />}
        <div className="mx-auto mb-1 h-px w-2/3" style={{ background: theme.primary }} />
        {!compact ? (
          <p className="text-[9px]" style={{ color: theme.secondary }}>
            {brand.phone || brand.email || contact}
          </p>
        ) : null}
      </div>
    );
  }

  if (theme.design === "corporate") {
    return (
      <div className="overflow-hidden border bg-white" style={{ minHeight: minH, borderColor: theme.secondary }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: theme.secondary, color: "white" }}>
          <Logo src={brand.logo} name={brand.schoolName} size={compact ? 28 : 48} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{brand.schoolName || "School Name"}</p>
            <p className="truncate text-[9px]" style={{ color: theme.accent }}>
              {tagline}
            </p>
          </div>
        </div>
        <div className="h-1" style={{ background: theme.primary }} />
        {!compact ? (
          <>
            <div className="px-3 py-2 text-xs font-semibold" style={{ color: theme.primary }}>
              Official Correspondence
            </div>
            <div className="px-3 py-8 text-center text-slate-400">Document content</div>
            <div className="border-t px-3 py-2 text-[9px] text-slate-600" style={{ borderColor: theme.accent }}>
              {contact}
            </div>
          </>
        ) : (
          <div className="h-10" />
        )}
      </div>
    );
  }

  return (
    <div className="border bg-white text-center" style={{ minHeight: minH, borderColor: theme.accent }}>
      <div className="px-3 py-3">
        <div className="flex justify-center">
          <Logo src={brand.logo} name={brand.schoolName} size={compact ? 28 : 56} />
        </div>
        <p className="mt-1 text-sm font-semibold" style={{ color: theme.secondary }}>
          {brand.schoolName || "School Name"}
        </p>
        {!compact ? <p className="text-[9px] text-slate-600">{contact}</p> : null}
      </div>
      <div className="h-1" style={{ background: theme.primary }} />
      <div className="h-0.5" style={{ background: theme.accent }} />
      {!compact ? <div className="py-10 text-slate-400">Document content</div> : <div className="h-10" />}
      <div className="h-0.5" style={{ background: theme.accent }} />
      {!compact ? (
        <p className="px-3 py-2 text-[9px] text-slate-600">{contact}</p>
      ) : null}
    </div>
  );
}
