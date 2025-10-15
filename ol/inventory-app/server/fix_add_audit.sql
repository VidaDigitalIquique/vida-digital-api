CREATE TABLE IF NOT EXISTS public.app_audit_log (
  id TEXT NOT NULL,
  "actorUserId" TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  diff JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT app_audit_log_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS app_audit_log_actorUserId_idx ON public.app_audit_log("actorUserId");
CREATE INDEX IF NOT EXISTS app_audit_log_createdAt_idx ON public.app_audit_log("createdAt");