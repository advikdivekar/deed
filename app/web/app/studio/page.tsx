import { AppShell } from "@/components/app-shell";
import { Studio } from "@/components/studio";

export const metadata = { title: "Studio · DeedReader" };

export default function Page() {
  return <AppShell><Studio /></AppShell>;
}
