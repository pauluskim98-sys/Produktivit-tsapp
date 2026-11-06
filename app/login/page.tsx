import { redirect } from "next/navigation";
import { accountConfig } from "@/lib/private-account";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{status?:string}>}) {
  if(accountConfig().mode==="local")redirect("/lifemap");
  const {status}=await searchParams;
  return <main style={{maxWidth:400,margin:"12vh auto",padding:24}}><h1>Lifemap</h1><p>Melde dich mit Google an, um deine persönliche Lifemap zu öffnen.</p>{status && <p role="alert">{status==="denied"?"Google konnte dieses Konto nicht bestätigen.":"Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut."}</p>}<a className="primary-button" href="/api/auth/google">Mit Google anmelden</a></main>;
}
