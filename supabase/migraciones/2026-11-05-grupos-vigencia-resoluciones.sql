-- Grupos y Programas Centro: vigencia de cada resolución (estado, fecha de término, motivo y reemplazo).
-- Aplicada el 2026-11-05. Idempotente.
alter table public.gi_documentos add column if not exists vigente_hasta date;          -- último día en que rigió
alter table public.gi_documentos add column if not exists vigencia_motivo text;        -- p. ej. «Periodo de designación cumplido», «Derogada»
alter table public.gi_documentos add column if not exists reemplazada_por bigint references public.gi_documentos(id) on delete set null;
alter table public.gi_documentos drop constraint if exists gi_documentos_reemplazo_distinto;
alter table public.gi_documentos add constraint gi_documentos_reemplazo_distinto check (reemplazada_por is null or reemplazada_por <> id);
