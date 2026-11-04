// Utilidades compartidas de los módulos Grupos y Comisiones (portal VIP · FAHU USACH).
// Módulo ES: se importa con <script type="module">. Sin dependencias salvo supabase-js (esm.sh), igual que los otros paneles.

/**
 * opciones.anonimo: cliente sin sesión (catálogos públicos). No usa la sesión guardada por los paneles del mismo sitio,
 * así un token recién emitido o vencido no puede impedir la lectura pública («JWT issued at future», «JWT expired»).
 */
export async function conectar(configUrl, opciones) {
  const [lib, cfg] = await Promise.all([
    import("https://esm.sh/@supabase/supabase-js@2"),
    import(configUrl)
  ]);
  const auth = opciones && opciones.anonimo
    ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "vip-anonimo" }
    : { persistSession: true, detectSessionInUrl: true };
  const sb = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth });
  return { sb, cfg };
}

/** Errores de token transitorios: el reloj del servicio va unos segundos atrás o el token venció. Se reintenta. */
export const errorDeToken = m => /JWT (issued at future|expired)|PGRST30[13]/i.test(String(m || ""));
export async function conReintento(fn, intentos) {
  let r;
  for (let i = 0; i < (intentos || 3); i++) {
    r = await fn();
    const e = Array.isArray(r) ? r.map(x => x && x.error).find(Boolean) : r && r.error;
    if (!e || !errorDeToken(e.message)) return r;
    await new Promise(ok => setTimeout(ok, 1500 * (i + 1)));
  }
  return r;
}

/** Escapa texto para insertarlo en HTML. */
export function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Solo enlaces http(s); cualquier otro esquema (javascript:, data:) se descarta. */
export function urlSegura(u) {
  const s = String(u || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "2026-03-05" → "5 de marzo de 2026" (sin desfase horario). */
export function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? Number(m[3]) + " de " + MESES[Number(m[2]) - 1] + " de " + m[1] : "";
}
export function hoyISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function normalizar(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

let temporizador;
export function avisar(texto, tipo) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.className = "toast " + (tipo === "err" ? "err" : "ok");
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { t.hidden = true; }, tipo === "err" ? 7000 : 3500);
}

/** Abre un modal con el HTML dado. Devuelve el elemento .modal; Escape o clic fuera lo cierran. */
export function modal(html, opciones) {
  cerrarModal();
  const capa = document.createElement("div");
  capa.className = "capa";
  capa.id = "capa-modal";
  capa.innerHTML = '<div class="modal' + (opciones && opciones.ancho ? " ancho visor" : "") + '" role="dialog" aria-modal="true">' + html + "</div>";
  capa.addEventListener("click", e => { if (e.target === capa) cerrarModal(); });
  document.body.appendChild(capa);
  const m = capa.querySelector(".modal");
  const foco = m.querySelector("input,select,textarea,button");
  if (foco) foco.focus();
  return m;
}
export function cerrarModal() {
  const c = document.getElementById("capa-modal");
  if (c) c.remove();
}
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });

/** Visor de PDF en modal, con abrir en pestaña nueva. */
export function verArchivo(url, titulo) {
  const u = urlSegura(url);
  if (!u) { avisar("El archivo no tiene una dirección válida.", "err"); return; }
  modal(
    '<div class="visor-cab"><div><div class="kicker">Documento</div><h2>' + esc(titulo || "Documento") + '</h2></div>' +
    '<div class="acciones"><a class="btn sec chico" href="' + esc(u) + '" target="_blank" rel="noopener">Abrir en pestaña nueva ↗</a>' +
    '<button class="btn chico" type="button" data-cerrar>Cerrar</button></div></div>' +
    '<iframe src="' + esc(u) + '" title="' + esc(titulo || "Documento") + '"></iframe>',
    { ancho: true }
  ).querySelector("[data-cerrar]").onclick = cerrarModal;
}

/** Mensajes de Supabase en español. */
export function traducir(m) {
  const t = String(m || "");
  if (/invalid login credentials/i.test(t)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(t)) return "Falta confirmar el correo.";
  if (/rate limit|too many/i.test(t)) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (/error sending|sending (confirmation|recovery|invite|magic link|email change)|smtp/i.test(t)) return "No se pudo enviar el correo en este momento. Inténtalo más tarde o escribe a viceinvestigacionfahu@usach.cl.";
  if (/invitaci/i.test(t)) return "Este correo no tiene invitación. Las cuentas del equipo se crean por invitación desde un panel del portal.";
  if (/provider is not enabled|unsupported provider/i.test(t)) return "El ingreso con Google aún no está habilitado.";
  if (/row-level security|permission denied|violates row-level/i.test(t)) return "Tu cuenta no tiene permiso para esta acción.";
  if (/violates foreign key|still referenced/i.test(t)) return "No se puede eliminar: tiene registros asociados. Elimínalos primero.";
  if (/duplicate key|already exists/i.test(t)) return "Ya existe un registro igual.";
  if (/ce_integrantes_fechas/i.test(t)) return "La fecha de término no puede ser anterior a la de inicio.";
  if (/JWT (issued at future|expired)/i.test(t)) return "La sesión aún no está lista (diferencia de hora con el servidor). Recarga la página en unos segundos.";
  if (/failed to fetch|network/i.test(t)) return "Sin conexión con el servicio de datos. Revisa tu conexión e inténtalo de nuevo.";
  return t || "Error desconocido.";
}

/** Nivel de la sesión en una plataforma: 'administracion' | 'edicion' | 'consulta' | 'ninguno'. */
export async function nivelEn(sb, plataforma) {
  const s = (await sb.auth.getSession()).data.session;
  if (!s) return { sesion: null, nivel: "ninguno", perfil: null };
  const p = await conReintento(() => sb.from("perfiles").select("id,nombre,correo,rol,activo").eq("id", s.user.id).maybeSingle());
  if (p.error) throw p.error; // un fallo de lectura no debe confundirse con «sin perfil»
  const perfil = p.data || null;
  if (!perfil || !perfil.activo) return { sesion: s, nivel: "ninguno", perfil };
  if (perfil.rol === "administrador") return { sesion: s, nivel: "administracion", perfil };
  const a = await conReintento(() => sb.from("accesos").select("nivel").eq("perfil", perfil.id).eq("plataforma", plataforma).maybeSingle());
  if (a.error) throw a.error;
  return { sesion: s, nivel: (a.data && a.data.nivel) || "ninguno", perfil };
}

/** Registro en la tabla común de actividad (solo cuentas del equipo; si falla, no interrumpe). */
export async function anotar(sb, prefijo, accion, detalle) {
  try {
    const s = (await sb.auth.getSession()).data.session;
    await sb.from("actividad").insert({ correo: s ? s.user.email : "", accion: prefijo + accion, detalle: detalle || "" });
  } catch (e) { /* sin registro */ }
}

/** Nombre de archivo seguro para el depósito. */
export function rutaArchivo(carpeta, nombre) {
  const base = normalizar(nombre).replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "documento";
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(nombre || "") || [, "pdf"])[1].toLowerCase();
  return carpeta + "/" + Date.now() + "-" + base + "." + ext;
}
