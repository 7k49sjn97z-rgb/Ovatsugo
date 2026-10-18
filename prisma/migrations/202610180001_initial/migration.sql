CREATE TABLE "User" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "email" TEXT NOT NULL UNIQUE,
 "password" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Portfolio" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "name" TEXT NOT NULL
);
CREATE TABLE "Operation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "ticker" TEXT NOT NULL,
 "assetClass" TEXT NOT NULL DEFAULT 'ACAO',
 "side" TEXT NOT NULL,
 "quantity" DECIMAL(28,10) NOT NULL,
 "price" DECIMAL(28,10) NOT NULL,
 "fees" DECIMAL(28,10) NOT NULL,
 "date" DATE NOT NULL,
 "broker" TEXT NOT NULL DEFAULT '',
 "modality" TEXT NOT NULL DEFAULT 'COMUM',
 "canceled" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Operation_userId_date_idx" ON "Operation" ("userId", "date");
CREATE TABLE "AuditLog" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "entityId" TEXT NOT NULL,
 "payload" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog" ("userId", "createdAt");
CREATE TABLE "Institution" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "name" TEXT NOT NULL
);
CREATE TABLE "Asset" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "ticker" TEXT NOT NULL UNIQUE,
 "assetClass" TEXT NOT NULL,
 "cnpj" TEXT
);
CREATE TABLE "OperationalCost" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "operationId" TEXT NOT NULL,
 "amount" DECIMAL(28,10) NOT NULL
);
CREATE TABLE "CorporateEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "ticker" TEXT NOT NULL,
 "date" DATE NOT NULL,
 "type" TEXT NOT NULL,
 "ratio" DECIMAL(28,10) NOT NULL
);
CREATE TABLE "Income" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "ticker" TEXT NOT NULL,
 "date" DATE NOT NULL,
 "amount" DECIMAL(28,10) NOT NULL,
 "documentId" TEXT
);
CREATE TABLE "Quote" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "ticker" TEXT NOT NULL,
 "date" TIMESTAMP(3) NOT NULL,
 "price" DECIMAL(28,10) NOT NULL
);
CREATE TABLE "TaxYear" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "exercise" INTEGER NOT NULL UNIQUE,
 "calendarYear" INTEGER NOT NULL,
 "validated" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE "TaxRuleVersion" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "exercise" INTEGER NOT NULL,
 "source" TEXT NOT NULL,
 "rules" JSONB NOT NULL,
 "validated" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE "TaxAssessment" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "exercise" INTEGER NOT NULL,
 "month" INTEGER NOT NULL,
 "data" JSONB NOT NULL
);
CREATE TABLE "DeclarationItem" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "exercise" INTEGER NOT NULL,
 "data" JSONB NOT NULL
);
CREATE TABLE "CarriedLoss" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "exercise" INTEGER NOT NULL,
 "modality" TEXT NOT NULL,
 "assetClass" TEXT NOT NULL,
 "amount" DECIMAL(28,10) NOT NULL
);
CREATE TABLE "ImportedDocument" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "hash" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ImportedDocument_userId_hash_idx" ON "ImportedDocument" ("userId", "hash");
CREATE TABLE "ReconciliationIssue" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "operationId" TEXT,
 "type" TEXT NOT NULL,
 "resolved" BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
