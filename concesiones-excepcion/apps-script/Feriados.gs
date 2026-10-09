/**
 * Feriados.gs · Feriados de Chile automáticos, sin carga manual.
 * Fuente: el calendario público de feriados de Chile de Google (incluye feriados móviles, elecciones e interferiados cuando Google
 * los publica). Se consulta en la tarea diaria y se guarda en las propiedades del script (año en curso y siguiente); se renueva cada
 * 30 días. Si la consulta falla, se usa la última lista guardada; si nunca hubo una, los plazos cuentan solo de lunes a viernes.
 */

const CALENDARIOS_FERIADOS = [
  'es.cl.official#holiday@group.v.calendar.google.com', // solo feriados oficiales (si Google lo ofrece para Chile)
  'es.cl#holiday@group.v.calendar.google.com'           // feriados y conmemoraciones; estas se filtran por descripción
];
const CLAVE_FERIADOS = 'feriados_auto';
const DIAS_RENOVAR_FERIADOS = 30;

function cacheFeriados_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CLAVE_FERIADOS) || '{}'); } catch (e) { return {}; }
}

/** Lista 'AAAA-MM-DD' para los cálculos de días hábiles. Nunca lanza error. */
function feriados_() {
  let c = cacheFeriados_();
  if (!c.fechas) c = actualizarFeriados_(false);
  return c.fechas || [];
}

/** Consulta el calendario si la lista guardada no cubre el año en curso o tiene más de 30 días. Devuelve la lista vigente. */
function actualizarFeriados_(forzar) {
  const props = PropertiesService.getScriptProperties();
  const c = cacheFeriados_();
  const anio = new Date().getFullYear();
  const reciente = c.actualizado && (Date.now() - c.actualizado) < DIAS_RENOVAR_FERIADOS * 86400000;
  if (!forzar && reciente && (c.anios || []).indexOf(anio) >= 0) return c;
  const tz = Session.getScriptTimeZone();
  const fmt = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  let ultimoError = '';
  for (const id of CALENDARIOS_FERIADOS) {
    try {
      const cal = CalendarApp.getCalendarById(id);
      if (!cal) continue;
      const eventos = cal.getEvents(new Date(anio, 0, 1), new Date(anio + 2, 0, 1))
        .filter(e => e.isAllDayEvent())
        .map(e => ({ inicio: fmt(e.getAllDayStartDate()), fin: fmt(e.getAllDayEndDate()), titulo: e.getTitle(), descripcion: e.getDescription() }));
      const fechas = feriadosDesdeEventos(eventos);
      if (!fechas.length) continue;
      const titulos = {};
      eventos.forEach(e => { if (fechas.indexOf(e.inicio) >= 0) titulos[e.inicio] = String(e.titulo || '').slice(0, 60); });
      const nuevo = { fechas: fechas, titulos: titulos, anios: [anio, anio + 1], fuente: id, actualizado: Date.now() };
      props.setProperty(CLAVE_FERIADOS, JSON.stringify(nuevo));
      return nuevo;
    } catch (err) {
      ultimoError = err.message;
    }
  }
  // Sin respuesta: se conserva la lista anterior (si existe) y se deja constancia del problema.
  const conError = Object.assign({}, c, { error: ultimoError || 'El calendario de feriados no devolvió datos.', intento: Date.now() });
  try { props.setProperty(CLAVE_FERIADOS, JSON.stringify(conError)); } catch (e) { /* sin efecto */ }
  return conError;
}

/** Resumen para Configuración y Diagnóstico. */
function estadoFeriados_() {
  const c = cacheFeriados_();
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return {
    fuente: c.fuente || '',
    actualizado: c.actualizado ? new Date(c.actualizado) : null,
    error: c.error || '',
    total: (c.fechas || []).length,
    proximos: (c.fechas || []).filter(f => f >= hoy).slice(0, 12).map(f => ({ fecha: f, titulo: (c.titulos || {})[f] || '' }))
  };
}
