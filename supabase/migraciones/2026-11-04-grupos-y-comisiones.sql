-- Grupos y Programas Centro de Investigación (catálogo público) y
-- Comisiones de Evaluación Académica · Procesos de Jerarquización (lectura con cuenta @usach.cl).
-- Proyecto Supabase compartido del portal VIP. Aplicada el 2026-11-04. Idempotente.
-- No contiene datos personales: solo estructura y permisos.

-- 1. Plataformas nuevas en la matriz de accesos ---------------------------------------------------
alter table public.accesos drop constraint if exists accesos_plataforma_check;
alter table public.accesos add constraint accesos_plataforma_check
  check (plataforma = any (array['normativa','cursos','trayectorias','grupos','comisiones']));
alter table public.invit_accesos drop constraint if exists invit_accesos_plataforma_check;
alter table public.invit_accesos add constraint invit_accesos_plataforma_check
  check (plataforma = any (array['normativa','cursos','trayectorias','grupos','comisiones']));

-- 2. Grupos y programas centro --------------------------------------------------------------------
create table if not exists public.gi_instancias (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('grupo','programa_centro')),
  nombre text not null,
  sigla text,
  unidad text,
  responsable text,
  descripcion text,
  lineas text,
  contacto text,
  sitio text,
  vigente boolean not null default true,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.gi_documentos (
  id bigint generated always as identity primary key,
  instancia bigint not null references public.gi_instancias(id) on delete restrict,
  tipo text not null check (tipo in ('creacion','modificacion','normativa_interna','integrantes','otro')),
  titulo text,
  numero text,
  fecha date,
  pdf text,        -- URL pública del archivo en el depósito «grupos»
  enlace text,     -- o enlace externo (p. ej. sitio de la Facultad)
  vigente boolean not null default true,
  nota text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists gi_documentos_instancia on public.gi_documentos(instancia);

create table if not exists public.gi_referencias (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('reglamento','modelo','otro')),
  titulo text not null,
  descripcion text,
  pdf text,
  enlace text,
  orden int not null default 0,
  creado timestamptz not null default now()
);

-- 3. Comisiones de evaluación académica ----------------------------------------------------------
-- departamento = Comisión de Evaluación del Departamento o Escuela (por puntaje; D.U. 26/1986 art. 34 N°1)
-- facultad     = Comisión de Evaluación de la Facultad (por criterios; art. 34; la de Apelación se regula en el mismo artículo)
-- especial     = Comisión de evaluación especial (evalúa a los miembros de la de Facultad; art. 34 N°6, D.U. 123/1987)
create table if not exists public.ce_comisiones (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('departamento','facultad','especial')),
  unidad text,     -- solo «departamento»: nombre de la unidad (Departamento o Escuela)
  nota text,
  activa boolean not null default true,
  creado timestamptz not null default now(),
  constraint ce_comisiones_unidad check ((tipo = 'departamento') = (unidad is not null and btrim(unidad) <> ''))
);
create unique index if not exists ce_comisiones_unica on public.ce_comisiones(tipo, coalesce(unidad, ''));

create table if not exists public.ce_resoluciones (
  id bigint generated always as identity primary key,
  comision bigint not null references public.ce_comisiones(id) on delete restrict,
  acto text not null default 'Resolución',
  numero text,
  fecha date,
  materia text,
  archivo text,    -- ruta en el depósito privado «comisiones»
  enlace text,
  creado timestamptz not null default now()
);
create index if not exists ce_resoluciones_comision on public.ce_resoluciones(comision);

create table if not exists public.ce_integrantes (
  id bigint generated always as identity primary key,
  comision bigint not null references public.ce_comisiones(id) on delete restrict,
  nombre text not null,
  jerarquia text,
  unidad_origen text,
  rol text,
  desde date not null,
  hasta date,
  resolucion bigint references public.ce_resoluciones(id) on delete set null,
  resolucion_termino bigint references public.ce_resoluciones(id) on delete set null,
  nota text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  constraint ce_integrantes_fechas check (hasta is null or hasta >= desde)
);
create index if not exists ce_integrantes_comision on public.ce_integrantes(comision);

