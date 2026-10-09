/**
 * Instalar.gs · Instalación en la planilla original, desde la cuenta institucional.
 *
 *   Paso 1 · instalarPaso1()  Respaldo, pestañas nuevas, plantillas, parámetros, programas, carpeta en Drive.
 *           → completar a mano: correos en «Cuentas» y «Programas», enlace_rc en «Parámetros».
 *   Paso 2 · instalarPaso2()  Migración de las solicitudes existentes y activación de disparadores.
 *   diagnostico()             Revisión de lo que falta (se puede ejecutar cuantas veces se quiera).
 *
 * Nada se borra: las columnas de gestión antiguas se ocultan, no se eliminan.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CAE')
    .addItem('Abrir panel', 'abrirPanel')
    .addItem('Diagnóstico', 'diagnostico')
    .addItem('Actualizar (tras subir código nuevo)', 'actualizarInstalacion')
    .addSeparator()
    .addItem('Instalación · paso 1 (estructura)', 'instalarPaso1')
    .addItem('Instalación · paso 2 (migrar y activar)', 'instalarPaso2')
    .addToUi();
}

function soloDuenia_() {
  const a = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const e = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!a || a !== e) throw new Error('La instalación debe ejecutarla la cuenta dueña de la planilla.');
  const d = propiedad_('DUENIA');
  if (d && d !== a) throw new Error('La plataforma ya fue instalada por ' + d + '.');
}

function avisar_(titulo, texto) {
  Logger.log(titulo + '\n' + texto);
  try { SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* ejecutado desde el editor */ }
}

function instalarPaso1() {
  soloDuenia_();
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', libro.getId());
  props.setProperty('DUENIA', Session.getEffectiveUser().getEmail().toLowerCase());
  const informe = [];

  // Carpeta de la plataforma (privada) y respaldo de valores antes de tocar nada.
  const raiz = DriveApp.createFolder('Plataforma CAE · NO COMPARTIR');
  raiz.createFolder('Expedientes');
  const respaldo = SpreadsheetApp.create('Respaldo planilla CAE antes de instalar · ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
  libro.getSheets().forEach(h => {
    const v = h.getDataRange().getValues();
    const d = respaldo.insertSheet(h.getName());
    if (v.length && v[0].length) d.getRange(1, 1, v.length, v[0].length).setValues(v);
  });
  const hoja1 = respaldo.getSheets()[0];
  if (respaldo.getSheets().length > 1 && hoja1.getLastRow() === 0) respaldo.deleteSheet(hoja1);
  DriveApp.getFileById(respaldo.getId()).moveTo(raiz);
  informe.push('Respaldo de valores creado en «Plataforma CAE · NO COMPARTIR».');

  Object.keys(COLUMNAS).forEach(n => asegurarHoja_(n));

  if (leer_(HOJAS.parametros).length === 0) {
    anexarVarias_(HOJAS.parametros, PARAMETROS_INICIALES.map(p => ({ clave: p[0], valor: p[1], descripcion: p[2] })));
  }
  const fp = leer_(HOJAS.parametros).find(p => p.clave === 'carpeta_raiz_id');
  actualizar_(HOJAS.parametros, fp._fila, { valor: raiz.getId() });

  if (leer_(HOJAS.plantillas).length === 0) {
    anexarVarias_(HOJAS.plantillas, PLANTILLAS_INICIALES.map(t => ({
      evento: t[0], descripcion: t[1], para: t[2], cc: t[3], asunto: t[4], cuerpo: t[5], asunto_original: t[4], cuerpo_original: t[5]
    })));
  }

  // Programas: los del Formulario (si se puede leer) y los que aparecen en respuestas antiguas.
  const resp = hojaRespuestas_();
  const enc = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0].map(String);
  const datos = resp.getLastRow() > 1 ? resp.getRange(2, 1, resp.getLastRow() - 1, enc.length).getValues() : [];
  const jProg = columnaPorPrefijo_(enc, RESPUESTA.programa);
  const progs = {};
  datos.forEach(r => { if (r[jProg]) progs[String(r[jProg]).trim()] = true; });
  try {
    const form = FormApp.openByUrl(resp.getFormUrl());
    const item = form.getItems().find(i => i.getTitle().indexOf(RESPUESTA.programa) === 0);
    if (item && item.getType() === FormApp.ItemType.LIST) item.asListItem().getChoices().forEach(c => { progs[c.getValue()] = true; });
    if (item && item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) item.asMultipleChoiceItem().getChoices().forEach(c => { progs[c.getValue()] = true; });
  } catch (e) { informe.push('No se pudo leer el Formulario (' + e.message + '); se usaron los programas de las respuestas.'); }
  const yaProg = leer_(HOJAS.programas).map(p => p.programa);
  anexarVarias_(HOJAS.programas, Object.keys(progs).sort().filter(p => yaProg.indexOf(p) < 0)
    .map(p => ({ programa: p, correo_direccion: '', analista: '', activo: 'SÍ' })));

  // Cuentas: una fila por cada analista que figura en las respuestas antiguas, con el correo por completar.
  const jAn = columnaPorPrefijo_(enc, LEGADO.analista);
  const nombres = {};
  if (jAn >= 0) datos.forEach(r => { if (String(r[jAn]).trim()) nombres[String(r[jAn]).trim()] = true; });
  const yaCuentas = leer_(HOJAS.cuentas).map(c => c.nombre);
  anexarVarias_(HOJAS.cuentas, Object.keys(nombres).filter(n => yaCuentas.indexOf(n) < 0).map(n => ({
    correo: '', nombre: n, rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'SÍ', recibe_eventos: '',
    creada_por: 'instalación', creada_en: new Date(), notas: 'Completar correo @usach.cl antes del paso 2'
  })));

  // Listas desplegables para editar la matriz a mano durante la instalación.
  const hc = hoja_(HOJAS.cuentas);
  const regla = vals => SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build();
  hc.getRange('C2:C500').setDataValidation(regla(ROLES));
  hc.getRange('D2:D500').setDataValidation(regla(NIVELES));
  hc.getRange('F2:F500').setDataValidation(regla(['SÍ', 'NO']));
  hoja_(HOJAS.programas).getRange('D2:D500').setDataValidation(regla(['SÍ', 'NO']));

  informe.push('Pestañas creadas: ' + Object.keys(COLUMNAS).join(', ') + '.');
  informe.push('AHORA: complete los correos en «Cuentas» (incluya al menos una persona con nivel administracion), ' +
    '«correo_direccion» y «analista» en «Programas», y «enlace_rc» en «Parámetros». Luego publique el panel ' +
    '(Implementar → Nueva implementación → Aplicación web) y recién entonces ejecute el paso 2.');
  avisar_('Instalación · paso 1 listo', informe.join('\n\n'));
}

