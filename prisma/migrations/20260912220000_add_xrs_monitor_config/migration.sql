-- CreateTable
CREATE TABLE "XrsMonitorConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 7,
    "messagingIntervalSeconds" INTEGER NOT NULL DEFAULT 10,
    "whatsappNumbers" TEXT NOT NULL DEFAULT '[]',
    "testStation" TEXT NOT NULL DEFAULT 'LIST01',
    "errorMessageTemplate" TEXT NOT NULL DEFAULT '⚠️ ALERTA: A API XRS (Europcar) está FORA DO AR desde {DATA} às {HORA}. Erro: {ERRO}',
    "recoveryMessageTemplate" TEXT NOT NULL DEFAULT '✅ API XRS NORMALIZADA em {DATA} às {HORA}. O sistema voltou a operar normalmente.',
    "lastStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastRecoveryAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XrsMonitorConfig_pkey" PRIMARY KEY ("id")
);
