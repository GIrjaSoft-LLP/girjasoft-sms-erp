export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-auto bg-white text-[#12203a]">{children}</div>;
}