function instalarPaso2() {
  soloDuenia_();
  const informe = [];
  if (leer_(HOJAS.solicitudes).length) throw new Error('«Solicitudes» ya tiene datos: la migración ya se hizo.');
  // Sin el panel publicado no existe el enlace de seguimiento y los correos al estudiante no podrían salir.
  if (!urlPanel_()) throw new Error('Primero publique el panel: Implementar → Nueva implementación → Aplicación web. Luego vuelva a ejecutar el paso 2.');
  const cuentas = leer_(HOJAS.cuentas);
  const sinCorreo = cuentas.filter(c => !/@usach\.cl$/i.test(String(c.correo).trim()));
  if (sinCorreo.length) throw new Error('Faltan correos @usach.cl en «Cuentas» para: ' + sinCorreo.map(c => c.nombre).join(', '));
  if (!cuentas.some(c => c.nivel === 'administracion' && esSi(c.activo))) throw new Error('Debe haber al menos una cuenta activa con nivel administracion.');
  const porNombre = {};
  cuentas.forEach(c => { porNombre[String(c.nombre).trim().toLowerCase()] = String(c.correo).trim().toLowerCase(); });

  const resp = hojaRespuestas_();
  const enc = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0].map(String);
  const n = resp.getLastRow() - 1;
  const datos = n > 0 ? resp.getRange(2, 1, n, enc.length).getValues() : [];
  const col = (pref, exacto) => columnaPorPrefijo_(enc, pref, exacto);
  const J = {
    pres: col(LEGADO.presentacion), est: col(LEGADO.estado, true), act: col(LEGADO.actual), an: col(LEGADO.analista),
    obs: col(LEGADO.obsVicedecano), com: col(LEGADO.comentarios), std: col(LEGADO.std), ext: col(LEGADO.extras),
    cae: col(LEGADO.archivoCae), res: col(LEGADO.resolucion)
  };
  const val = (r, j) => j >= 0 ? r[j] : '';
  // Columnas sin encabezado a la derecha de «archivo resolución» también traen notas.
  const extrasSinNombre = [];
  for (let j = J.res + 1; J.res >= 0 && j < enc.length; j++) if (!enc[j].trim()) extrasSinNombre.push(j);

  const solicitudes = [], bitacora = [], vistos = {};
  const ahora = new Date();
  datos.forEach((r, i) => {
    if (r.every(x => x === '' || x === null)) return;
    const fila = i + 2;
    const o = {};
    Object.keys(RESPUESTA).forEach(k => { const j = columnaPorPrefijo_(enc, RESPUESTA[k]); o[k] = j >= 0 ? r[j] : ''; });
    const notas = [];
    let revisar = false;
    let folio = normalizarFolio(r[0]);
    if (r[0] instanceof Date) notas.push('Folio guardado como fecha por Sheets; corregido a ' + folio + '.');
    if (folio && !/^\d{2}\/\d{4}$/.test(folio)) { notas.push('Folio no reconocido «' + folio + '».'); folio = ''; }
    if (folio && vistos[folio]) { notas.push('FOLIO DUPLICADO: ' + folio + ' ya estaba en la fila ' + vistos[folio] + '.'); folio = ''; }
    if (!folio) revisar = true;
    if (folio) vistos[folio] = fila;
    const comentarios = [val(r, J.com), val(r, J.ext)].concat(extrasSinNombre.map(j => r[j])).join(' ');
    const m = estadoMigrado(val(r, J.pres), val(r, J.est), val(r, J.act), comentarios);
    if (m.nota) notas.push(m.nota);
    revisar = revisar || m.revisar;
    const nombreAn = String(val(r, J.an) || '').trim();
    const correoAn = nombreAn ? (porNombre[nombreAn.toLowerCase()] || '') : '';
    if (nombreAn && !correoAn) { notas.push('Analista «' + nombreAn + '» sin cuenta.'); revisar = true; }
    const sem = String(o.semestre || '').trim();
    const semN = sem === 'Semestre I' || sem === 'Semestre II' ? sem : (/primer|\bI\b/i.test(sem) ? 'Semestre I' : (sem ? 'Semestre II' : ''));
    if (sem && sem !== semN) notas.push('Semestre «' + sem + '» normalizado.');
    const std = String(val(r, J.std) || '').trim();
    const tipos = separarTipos(o.tipos);
    const marca = o.marca instanceof Date ? o.marca : ahora;
    solicitudes.push({
      folio: folio, fila_respuesta: fila, fecha_recepcion: marca, correo_verificado: String(o.correoVerificado || '').toLowerCase(),
      apellido1: o.apellido1, apellido2: o.apellido2, nombres: o.nombres, run: String(o.run || ''), correo: o.correo || o.correoVerificado,
      telefono: String(o.telefono || ''), programa: o.programa, anio: o.anio, semestre: semN,
      tipo_catalogo: tipos.catalogo, tipo_texto_libre: tipos.libre, estado: m.estado, estado_desde: ahora,
      analista: correoAn, n_std: std === '0' || std === '-' ? '' : std.split('/')[0].trim(),
      comentarios_analista: val(r, J.com), obs_vicedecano: val(r, J.obs),
      resolucion: [val(r, J.res), val(r, J.cae)].filter(x => String(x || '').trim()).join(' · '),
      recordatorios: 0, revisar: revisar ? 'SÍ' : '', nota_migracion: notas.join(' '), actualizado: ahora,
      _marca: marca, _adjunto: o.adjunto,
      _legado: [['Comentarios analista', val(r, J.com)], ['Observaciones extras', val(r, J.ext)]]
        .concat(extrasSinNombre.map(j => ['Columna sin nombre', r[j]]))
    });
  });

  // Folios faltantes o duplicados: correlativo siguiente, en orden de llegada.
  solicitudes.slice().sort((a, b) => a._marca - b._marca).forEach(s => {
    if (s.folio) return;
    s.folio = siguienteFolio(solicitudes.map(x => x.folio), s._marca.getFullYear());
    s.nota_migracion = (s.nota_migracion + ' Folio asignado en la migración: ' + s.folio + '.').trim();
    s.revisar = 'SÍ';
  });

  solicitudes.forEach(s => {
    bitacora.push({ fecha: s._marca, folio: s.folio, tipo: 'estado', quien: 'Formulario', texto: 'Solicitud recibida desde el formulario.', estado_nuevo: 'recibida' });
    s._legado.forEach(([etq, txt]) => String(txt || '').split('//').map(x => x.trim()).filter(Boolean)
      .forEach(t => bitacora.push({ fecha: '', folio: s.folio, tipo: 'nota', quien: 'migración', texto: '[' + etq + '] ' + t })));
    if (s.estado !== 'recibida') {
      bitacora.push({ fecha: '', folio: s.folio, tipo: 'estado', quien: 'migración', texto: 'Estado migrado desde la planilla anterior: ' + estadoPorId(s.estado).etiqueta + '.', estado_nuevo: s.estado });
    }
  });

  anexarVarias_(HOJAS.solicitudes, solicitudes);
  anexarVarias_(HOJAS.bitacora, bitacora);
  // Folio canónico (texto) en la columna A de las respuestas.
  solicitudes.forEach(s => resp.getRange(s.fila_respuesta, 1).setNumberFormat('@').setValue(s.folio));
  informe.push(solicitudes.length + ' solicitudes migradas; ' + solicitudes.filter(s => s.revisar).length + ' marcadas para revisar.');

  // Expedientes: carpeta por caso y acceso directo a los antecedentes del Formulario.
  leer_(HOJAS.solicitudes).forEach(s => {
    const orig = solicitudes.find(x => x.folio === s.folio);
    vincularAntecedentes_(s, orig ? orig._adjunto : '');
  });

  // Columnas de gestión antiguas: se ocultan y se rotulan como LEGADO.
  if (J.pres >= 0) {
    resp.hideColumns(J.pres + 1, enc.length - J.pres);
    resp.getRange(1, J.pres + 1).setNote('LEGADO · Columnas ocultadas por la instalación de la plataforma CAE. No editar: la gestión se hace en el panel.');
  }

  // Disparadores (sin duplicar).
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['alRecibirFormulario', 'tareaDiaria'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('alRecibirFormulario').forSpreadsheet(libro_()).onFormSubmit().create();
  ScriptApp.newTrigger('tareaDiaria').timeBased().everyDays(1).atHour(8).create();
  informe.push('Disparadores activos: recepción del formulario y tarea diaria (08:00).');

  const acc = accesosNoAutorizados_();
  if (acc.length) informe.push('ATENCIÓN · accesos directos no autorizados (retírelos cuando el panel esté en uso):\n- ' + acc.join('\n- '));
  informe.push('Panel: ' + urlPanel_() + '\nSiguiente: pruebe el panel con la cuenta de una analista y ejecute «Diagnóstico».');
  avisar_('Instalación · paso 2 listo', informe.join('\n\n'));
}

