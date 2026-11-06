import Planner from "@/components/planner";
import { accountConfig } from "@/lib/private-account";
export const dynamic = "force-dynamic";

export default function LifemapPage() {
  return <><Planner />{accountConfig().mode==="private" && <form className="private-account-logout" action="/api/auth/logout" method="post"><button type="submit">Abmelden</button></form>}</>;
}
