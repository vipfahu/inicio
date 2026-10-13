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
    .addItem('Verificar migración (planilla original ↔ Solicitudes)', 'verificarMigracion')
    .addItem('Realinear filas migradas (tras insertar u ordenar filas)', 'realinearMigracion')
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
    const semN = semestreNormalizado_(sem);
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
    [['analista_rc', 'Analista de Registro Curricular'], ['cuenta_rc', 'Cuenta de Registro Curricular del programa']].forEach(([k, rol]) => {
      const c = String(x[k] || '').toLowerCase();
      if (c && !cuentas.some(y => String(y.correo).toLowerCase() === c && y.rol === rol && esSi(y.activo))) p.push('«' + x.programa + '»: ' + c + ' no es una cuenta activa con rol «' + rol + '» (no recibirá copias).');
    });
  });
  const vd = vicedecano_(cuentas);
  if (vd.activas > 1) p.push('Hay ' + vd.activas + ' cuentas activas con rol «Vicedecano/a»: deje solo una (todas podrían registrar el V°B°).');
  if (vd.activas && !vd.nombre) p.push('La cuenta del Vicedecano/a no tiene nombre en «Cuentas» (los correos que lo citan no saldrán).');
  leer_(HOJAS.programas).filter(x => esSi(x.activo)).forEach(x => {
    if (!x.correo_direccion) p.push('Programa sin correo de dirección: ' + x.programa);
  });
  if (typeof Drive === 'undefined') p.push('Servicio avanzado de Drive no activo: el panel no podrá mostrar documentos Word (ver ACTIVACION.md).');
  const par = parametros_();
  if (!par.enlace_rc || par.enlace_rc === 'COMPLETAR') p.push('Falta «enlace_rc» en Parámetros (lo usa el correo «No procede»).');
  const hs = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  ['alRecibirFormulario', 'tareaDiaria'].forEach(h => { if (hs.indexOf(h) < 0) p.push('Falta el disparador «' + h + '» (ejecute el paso 2).'); });
  if (!urlPanel_()) p.push('El panel aún no está publicado como aplicación web.'); else ok.push('Panel: ' + urlPanel_());
  const fer = actualizarFeriados_(true);
  if (fer.error && !(fer.fechas || []).length) p.push('Feriados: no se pudo leer el calendario de feriados de Chile (' + fer.error + '). Los plazos cuentan solo de lunes a viernes.');
  else if (fer.error) p.push('Feriados: falló la última consulta (' + fer.error + '); se usa la lista guardada.');
  else ok.push('Feriados: ' + fer.fechas.length + ' días (' + fer.anios.join(' y ') + '), desde ' + fer.fuente);
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
  const retirados = leer_(HOJAS.parametros).filter(p => PARAMETROS_RETIRADOS.indexOf(p.clave) >= 0);
  retirados.forEach(p => {
    if (p.clave !== 'vicedecano_nombre' || !String(p.valor || '').trim()) return;
    const vice = leer_(HOJAS.cuentas).find(c => c.rol === 'Vicedecano/a' && esSi(c.activo));
    if (vice && !String(vice.nombre || '').trim()) {
      actualizar_(HOJAS.cuentas, vice._fila, { nombre: String(p.valor).trim() });
      cambios.push('Nombre del Vicedecano/a copiado del parámetro a su cuenta');
    }
  });
  retirados.map(p => p._fila).sort((a, b) => b - a).forEach(f => hoja_(HOJAS.parametros).deleteRow(f));
  if (retirados.length) cambios.push('Parámetros retirados: ' + retirados.map(p => p.clave).join(', '));
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

/* ── Verificación de la migración: cada fila de la hoja de respuestas contra su solicitud en «Solicitudes» ── */

function semestreNormalizado_(sem) {
  sem = String(sem || '').trim();
  return sem === 'Semestre I' || sem === 'Semestre II' ? sem : (/primer|\bI\b/i.test(sem) ? 'Semestre I' : (sem ? 'Semestre II' : ''));
}
function stdNormalizado_(std) {
  std = String(std || '').trim();
  return std === '0' || std === '-' ? '' : std.split('/')[0].trim();
}

