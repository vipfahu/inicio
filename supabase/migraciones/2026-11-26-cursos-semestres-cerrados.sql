-- Cursos: los semestres cerrados (historial) solo los modifica la administración de la plataforma.
-- Las cuentas de edición siguen pudiendo agregar, editar y eliminar cursos de sus programas en semestres en borrador o publicados.

create or replace function public.cf_periodo_abierto(per text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.es_admin('cursos')
      or exists (select 1 from public.cf_periodos p where p.id = per and p.estado <> 'cerrado');
$$;
revoke all on function public.cf_periodo_abierto(text) from public;
grant execute on function public.cf_periodo_abierto(text) to authenticated;

drop policy if exists "cf_cursos inserta" on public.cf_cursos;
create policy "cf_cursos inserta" on public.cf_cursos for insert to authenticated
  with check (public.cf_puede(programa) and public.cf_periodo_abierto(periodo));

drop policy if exists "cf_cursos actualiza" on public.cf_cursos;
create policy "cf_cursos actualiza" on public.cf_cursos for update to authenticated
  using (public.cf_puede(programa) and public.cf_periodo_abierto(periodo))
  with check (public.cf_puede(programa) and public.cf_periodo_abierto(periodo));

drop policy if exists "cf_cursos elimina" on public.cf_cursos;
create policy "cf_cursos elimina" on public.cf_cursos for delete to authenticated
  using (public.cf_puede(programa) and public.cf_periodo_abierto(periodo));
