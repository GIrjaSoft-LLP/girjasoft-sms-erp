"use client";

import { useEffect, useRef, useState } from "react";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PhotoField({
  label,
  name,
  photo,
  onPhotoChange,
  disabled,
}: {
  label: string;
  name?: string;
  photo?: string;
  onPhotoChange: (file: File | null, remove: boolean) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(photo || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setPreview(photo || "");
  }, [photo]);

  function validate(file: File) {
    const okType = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!okType) return "Upload a JPG, PNG or WEBP image.";
    if (file.size > 2 * 1024 * 1024) return "Photo must be 2 MB or smaller.";
    return "";
  }

  function pick(file: File | undefined) {
    if (!file) return;
    const message = validate(file);
    setError(message);
    if (message) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onPhotoChange(file, false);
  }

  return (
    <div className="text-sm md:col-span-2">
      <span className="block mb-1 text-slate-600">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-20 w-16 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-slate-400">{initials(name || "") || "Photo"}</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          disabled={disabled}
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? "Change photo" : "Upload photo"}
        </button>
        {preview ? (
          <button
            type="button"
            className="text-sm text-red-600"
            disabled={disabled}
            onClick={() => {
              setPreview("");
              setError("");
              if (inputRef.current) inputRef.current.value = "";
              onPhotoChange(null, true);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
