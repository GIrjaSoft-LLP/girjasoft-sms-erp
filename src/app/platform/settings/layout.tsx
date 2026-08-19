import { PlatformSettingsLayoutClient } from "./SettingsLayoutClient";

export default function PlatformSettingsLayout({ children }: { children: React.ReactNode }) {
  return <PlatformSettingsLayoutClient>{children}</PlatformSettingsLayoutClient>;
}
