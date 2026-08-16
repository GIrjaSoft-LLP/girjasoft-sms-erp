import { Suspense } from "react";
import PrintIdCardsClient from "./PrintIdCardsClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Preparing ID cards…</p>}>
      <PrintIdCardsClient />
    </Suspense>
  );
}