/**
 * Compara la planilla original (hoja de respuestas) con «Solicitudes», fila por fila (por `fila_respuesta`).
 * Campos del formulario: deben coincidir. Campos de gestión (estado, analista, N° STD, comentarios, observación, resolución):
 * se compara lo migrado con el valor original, pero pueden haberse editado después en el panel; se marcan como tales.
 */
function verificarMigracion_() {
  const resp = hojaRespuestas_();
  const enc = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0].map(String);
  const n = resp.getLastRow() - 1;
  const datos = n > 0 ? resp.getRange(2, 1, n, enc.length).getValues() : [];
  const col = (pref, exacto) => columnaPorPrefijo_(enc, pref, exacto);
  const J = { pres: col(LEGADO.presentacion), est: col(LEGADO.estado, true), act: col(LEGADO.actual), an: col(LEGADO.analista),
    obs: col(LEGADO.obsVicedecano), com: col(LEGADO.comentarios), std: col(LEGADO.std), ext: col(LEGADO.extras), cae: col(LEGADO.archivoCae), res: col(LEGADO.resolucion) };
  const val = (r, j) => j >= 0 ? r[j] : '';
  const sols = leer_(HOJAS.solicitudes);
  const bit = leer_(HOJAS.bitacora);
  const cuentas = leer_(HOJAS.cuentas);
  const porNombre = {};
  cuentas.forEach(c => { porNombre[String(c.nombre).trim().toLowerCase()] = String(c.correo).trim().toLowerCase(); });
  const porFila = {}, duplicadas = [];
  sols.forEach(s => { const f = Number(s.fila_respuesta); if (!f) return; if (porFila[f]) duplicadas.push(f); porFila[f] = s; });
  const norm = x => String(x === null || x === undefined ? '' : x).trim().toLowerCase().replace(/\s+/g, ' ');
  const fechaTxt = d => d instanceof Date && !isNaN(d) ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(d || '');
  const dif = [];
  const anota = (fila, folio, campo, original, sistema, tipo, nota) => dif.push({ fila: fila, folio: folio, campo: campo, original: String(original === null || original === undefined ? '' : original), sistema: String(sistema === null || sistema === undefined ? '' : sistema), tipo: tipo, nota: nota || '' });
  const cmp = (fila, folio, campo, original, sistema, tipo, nota) => { if (norm(original) !== norm(sistema)) anota(fila, folio, campo, original, sistema, tipo, nota); };
  let filas = 0, migradas = 0;
  datos.forEach((r, i) => {
    if (r.every(x => x === '' || x === null)) return;
    filas++;
    const fila = i + 2;
    const s = porFila[fila];
    const o = {};
    Object.keys(RESPUESTA).forEach(k => { const j = columnaPorPrefijo_(enc, RESPUESTA[k]); o[k] = j >= 0 ? r[j] : ''; });
    if (!s) { anota(fila, normalizarFolio(r[0]), 'solicitud', 'fila con datos', 'sin solicitud asociada', 'formulario', explicarHuerfana_(o, sols, norm, fechaTxt)); return; }
    migradas++;
    const F = s.folio;
    cmp(fila, F, 'folio', normalizarFolio(r[0]), s.folio, 'formulario', r[0] instanceof Date ? 'En la planilla original el folio quedó guardado como fecha.' : '');
    cmp(fila, F, 'fecha_recepcion', fechaTxt(o.marca), fechaTxt(s.fecha_recepcion), 'formulario', o.marca instanceof Date ? '' : 'La marca temporal original no era una fecha; se usó la fecha de la migración.');
    cmp(fila, F, 'correo_verificado', o.correoVerificado, s.correo_verificado, 'formulario');
    cmp(fila, F, 'apellido1', o.apellido1, s.apellido1, 'formulario');
    cmp(fila, F, 'apellido2', o.apellido2, s.apellido2, 'formulario');
    cmp(fila, F, 'nombres', o.nombres, s.nombres, 'formulario');
    cmp(fila, F, 'run', o.run, s.run, 'formulario');
    cmp(fila, F, 'correo', o.correo || o.correoVerificado, s.correo, 'formulario');
    cmp(fila, F, 'telefono', o.telefono, s.telefono, 'formulario');
    cmp(fila, F, 'programa', o.programa, s.programa, 'formulario');
    cmp(fila, F, 'anio', o.anio, s.anio, 'formulario');
    cmp(fila, F, 'semestre', semestreNormalizado_(o.semestre), s.semestre, 'formulario', norm(o.semestre) !== norm(semestreNormalizado_(o.semestre)) ? 'Original: «' + o.semestre + '» (normalizado).' : '');
    const t = separarTipos(o.tipos);
    cmp(fila, F, 'tipo_catalogo', t.catalogo, s.tipo_catalogo, 'formulario');
    cmp(fila, F, 'tipo_texto_libre', t.libre, s.tipo_texto_libre, 'formulario');
    if (String(s.fundamentacion || '').trim()) cmp(fila, F, 'fundamentacion', o.fundamentacion, s.fundamentacion, 'formulario');
    else if (!String(o.fundamentacion || '').trim()) anota(fila, F, 'fundamentacion', '(vacía)', '(se lee de esta fila)', 'formulario', 'La fila original no tiene fundamentación.');
    // Gestión: lo migrado pudo editarse después en el panel.
    const nombreAn = String(val(r, J.an) || '').trim();
    cmp(fila, F, 'analista', nombreAn ? (porNombre[nombreAn.toLowerCase()] || '(sin cuenta: ' + nombreAn + ')') : '', s.analista, 'gestión', 'Editable en el panel.');
    cmp(fila, F, 'n_std', stdNormalizado_(val(r, J.std)), s.n_std, 'gestión', 'Editable en el panel. Original: «' + val(r, J.std) + '».');
    cmp(fila, F, 'comentarios_analista', val(r, J.com), s.comentarios_analista, 'gestión', 'Editable en el panel.');
    cmp(fila, F, 'obs_vicedecano', val(r, J.obs), s.obs_vicedecano, 'gestión', 'Editable en el panel.');
    cmp(fila, F, 'resolucion', [val(r, J.res), val(r, J.cae)].filter(x => String(x || '').trim()).join(' · '), s.resolucion, 'gestión', 'Editable en el panel.');
    const comentarios = [val(r, J.com), val(r, J.ext)].join(' ');
    const m = estadoMigrado(val(r, J.pres), val(r, J.est), val(r, J.act), comentarios);
    const deFolio = bit.filter(b => String(b.folio) === String(F) && b.tipo === 'estado' && b.estado_nuevo);
    const entradaMig = deFolio.find(b => /migra/i.test(String(b.quien)) || /migrad/i.test(String(b.texto)));
    // Sin entrada de migración: si el caso no se ha movido desde entonces, su estado actual es el migrado.
    const migrado = entradaMig ? entradaMig.estado_nuevo : (deFolio.every(b => b.estado_nuevo === 'recibida') ? s.estado : 'recibida');
    const crudo = [val(r, J.act), val(r, J.est), val(r, J.pres)].map(x => String(x || '').trim()).find(x => x) || '(vacío)';
    cmp(fila, F, 'estado migrado', m.estado, migrado, 'gestión', 'Original: «' + crudo + '». Estado actual en el sistema: ' + s.estado + '.');
  });
  // Solicitudes que apuntan a filas inexistentes o repetidas
  sols.forEach(s => {
    const f = Number(s.fila_respuesta);
    if (f && (f < 2 || f > datos.length + 1 || datos[f - 2].every(x => x === '' || x === null))) anota(f, s.folio, 'fila_respuesta', '(fila vacía o inexistente)', f, 'formulario', 'La solicitud apunta a una fila sin datos: ¿se borraron filas en la hoja de respuestas?');
  });
  duplicadas.forEach(f => anota(f, (porFila[f] || {}).folio, 'fila_respuesta', '', f, 'formulario', 'Más de una solicitud apunta a la misma fila.'));
  const formulario = dif.filter(d => d.tipo === 'formulario').length;
  return {
    resumen: { filas: filas, solicitudes: sols.length, migradas: migradas, nuevas: sols.filter(s => !Number(s.fila_respuesta)).length,
      diferencias: dif.length, formulario: formulario, gestion: dif.length - formulario, fecha: new Date() },
    diferencias: dif
  };
}

