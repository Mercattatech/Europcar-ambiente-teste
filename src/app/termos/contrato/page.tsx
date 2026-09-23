import type { Metadata } from "next";
import ContratoContent from "./content";

export const metadata: Metadata = {
  title: "Contrato de Locação de Veículos | Europcar Brasil",
  description: "Instrumento particular que rege a locação de veículos da Europcar Brasil, vinculado a cada locação pela assinatura do Demonstrativo do Contrato de Locação.",
};

export default function ContratoPage() {
  return <ContratoContent />;
}
