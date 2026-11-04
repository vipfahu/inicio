-- Grupos y Programas Centro: ficha ampliada, integrantes con historial y publicación controlada.
-- Aplicada el 2026-11-05. Idempotente. Sin datos personales.

-- 1. Instancia: contenido de la ficha y estado de publicación
alter table public.gi_instancias add column if not exists fecha_creacion date;
alter table public.gi_instancias add column if not exists objetivo_general text;
alter table public.gi_instancias add column if not exists objetivos_especificos text[] not null default '{}';
alter table public.gi_instancias add column if not exists actividades text[] not null default '{}';
alter table public.gi_instancias add column if not exists publicado boolean not null default false;
alter table public.gi_instancias add column if not exists nota_interna text;
create unique index if not exists gi_instancias_sigla on public.gi_instancias (upper(sigla)) where sigla is not null;

-- 2. Documentos: designación de dirección, datos del acto y marca de datos personales
alter table public.gi_documentos drop constraint if exists gi_documentos_tipo_check;
alter table public.gi_documentos add constraint gi_documentos_tipo_check
  check (tipo in ('creacion','modificacion','nombramiento','normativa_interna','integrantes','otro'));
alter table public.gi_documentos add column if not exists tipo_acto text;
alter table public.gi_documentos add column if not exists std text;
alter table public.gi_documentos add column if not exists fecha_efecto date;
-- true = el original trae RUT u otros datos personales: solo se publica una versión tachada (o ningún PDF)
alter table public.gi_documentos add column if not exists datos_personales boolean not null default false;

-- 3. Integrantes con rol, línea y periodo (historial de composición)
create table if not exists public.gi_integrantes (
  id bigint generated always as identity primary key,
  instancia bigint not null references public.gi_instancias(id) on delete cascade,
  nombre text not null,
  rol text not null default 'Integrante',
  linea text,
  desde date,
  hasta date,
  documento bigint references public.gi_documentos(id) on delete set null,
  oficial boolean not null default true,   -- false = declarado por la instancia, sin resolución
  orden int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  constraint gi_integrantes_fechas check (hasta is null or desde is null or hasta >= desde)
);
create index if not exists gi_integrantes_instancia on public.gi_integrantes(instancia);
drop trigger if exists gi_integrantes_touch on public.gi_integrantes;
create trigger gi_integrantes_touch before update on public.gi_integrantes for each row execute function public.gi_touch();
alter table public.gi_integrantes enable row level security;

-- 4. Lectura pública solo de lo publicado; el equipo con acceso a «grupos» ve todo (borradores incluidos)
drop policy if exists "gi_instancias lectura publica" on public.gi_instancias;
create policy "gi_instancias lectura publica" on public.gi_instancias for select to anon, authenticated
  using (publicado or public.es_editor('grupos'));
drop policy if exists "gi_documentos lectura publica" on public.gi_documentos;
create policy "gi_documentos lectura publica" on public.gi_documentos for select to anon, authenticated
  using (exists (select 1 from public.gi_instancias i where i.id = instancia and i.publicado) or public.es_editor('grupos'));
drop policy if exists "gi_integrantes lectura publica" on public.gi_integrantes;
create policy "gi_integrantes lectura publica" on public.gi_integrantes for select to anon, authenticated
  using (exists (select 1 from public.gi_instancias i where i.id = instancia and i.publicado) or public.es_editor('grupos'));
drop policy if exists "gi_integrantes edicion" on public.gi_integrantes;
create policy "gi_integrantes edicion" on public.gi_integrantes for all to authenticated
  using (public.puede_editar('grupos')) with check (public.puede_editar('grupos'));