function diagnostico() {
  const p = [];
  const ok = [];
  try { soloSistema_(); } catch (e) { throw new Error('El diagnóstico debe ejecutarlo la cuenta dueña.'); }
  const cuentas = leer_(HOJAS.cuentas);
  cuentas.filter(c => !/@usach\.cl$/i.test(String(c.correo))).forEach(c => p.push('Cuenta sin correo @usach.cl: ' + c.nombre));
  if (!cuentas.some(c => c.nivel === 'administracion' && esSi(c.activo))) p.push('No hay cuentas activas con nivel administracion.');
  if (!cuentas.some(c => c.rol === 'Analista' && esSi(c.activo))) p.push('No hay cuentas activas con rol «Analista» (nadie recibirá avisos de solicitudes nuevas).');
  leer_(HOJAS.programas).filter(x => esSi(x.activo) && x.analista && !analistaActiva_(x.analista)).forEach(x => p.push('Analista de «' + x.programa + '» sin cuenta activa con rol Analista: ' + x.analista));
  ['Vicedecano/a', 'Registro Curricular'].forEach(r => { if (!cuentas.some(c => c.rol === r && esSi(c.activo))) p.push('No hay cuenta activa con rol «' + r + '» (no recibirá correos).'); });
  leer_(HOJAS.programas).filter(x => esSi(x.activo)).forEach(x => {
    if (!x.correo_direccion) p.push('Programa sin correo de dirección: ' + x.programa);
  });
  const par = parametros_();
  if (!par.enlace_rc || par.enlace_rc === 'COMPLETAR') p.push('Falta «enlace_rc» en Parámetros (lo usa el correo «No procede»).');
  const hs = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  ['alRecibirFormulario', 'tareaDiaria'].forEach(h => { if (hs.indexOf(h) < 0) p.push('Falta el disparador «' + h + '» (ejecute el paso 2).'); });
  if (!urlPanel_()) p.push('El panel aún no está publicado como aplicación web.'); else ok.push('Panel: ' + urlPanel_());
  accesosNoAutorizados_().forEach(a => p.push('Acceso no autorizado · ' + a));
  const pend = leer_(HOJAS.solicitudes).filter(s => esSi(s.revisar)).map(s => s.folio);
  if (pend.length) p.push('Solicitudes marcadas para revisar: ' + pend.join(', '));
  ok.push('Cuota de correo restante hoy: ' + MailApp.getRemainingDailyQuota());
  avisar_('Diagnóstico CAE', (p.length ? 'Pendiente:\n- ' + p.join('\n- ') : 'Sin pendientes.') + '\n\n' + ok.join('\n'));
}