-- 4. Funciones de acceso ----------------------------------------------------------------------------
-- Cuenta institucional verificada: correo @usach.cl que entró con Google (la cuenta USACH prueba el correo)
-- o cuenta del equipo con perfil activo (alta por invitación). La confirmación por correo está desactivada
-- en el proyecto, así que una cuenta con contraseña sin invitación NO prueba que el correo sea de quien la usa.
create or replace function public.es_usach_verificada()
returns boolean language sql stable security definer set search_path = public as $$
  select (
    lower(coalesce(auth.jwt() ->> 'email', '')) like '%@usach.cl'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
  ) or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo);
$$;

create or replace function public.gi_touch() returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;
drop trigger if exists gi_instancias_touch on public.gi_instancias;
create trigger gi_instancias_touch before update on public.gi_instancias for each row execute function public.gi_touch();
drop trigger if exists gi_documentos_touch on public.gi_documentos;
create trigger gi_documentos_touch before update on public.gi_documentos for each row execute function public.gi_touch();
drop trigger if exists ce_integrantes_touch on public.ce_integrantes;
create trigger ce_integrantes_touch before update on public.ce_integrantes for each row execute function public.gi_touch();

-- 5. Alta de cuentas: además de las invitadas, las @usach.cl que entran con Google (solo lectura de Comisiones;
--    no reciben perfil, así que no acceden a ningún panel). Una cuenta con contraseña sin invitación sigue rechazada.
create or replace function public.nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $function$
declare inv public.invitaciones;
begin
  select * into inv from public.invitaciones where lower(correo) = lower(new.email);

  if inv.correo is null then
    if (select count(*) from public.perfiles) = 0 then
      insert into public.perfiles (id, nombre, correo, rol)
        values (new.id, coalesce(new.raw_user_meta_data->>'nombre',''), new.email, 'administrador');
      return new;
    end if;
    if lower(coalesce(new.email, '')) like '%@usach.cl'
       and coalesce(new.raw_app_meta_data->>'provider', '') = 'google' then
      return new;
    end if;
    raise exception 'Este correo no tiene invitación para el panel de actualización.';
  end if;

  insert into public.perfiles (id, nombre, correo, rol)
    values (new.id,
            coalesce(nullif(inv.nombre,''), new.raw_user_meta_data->>'nombre', ''),
            new.email,
            inv.rol);
  delete from public.invitaciones where correo = inv.correo;
  return new;
end $function$;

-- Si se invita a alguien que ya entró con Google (cuenta sin perfil), el perfil se crea al invitar;
-- los accesos reservados en invit_accesos se aplican al crear el perfil (accesos_perfil_nuevo) o al reservarlos.
create or replace function public.invitacion_cuenta_existente()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  select id, email, raw_user_meta_data into u from auth.users where lower(email) = lower(new.correo) limit 1;
  if u.id is null or exists (select 1 from public.perfiles where id = u.id) then return new; end if;
  insert into public.perfiles (id, nombre, correo, rol)
    values (u.id, coalesce(nullif(new.nombre,''), u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'nombre', ''), u.email, new.rol);
  return null; -- la invitación ya no hace falta: la cuenta existe
end $$;
drop trigger if exists invitacion_cuenta_existente on public.invitaciones;
create trigger invitacion_cuenta_existente before insert on public.invitaciones
  for each row execute function public.invitacion_cuenta_existente();

create or replace function public.invit_acceso_cuenta_existente()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select p.id into pid from public.perfiles p where lower(p.correo) = lower(new.correo) limit 1;
  if pid is null then return new; end if;
  insert into public.accesos (perfil, plataforma, nivel) values (pid, new.plataforma, new.nivel)
    on conflict (perfil, plataforma) do update set nivel = excluded.nivel;
  return null;
end $$;
drop trigger if exists invit_acceso_cuenta_existente on public.invit_accesos;
create trigger invit_acceso_cuenta_existente before insert on public.invit_accesos
  for each row execute function public.invit_acceso_cuenta_existente();

