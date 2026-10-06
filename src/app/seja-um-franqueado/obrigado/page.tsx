import type { Metadata } from "next";
import ThankYouFranchise from "./ThankYouFranchise";

export const metadata: Metadata = {
  title: "Obrigado! | Seja um franqueado Europcar",
  description: "Recebemos o seu interesse em abrir uma franquia Europcar. Nossa equipe de expansão entrará em contato.",
  robots: { index: false, follow: false },
};

export default function ObrigadoFranquiaPage() {
  return <ThankYouFranchise />;
}