/**
 * Explica una fila de la hoja de respuestas que no tiene solicitud: cuándo se envió y si coincide con alguna solicitud
 * (mismo correo verificado o mismos apellidos y nombres), para distinguir un envío repetido del mismo estudiante de una
 * respuesta que llegó después de la migración o de una fila que nunca se importó.
 */
function explicarHuerfana_(o, sols, norm, fechaTxt) {
  const correo = norm(o.correoVerificado), nombre = norm(o.apellido1) + '|' + norm(o.nombres);
  const parecidas = sols.filter(s => (correo && norm(s.correo_verificado) === correo) || (nombre !== '|' && norm(s.apellido1) + '|' + norm(s.nombres) === nombre));
  const envio = o.marca instanceof Date && !isNaN(o.marca) ? 'Enviada el ' + fechaTxt(o.marca) + '. ' : 'Marca temporal no válida. ';
  if (!parecidas.length) return envio + 'Ningún folio coincide por correo ni por nombre: ¿llegó después de la migración o nunca se importó?';
  return envio + 'Mismo estudiante que ' + parecidas.map(s => s.folio + (Number(s.fila_respuesta) ? ' (fila ' + s.fila_respuesta : ' (formulario web') + ', ' + s.estado + ')').join(', ') +
    ': ¿envío repetido o solicitud distinta (otro año, semestre o tipo)?';
}

