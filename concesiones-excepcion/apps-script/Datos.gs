/**
 * Datos.gs · Lectura y escritura de pestañas como tablas (fila 1 = encabezados).
 * Las funciones que terminan en «_» son privadas: el navegador no puede llamarlas con google.script.run.
 */

function propiedad_(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

function libro_() {
  const id = propiedad_('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function hoja_(nombre) {
  const h = libro_().getSheetByName(nombre);
  if (!h) throw new Error('Falta la pestaña «' + nombre + '». Ejecute la instalación.');
  return h;
}

function asegurarHoja_(nombre) {
  const libro = libro_();
  let h = libro.getSheetByName(nombre);
  if (!h) {
    h = libro.insertSheet(nombre);
    const cols = COLUMNAS[nombre];
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#3A4450').setFontColor('#FFFFFF');
    h.setFrozenRows(1);
  }
  return h;
}

/** Devuelve las filas como objetos { encabezado: valor, _fila: n }. */
function leer_(nombre) {
  const h = hoja_(nombre);
  const v = h.getDataRange().getValues();
  if (v.length < 2) return [];
  const enc = v[0].map(String);
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i].every(x => x === '' || x === null)) continue;
    const o = { _fila: i + 1 };
    enc.forEach((k, j) => { if (k) o[k] = v[i][j]; });
    out.push(o);
  }
  return out;
}

function encabezados_(nombre) {
  const h = hoja_(nombre);
  return h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String);
}

function anexar_(nombre, obj) {
  const enc = encabezados_(nombre);
  hoja_(nombre).appendRow(enc.map(k => obj[k] === undefined ? '' : obj[k]));
}

function anexarVarias_(nombre, objs) {
  if (!objs.length) return;
  const enc = encabezados_(nombre);
  const h = hoja_(nombre);
  h.getRange(h.getLastRow() + 1, 1, objs.length, enc.length).setValues(objs.map(o => enc.map(k => o[k] === undefined ? '' : o[k])));
}

function actualizar_(nombre, fila, cambios) {
  const enc = encabezados_(nombre);
  const h = hoja_(nombre);
  Object.keys(cambios).forEach(k => {
    const j = enc.indexOf(k);
    if (j < 0) throw new Error('Columna desconocida «' + k + '» en ' + nombre);
    h.getRange(fila, j + 1).setValue(cambios[k]);
  });
}

function buscarSolicitud_(folio) {
  const s = leer_(HOJAS.solicitudes).find(x => String(x.folio) === String(folio));
  if (!s) throw new Error('No existe la solicitud ' + folio + '.');
  return s;
}

function parametros_() {
  const p = {};
  leer_(HOJAS.parametros).forEach(r => { p[r.clave] = String(r.valor === null ? '' : r.valor).trim(); });
  return p;
}

function feriados_() {
  return leer_(HOJAS.feriados).map(r => {
    const f = r.fecha;
    if (Object.prototype.toString.call(f) === '[object Date]') return Utilities.formatDate(f, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return String(f).trim();
  });
}

/** google.script.run no admite Date: se convierten a texto ISO antes de responder al navegador. */
function serializar_(x) {
  if (Object.prototype.toString.call(x) === '[object Date]') return isNaN(x) ? '' : x.toISOString();
  if (Array.isArray(x)) return x.map(serializar_);
  if (x && typeof x === 'object') {
    const o = {};
    Object.keys(x).forEach(k => { o[k] = serializar_(x[k]); });
    return o;
  }
  return x;
}

/** Busca la columna del Formulario cuyo encabezado comienza con `prefijo` (0-based) o -1. */
function columnaPorPrefijo_(enc, prefijo, exacto) {
  const p = prefijo.toLowerCase();
  return enc.findIndex(e => {
    const t = String(e).trim().toLowerCase();
    return exacto ? t === p : t.indexOf(p) === 0;
  });
}

/** Hoja conectada al Formulario. */
function hojaRespuestas_() {
  const h = libro_().getSheets().find(s => s.getFormUrl());
  if (h) return h;
  const alt = libro_().getSheetByName('Respuestas de formulario 1');
  if (!alt) throw new Error('No se encontró la hoja de respuestas del Formulario.');
  return alt;
}

/** Lee una fila de respuestas como objeto con las claves de RESPUESTA. */
function leerRespuesta_(fila) {
  const h = hojaRespuestas_();
  const enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String);
  const val = h.getRange(fila, 1, 1, enc.length).getValues()[0];
  const o = {};
  Object.keys(RESPUESTA).forEach(k => {
    // «Correo electrónico» no debe confundirse con «Dirección de correo electrónico».
    const j = columnaPorPrefijo_(enc, RESPUESTA[k], false);
    o[k] = j >= 0 ? val[j] : '';
  });
  return o;
}
