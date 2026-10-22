"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?login=true");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Redirecionando...</p>
      </div>
    </div>
  );
}
