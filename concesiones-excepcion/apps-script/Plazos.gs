/**
 * Plazos.gs · Plazos de las analistas y recordatorios a ellas (solo administración; pedido de la persona, 2026-11-06).
 * La lógica de plazos está en Logica.gs (PLAZOS_ANALISTA, plazoAnalista). El recordatorio usa la plantilla «recordatorio_analista»
 * (editable en Plantillas de correo), se envía con vista previa y queda en la bitácora de cada caso incluido.
 */

const EVENTO_RECORDATORIO_ANALISTA = 'recordatorio_analista';

/** Casos abiertos con analista (o sin ella) y su plazo. `todos`: incluye los que están en plazo. */
function plazosCasos_(u, todos) {
  const p = parametros_();
  const fer = feriados_();
  const hoy = new Date();
  const ultimo = {};
  leer_(HOJAS.bitacora).forEach(b => {
    if (b.evento !== EVENTO_RECORDATORIO_ANALISTA || !b.fecha) return;
    const f = String(b.folio);
    if (!ultimo[f] || new Date(b.fecha) > new Date(ultimo[f])) ultimo[f] = b.fecha;
  });
  const url = urlPanel_();
  return leer_(HOJAS.solicitudes).filter(s => s.folio && puedeVerSolicitud(u, s)).map(s => {
    const pl = plazoAnalista(s, hoy, p, fer);
    if (!pl || (!todos && pl.situacion === 'en_plazo')) return null;
    return {
      folio: String(s.folio), programa: s.programa, estado: s.estado, etiqueta: (estadoPorId(s.estado) || {}).etiqueta || s.estado,
      analista: String(s.analista || '').trim().toLowerCase(), tarea: pl.tarea, plazo: pl.plazo, transcurridos: pl.transcurridos,
      restantes: pl.restantes, vence: pl.vence, desde: pl.desde, situacion: pl.situacion, ultimoRecordatorio: ultimo[String(s.folio)] || '',
      enlace: url ? enlaceCorreo_({ folio: s.folio }, p) : ''
    };
  }).filter(Boolean);
}

/** Vista «Plazos de analistas»: casos por vencer o vencidos, agrupados por analista. */
function api_plazosAnalistas() {
  const u = requiere_('administracion');
  const cuentas = leer_(HOJAS.cuentas);
  const casos = plazosCasos_(u, false);
  const porAnalista = {};
  casos.filter(c => c.analista).forEach(c => { (porAnalista[c.analista] = porAnalista[c.analista] || []).push(c); });
  const analistas = Object.keys(porAnalista).map(correo => {
    const cuenta = cuentas.find(x => String(x.correo).trim().toLowerCase() === correo);
    return { correo: correo, nombre: cuenta ? cuenta.nombre : correo, activa: !!(cuenta && esSi(cuenta.activo)), casos: porAnalista[correo] };
  }).sort((a, b) => b.casos.filter(c => c.situacion === 'vencido').length - a.casos.filter(c => c.situacion === 'vencido').length || String(a.nombre).localeCompare(String(b.nombre)));
  const p = parametros_();
  return serializar_({
    analistas: analistas,
    sinAnalista: casos.filter(c => !c.analista),
    aviso: Number(p.aviso_plazo_dias || 1),
    plazoAnalista: Number(p.plazo_analista_dias || 3)
  });
}

/** Arma el recordatorio a una analista con los folios elegidos (deben ser casos suyos con plazo por vencer o vencido). */
function componerRecordatorioAnalista_(u, correo, folios) {
  correo = String(correo || '').trim().toLowerCase();
  const pedidos = (folios || []).map(String);
  if (!pedidos.length) throw new Error('Elija al menos un caso.');
  const casos = plazosCasos_(u, true).filter(c => c.analista === correo && pedidos.indexOf(c.folio) >= 0);
  const fuera = pedidos.filter(f => !casos.some(c => c.folio === f));
  if (fuera.length) throw new Error('Los casos ' + fuera.join(', ') + ' ya no están a cargo de esta analista o cambiaron de paso. Recargue la vista.');
  const cuenta = leer_(HOJAS.cuentas).find(x => String(x.correo).trim().toLowerCase() === correo);
  const t = plantilla_(EVENTO_RECORDATORIO_ANALISTA);
  const yo = leer_(HOJAS.cuentas).find(x => String(x.correo).trim().toLowerCase() === u.correo);
  const v = {
    analista: cuenta && cuenta.nombre ? cuenta.nombre : correo,
    cantidad: String(casos.length),
    casos: listaCasosAnalista(casos),
    remitente: (yo && yo.nombre ? yo.nombre + '\n' : '') + parametros_().remitente_nombre
  };
  return {
    casos: casos,
    correo: { evento: EVENTO_RECORDATORIO_ANALISTA, descripcion: t.descripcion, para: [correo], cc: [], faltantes: [], omitidos: [],
      asunto: rellenar(t.asunto, v), cuerpo: rellenar(t.cuerpo, v), replyTo: u.correo }
  };
}

function api_previsualizarRecordatorioAnalista(correo, folios) {
  const u = requiere_('administracion');
  const r = componerRecordatorioAnalista_(u, correo, folios);
  return serializar_({ correo: r.correo, casos: r.casos.map(c => ({ folio: c.folio, situacion: c.situacion })) });
}

/** Envía el recordatorio (texto editable en la vista previa) y lo registra en la bitácora de cada caso incluido. */
function api_enviarRecordatorioAnalista(correo, folios, envio) {
  const u = requiere_('administracion');
  envio = envio || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const r = componerRecordatorioAnalista_(u, correo, folios);
    const c = r.correo;
    const editado = (envio.asunto && envio.asunto !== c.asunto) || (envio.cuerpo && envio.cuerpo !== c.cuerpo);
    if (envio.asunto) c.asunto = envio.asunto;
    if (envio.cuerpo) c.cuerpo = envio.cuerpo;
    enviar_(c, []);
    const ahora = new Date();
    const sit = { vencido: 'plazo vencido', vence_hoy: 'plazo vence hoy', por_vencer: 'plazo por vencer' };
    r.casos.forEach(k => anexar_(HOJAS.bitacora, {
      fecha: ahora, folio: k.folio, tipo: 'correo', quien: u.correo,
      texto: 'Recordatorio a la analista (' + (sit[k.situacion] || k.situacion) + '): ' + k.tarea,
      evento: EVENTO_RECORDATORIO_ANALISTA, para: c.para.join(', '), cc: '', asunto: c.asunto, editado: editado ? 'SÍ' : 'NO'
    }));
    return { ok: true, para: c.para, casos: r.casos.length };
  } finally {
    lock.releaseLock();
  }
}
