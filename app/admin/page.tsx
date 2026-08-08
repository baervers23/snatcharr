import AdminPanel from "@/components/guidarr/AdminPanel";
import { getConfig, getGroups } from "@/lib/guidarr/storage";

export const metadata = { title: "Admin | Guidarr" };

export default async function AdminPage() {
  const [config, groups] = await Promise.all([getConfig(), getGroups()]);

  return (
    <AdminPanel
      initialGroups={groups}
      initialConfig={{
        backgroundColor: config.backgroundColor,
        backgroundImage: config.backgroundImage,
      }}
    />
  );
}
