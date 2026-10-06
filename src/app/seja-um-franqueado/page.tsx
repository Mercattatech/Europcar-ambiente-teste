import type { Metadata } from "next";
import FranchiseLanding from "./FranchiseLanding";

export const metadata: Metadata = {
  title: "Seja um franqueado Europcar | Expansão 2030 — Europcar Brasil",
  description:
    "Abra uma franquia Europcar e entre em uma rede global de mobilidade presente em mais de 140 países. Simule a rentabilidade e fale com a expansão.",
};

export default function SejaUmFranqueadoPage() {
  return <FranchiseLanding />;
}