function abrirPanel() {
  const url = urlPanel_();
  const html = url
    ? '<p style="font-family:sans-serif">Panel: <a href="' + url + '" target="_blank">' + url + '</a></p>'
    : '<p style="font-family:sans-serif">El panel aún no está publicado. Use Implementar → Nueva implementación → Aplicación web.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(120), 'Panel CAE');
}

/**
 * Tras subir una versión nueva del código: agrega las plantillas nuevas que falten
 * (no modifica las existentes, que pueden haber sido editadas por el equipo).
 */
function actualizarInstalacion() {
  soloDuenia_();
  const cambios = aplicarActualizacion_();
  PropertiesService.getScriptProperties().setProperty('huella_estructura', huellaEstructura_());
  avisar_('Actualización CAE', cambios.length ? 'Agregado:\n- ' + cambios.join('\n- ') + '\n\nFormulario para estudiantes: ' + urlPanel_() + '?v=solicitud' : 'No había nada nuevo que agregar.');
}

/**
 * Huella de lo que la planilla debe tener (columnas, parámetros, plantillas). Cuando se sube código nuevo y la huella cambia,
 * la planilla se pone al día sola en la siguiente visita al panel o al formulario, sin pasar por el menú.
 */
function huellaEstructura_() {
  const txt = JSON.stringify([COLUMNAS, PARAMETROS_INICIALES.map(p => p[0]), PLANTILLAS_INICIALES]);
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16) + '-' + txt.length;
}