-- 6. Seguridad por filas ----------------------------------------------------------------------------
alter table public.gi_instancias enable row level security;
alter table public.gi_documentos enable row level security;
alter table public.gi_referencias enable row level security;
alter table public.ce_comisiones enable row level security;
alter table public.ce_resoluciones enable row level security;
alter table public.ce_integrantes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['gi_instancias','gi_documentos','gi_referencias'] loop
    execute format('drop policy if exists "%1$s lectura publica" on public.%1$I', t);
    execute format('create policy "%1$s lectura publica" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "%1$s edicion" on public.%1$I', t);
    execute format('create policy "%1$s edicion" on public.%1$I for all to authenticated using (public.puede_editar(''grupos'')) with check (public.puede_editar(''grupos''))', t);
  end loop;
  foreach t in array array['ce_comisiones','ce_resoluciones','ce_integrantes'] loop
    execute format('drop policy if exists "%1$s lectura usach" on public.%1$I', t);
    execute format('create policy "%1$s lectura usach" on public.%1$I for select to authenticated using (public.es_usach_verificada() or public.es_editor(''comisiones''))', t);
    execute format('drop policy if exists "%1$s edicion" on public.%1$I', t);
    execute format('create policy "%1$s edicion" on public.%1$I for all to authenticated using (public.puede_editar(''comisiones'')) with check (public.puede_editar(''comisiones''))', t);
  end loop;
end $$;

-- 7. Depósitos de archivos ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('grupos', 'grupos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('comisiones', 'comisiones', false) on conflict (id) do nothing;

drop policy if exists "grupos lectura publica" on storage.objects;
create policy "grupos lectura publica" on storage.objects for select to anon, authenticated using (bucket_id = 'grupos');
drop policy if exists "grupos editores suben" on storage.objects;
create policy "grupos editores suben" on storage.objects for insert to authenticated with check (bucket_id = 'grupos' and public.puede_editar('grupos'));
drop policy if exists "grupos editores actualizan" on storage.objects;
create policy "grupos editores actualizan" on storage.objects for update to authenticated using (bucket_id = 'grupos' and public.puede_editar('grupos'));
drop policy if exists "grupos editores eliminan" on storage.objects;
create policy "grupos editores eliminan" on storage.objects for delete to authenticated using (bucket_id = 'grupos' and public.puede_editar('grupos'));

drop policy if exists "comisiones lectura usach" on storage.objects;
create policy "comisiones lectura usach" on storage.objects for select to authenticated using (bucket_id = 'comisiones' and (public.es_usach_verificada() or public.es_editor('comisiones')));
drop policy if exists "comisiones editores suben" on storage.objects;
create policy "comisiones editores suben" on storage.objects for insert to authenticated with check (bucket_id = 'comisiones' and public.puede_editar('comisiones'));
drop policy if exists "comisiones editores actualizan" on storage.objects;
create policy "comisiones editores actualizan" on storage.objects for update to authenticated using (bucket_id = 'comisiones' and public.puede_editar('comisiones'));
drop policy if exists "comisiones editores eliminan" on storage.objects;
create policy "comisiones editores eliminan" on storage.objects for delete to authenticated using (bucket_id = 'comisiones' and public.puede_editar('comisiones'));

-- 8. Comisiones base: una por Departamento o Escuela activa de Trayectorias, la de Facultad y la especial.
insert into public.ce_comisiones (tipo, unidad)
  select 'departamento', u.nombre from public.tr_unidades u where u.activo
  on conflict do nothing;
insert into public.ce_comisiones (tipo, unidad) values ('facultad', null) on conflict do nothing;
insert into public.ce_comisiones (tipo, unidad) values ('especial', null) on conflict do nothing;

-- 9. Endurecimiento (avisos del asesor de seguridad de Supabase) -----------------------------------
alter function public.gi_touch() set search_path = public;
revoke execute on function public.invitacion_cuenta_existente() from public, anon, authenticated;
revoke execute on function public.invit_acceso_cuenta_existente() from public, anon, authenticated;
revoke execute on function public.gi_touch() from public, anon, authenticated;