const HOJA_VERIFICACION = 'Verificación migración';
/** Deja el detalle en una hoja (se reemplaza en cada ejecución). */
function escribirVerificacion_(v) {
  const libro = libro_();
  const previa = libro.getSheetByName(HOJA_VERIFICACION);
  if (previa) libro.deleteSheet(previa);
  const h = libro.insertSheet(HOJA_VERIFICACION);
  const enc = ['fila_respuesta', 'folio', 'campo', 'planilla original', 'sistema', 'tipo', 'nota'];
  const filas = [enc].concat(v.diferencias.map(d => [d.fila, d.folio, d.campo, d.original, d.sistema, d.tipo, d.nota]));
  if (!v.diferencias.length) filas.push(['', '', 'Sin diferencias', '', '', '', 'Verificado el ' + Utilities.formatDate(v.resumen.fecha, Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm')]);
  h.getRange(1, 1, filas.length, enc.length).setValues(filas);
  h.getRange(1, 1, 1, enc.length).setFontWeight('bold').setBackground('#3A4450').setFontColor('#FFFFFF');
  h.setFrozenRows(1);
  return h;
}

/** Menú CAE (cuenta dueña): verifica y deja el detalle en la hoja «Verificación migración». */
function verificarMigracion() {
  soloDuenia_();
  const v = verificarMigracion_();
  escribirVerificacion_(v);
  const r = v.resumen;
  avisar_('Verificación de la migración', r.filas + ' filas con datos en la hoja de respuestas · ' + r.migradas + ' con solicitud · ' + r.nuevas + ' solicitudes del formulario web.\n' +
    r.diferencias + ' diferencia(s): ' + r.formulario + ' en datos del formulario, ' + r.gestion + ' en datos de gestión (pueden haberse editado en el panel).\nDetalle en la hoja «' + HOJA_VERIFICACION + '».');
}

/**
 * Realinea `fila_respuesta` cuando en la hoja de respuestas se insertaron, borraron u ordenaron filas después de la migración.
 * Para cada solicitud migrada busca su fila por identidad (correo verificado; si no, apellidos + nombres); solo cambia cuando la
 * coincidencia es única. No crea ni borra solicitudes: las filas sin solicitud se informan.
 */
function realinearMigracion_(u) {
  const resp = hojaRespuestas_();
  const enc = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0].map(String);
  const n = resp.getLastRow() - 1;
  const datos = n > 0 ? resp.getRange(2, 1, n, enc.length).getValues() : [];
  const jCorreo = columnaPorPrefijo_(enc, RESPUESTA.correoVerificado), jA1 = columnaPorPrefijo_(enc, RESPUESTA.apellido1),
    jA2 = columnaPorPrefijo_(enc, RESPUESTA.apellido2), jN = columnaPorPrefijo_(enc, RESPUESTA.nombres);
  const norm = x => String(x === null || x === undefined ? '' : x).trim().toLowerCase().replace(/\s+/g, ' ');
  const porCorreo = {}, porNombre = {};
  datos.forEach((r, i) => {
    if (r.every(x => x === '' || x === null)) return;
    const fila = i + 2;
    const c = norm(r[jCorreo]); if (c) (porCorreo[c] = porCorreo[c] || []).push(fila);
    const k = norm(r[jA1]) + '|' + norm(r[jA2]) + '|' + norm(r[jN]); if (k !== '||') (porNombre[k] = porNombre[k] || []).push(fila);
  });
  const coincide = (fila, s) => {
    const r = datos[fila - 2]; if (!r) return false;
    return (norm(r[jCorreo]) && norm(r[jCorreo]) === norm(s.correo_verificado)) || (norm(r[jA1]) === norm(s.apellido1) && norm(r[jN]) === norm(s.nombres));
  };
  const sols = leer_(HOJAS.solicitudes).filter(s => Number(s.fila_respuesta));
  const cambios = [], pendientes = [];
  let sinCambio = 0;
  const ocupadas = {};
  sols.forEach(s => { if (coincide(Number(s.fila_respuesta), s)) ocupadas[Number(s.fila_respuesta)] = s.folio; });
  sols.forEach(s => {
    const actual = Number(s.fila_respuesta);
    if (coincide(actual, s)) { sinCambio++; return; }
    let cand = porCorreo[norm(s.correo_verificado)] || [];
    if (cand.length !== 1) cand = porNombre[norm(s.apellido1) + '|' + norm(s.apellido2) + '|' + norm(s.nombres)] || [];
    cand = cand.filter(f => !ocupadas[f]);
    if (cand.length !== 1) { pendientes.push({ folio: s.folio, fila: actual, motivo: cand.length ? 'más de una fila coincide' : 'ninguna fila coincide por correo ni por nombre' }); return; }
    actualizar_(HOJAS.solicitudes, s._fila, { fila_respuesta: cand[0], actualizado: new Date() });
    ocupadas[cand[0]] = s.folio;
    cambios.push({ folio: s.folio, de: actual, a: cand[0] });
    anexar_(HOJAS.bitacora, { fecha: new Date(), folio: s.folio, tipo: 'sistema', quien: u, texto: 'Fila de origen realineada: ' + actual + ' → ' + cand[0] + ' (la hoja de respuestas cambió de orden).' });
  });
  const asignadas = {}; leer_(HOJAS.solicitudes).forEach(s => { if (Number(s.fila_respuesta)) asignadas[Number(s.fila_respuesta)] = true; });
  const sinSolicitud = [];
  datos.forEach((r, i) => { if (!r.every(x => x === '' || x === null) && !asignadas[i + 2]) sinSolicitud.push(i + 2); });
  return { realineadas: cambios, sinCambio: sinCambio, pendientes: pendientes, filasSinSolicitud: sinSolicitud };
}

/** Menú CAE (cuenta dueña). */
function realinearMigracion() {
  soloDuenia_();
  const r = realinearMigracion_(duenia_());
  avisar_('Realineación de filas migradas', r.realineadas.length + ' solicitud(es) realineada(s) · ' + r.sinCambio + ' ya correctas · ' + r.pendientes.length + ' sin resolver' +
    (r.pendientes.length ? ' (' + r.pendientes.map(p => p.folio + ': ' + p.motivo).join('; ') + ')' : '') +
    '\nFilas de la hoja de respuestas sin solicitud en el sistema: ' + (r.filasSinSolicitud.join(', ') || 'ninguna') + '.\nEjecute «Verificar migración» para comprobar.');
}