function actualizarSiCorresponde_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const huella = huellaEstructura_();
    if (props.getProperty('huella_estructura') === huella) return;
    if (!props.getProperty('SS_ID') || !libro_().getSheetByName(HOJAS.parametros)) return; // aún sin instalar
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (props.getProperty('huella_estructura') === huella) return;
      const cambios = aplicarActualizacion_();
      props.setProperty('huella_estructura', huella);
      anexar_(HOJAS.bitacora, {
        fecha: new Date(), folio: '—', tipo: 'sistema', quien: 'Sistema',
        texto: 'Actualización automática tras código nuevo' + (cambios.length ? ': ' + cambios.join(' · ') : ' (sin cambios en la planilla).')
      });
    } finally { lock.releaseLock(); }
  } catch (err) {
    console.error('Actualización automática no aplicada: ' + err.message); // se reintenta en la próxima visita; queda el menú manual
  }
}

/** Pone la planilla al día con el código vigente. No muestra nada: devuelve la lista de cambios. */
function aplicarActualizacion_() {
  const cambios = [];
  // Casos en estados que el flujo vigente ya no tiene (p. ej., tras volver a una versión anterior): se llevan al estado
  // equivalente y se marcan «Por revisar» para que el equipo confirme el paso siguiente. No se envía ningún correo.
  const equivalente = { autorizada: 'vb', denegada_vb: 'vb', vb_informe: 'informe_rc' };
  if (libro_().getSheetByName(HOJAS.solicitudes)) {
    const huerfanos = leer_(HOJAS.solicitudes).filter(x => x.estado && !estadoPorId(x.estado));
    huerfanos.forEach(x => {
      const nuevo = equivalente[x.estado] || 'recibida';
      actualizar_(HOJAS.solicitudes, x._fila, {
        estado: nuevo, revisar: 'SÍ',
        nota_migracion: [x.nota_migracion, 'Estado «' + x.estado + '» no existe en el flujo vigente; se llevó a «' + nuevo + '».'].filter(Boolean).join(' ')
      });
    });
    if (huerfanos.length) cambios.push('Casos llevados a un estado vigente y marcados por revisar: ' + huerfanos.map(x => x.folio).join(', '));
  }
  Object.keys(COLUMNAS).forEach(n => {
    const h = asegurarHoja_(n);
    const enc = encabezados_(n);
    const faltan = COLUMNAS[n].filter(c => enc.indexOf(c) < 0);
    if (faltan.length) {
      h.getRange(1, h.getLastColumn() + 1, 1, faltan.length).setValues([faltan]).setFontWeight('bold').setBackground('#3A4450').setFontColor('#FFFFFF');
      cambios.push(n + ': columnas ' + faltan.join(', '));
    }
  });
  const yaPar = leer_(HOJAS.parametros).map(p => p.clave);
  const parNuevos = PARAMETROS_INICIALES.filter(p => yaPar.indexOf(p[0]) < 0);
  anexarVarias_(HOJAS.parametros, parNuevos.map(p => ({ clave: p[0], valor: p[1], descripcion: p[2] })));
  if (parNuevos.length) cambios.push('Parámetros: ' + parNuevos.map(p => p[0]).join(', '));
  // Plantillas de eventos que ya no existen en el flujo (p. ej., correos al programa, que ahora va por STD).
  const vigentes = PLANTILLAS_INICIALES.map(t => t[0]);
  const obsoletas = leer_(HOJAS.plantillas).filter(t => vigentes.indexOf(t.evento) < 0);
  obsoletas.map(t => t._fila).sort((a, b) => b - a).forEach(f => hoja_(HOJAS.plantillas).deleteRow(f));
  if (obsoletas.length) cambios.push('Plantillas retiradas (ya no se usan): ' + obsoletas.map(t => t.evento).join(', '));
  // Plantillas que el equipo no ha editado: se actualizan al texto de esta versión.
  const actualizadas = [], conservadas = [];
  leer_(HOJAS.plantillas).forEach(t => {
    const nueva = PLANTILLAS_INICIALES.find(x => x[0] === t.evento);
    if (!nueva || (t.asunto_original === nueva[4] && t.cuerpo_original === nueva[5] && t.para === nueva[2] && t.cc === nueva[3])) return;
    const sinEditar = t.asunto === t.asunto_original && t.cuerpo === t.cuerpo_original;
    const c = { descripcion: nueva[1], para: nueva[2], cc: nueva[3], asunto_original: nueva[4], cuerpo_original: nueva[5] };
    if (sinEditar) { c.asunto = nueva[4]; c.cuerpo = nueva[5]; actualizadas.push(t.evento); } else { conservadas.push(t.evento); }
    actualizar_(HOJAS.plantillas, t._fila, c);
  });
  if (actualizadas.length) cambios.push('Plantillas actualizadas: ' + actualizadas.join(', '));
  if (conservadas.length) cambios.push('Plantillas editadas por el equipo (se conservó su texto; «Restaurar original» trae el nuevo): ' + conservadas.join(', '));
  const ya = leer_(HOJAS.plantillas).map(t => t.evento);
  const nuevas = PLANTILLAS_INICIALES.filter(t => ya.indexOf(t[0]) < 0);
  anexarVarias_(HOJAS.plantillas, nuevas.map(t => ({
    evento: t[0], descripcion: t[1], para: t[2], cc: t[3], asunto: t[4], cuerpo: t[5], asunto_original: t[4], cuerpo_original: t[5]
  })));
  if (nuevas.length) anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: duenia_(), texto: 'Actualización: plantillas agregadas ' + nuevas.map(t => t[0]).join(', ') });
  if (nuevas.length) cambios.push('Plantillas: ' + nuevas.map(t => t[0]).join(', '));
  return cambios;
}
