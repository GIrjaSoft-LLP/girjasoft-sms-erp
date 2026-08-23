import { redirect } from "next/navigation";

export default function LegacyTeachersRedirectPage() {
  redirect("/modules/teacher/teachers");
}
