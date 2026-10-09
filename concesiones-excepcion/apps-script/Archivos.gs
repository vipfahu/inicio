/**
 * Archivos.gs · Documentos del expediente en el Drive de la cuenta institucional.
 *
 * Estructura:  Plataforma CAE · NO COMPARTIR / Expedientes / AAAA / NN-AAAA /
 * Las carpetas llevan solo el folio (no el nombre del estudiante) y no se comparten con nadie.
 * Los antecedentes que el estudiante sube al Formulario quedan donde los deja Google Forms;
 * en la carpeta del caso se crea un acceso directo para no romper el vínculo con el Formulario.
 */

const CATEGORIAS_ARCHIVO = {
  antecedentes_formulario: 'Antecedentes (formulario)',
  informe_academico: 'Informe académico (Registro Curricular)',
  acta_comite: 'Acta / respuesta del Comité',
  resolucion: 'Resolución',
  archivo_cae: 'Archivo CAE',
  formulario_solicitud: 'Formulario de solicitud (PDF)',
  otro: 'Otro'
};

function carpetaRaiz_() {
  const id = parametros_().carpeta_raiz_id;
  if (!id) throw new Error('Falta la carpeta raíz. Ejecute la instalación.');
  return DriveApp.getFolderById(id);
}

function subcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

/** Carpeta del caso; la crea y la registra si no existe. */
function carpetaCaso_(sol) {
  if (sol.carpeta_id) {
    try { return DriveApp.getFolderById(sol.carpeta_id); } catch (e) { /* se recrea abajo */ }
  }
  const anio = String(sol.folio).split('/')[1] || String(new Date().getFullYear());
  const exp = subcarpeta_(carpetaRaiz_(), 'Expedientes');
  const c = subcarpeta_(subcarpeta_(exp, anio), String(sol.folio).replace('/', '-'));
  actualizar_(HOJAS.solicitudes, sol._fila, { carpeta_id: c.getId() });
  sol.carpeta_id = c.getId();
  return c;
}

/** Ids de Drive presentes en el campo de adjuntos del Formulario («https://drive.google.com/open?id=…», separados por coma). */
function idsDeAdjuntos_(texto) {
  const ids = [];
  String(texto || '').replace(/[?&]id=([\w-]{10,})/g, (m, id) => { ids.push(id); return m; });
  return ids;
}

/** Vincula los antecedentes del Formulario al expediente (acceso directo + registro). */
function vincularAntecedentes_(sol, textoAdjuntos) {
  const carpeta = carpetaCaso_(sol);
  idsDeAdjuntos_(textoAdjuntos).forEach(id => {
    try {
      const f = DriveApp.getFileById(id);
      carpeta.createShortcut(id);
      anexar_(HOJAS.archivos, {
        fecha: new Date(), folio: sol.folio, archivo_id: id, nombre: f.getName(), categoria: 'antecedentes_formulario',
        tamano_mb: Math.round(f.getSize() / 10485.76) / 100, subido_por: 'Formulario'
      });
    } catch (e) {
      anexar_(HOJAS.bitacora, { fecha: new Date(), folio: sol.folio, tipo: 'sistema', quien: 'Sistema', texto: 'ERROR · no se pudo vincular el adjunto ' + id + ': ' + e.message });
    }
  });
}

function archivosDe_(folio) {
  return leer_(HOJAS.archivos).filter(a => String(a.folio) === String(folio));
}

/** Sube un archivo al expediente. El navegador envía el contenido en base64. */
function api_subirArchivo(folio, nombre, mime, base64, categoria) {
  const u = requiere_('edicion');
  const sol = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, sol)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!CATEGORIAS_ARCHIVO[categoria] || categoria === 'antecedentes_formulario' || categoria === 'formulario_solicitud') throw new Error('Categoría no válida.');
  const bytes = Utilities.base64Decode(base64);
  const mb = bytes.length / 1048576;
  const max = Number(parametros_().max_mb_archivo || 20);
  if (mb > max) throw new Error('El archivo pesa ' + mb.toFixed(1) + ' MB; el máximo es ' + max + ' MB.');
  const limpio = String(nombre || 'archivo').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150);
  const f = carpetaCaso_(sol).createFile(Utilities.newBlob(bytes, mime || 'application/octet-stream', limpio));
  anexar_(HOJAS.archivos, {
    fecha: new Date(), folio: folio, archivo_id: f.getId(), nombre: limpio, categoria: categoria,
    tamano_mb: Math.round(mb * 100) / 100, subido_por: u.correo
  });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'archivo', quien: u.correo, texto: 'Archivo agregado: ' + limpio + ' (' + CATEGORIAS_ARCHIVO[categoria] + ')' });
  return { ok: true };
}

/**
 * Descarga a través del panel (el equipo no tiene acceso directo al Drive institucional).
 * Archivos sobre el máximo (p. ej. antecedentes de 100 MB del Formulario): se concede acceso de lectura
 * a ese único archivo a quien lo pide, y queda registrado en la bitácora.
 */
function api_descargarArchivo(folio, archivoId) {
  const u = requiere_('edicion');
  const sol = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, sol)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!archivosDe_(folio).some(a => a.archivo_id === archivoId)) throw new Error('El archivo no pertenece a este expediente.');
  const f = DriveApp.getFileById(archivoId);
  const max = Number(parametros_().max_mb_archivo || 20);
  if (f.getSize() / 1048576 <= max) {
    const b = f.getBlob();
    return { modo: 'descarga', nombre: f.getName(), mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
  }
  if (u.esDuenia) return { modo: 'enlace', url: f.getUrl() };
  f.addViewer(u.correo);
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'archivo', quien: u.correo, texto: 'Acceso de lectura concedido a «' + f.getName() + '» (supera ' + max + ' MB).' });
  return { modo: 'enlace', url: f.getUrl() };
}

/** Apps Script no abre blobs de más de 50 MB: hasta aquí un ZIP se lista y se abre por partes en el servidor. */
const MAX_MB_ZIP = 45;

/**
 * Visor del panel: devuelve el archivo (o una entrada de un ZIP) listo para mostrarse, sin salir de la plataforma.
 * - ZIP sin «entrada»: lista su contenido. Con «entrada» (índice de esa lista): devuelve ese documento.
 * - Word (.doc, .docx, .odt, .rtf): se convierte a PDF en una copia temporal que se borra en el acto.
 * - Archivos sobre el máximo: mismo camino que «Descargar» (acceso de lectura en Drive, registrado en la bitácora).
 */
function api_verArchivo(folio, archivoId, entrada) {
  const u = requiere_('edicion');
  const sol = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, sol)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!archivosDe_(folio).some(a => a.archivo_id === archivoId)) throw new Error('El archivo no pertenece a este expediente.');
  const f = DriveApp.getFileById(archivoId);
  const max = Number(parametros_().max_mb_archivo || 20);
  let nombre = f.getName();
  const esZip = tipoVista(nombre) === 'zip';
  if (f.getSize() / 1048576 > (esZip ? Math.max(max, MAX_MB_ZIP) : max)) return api_descargarArchivo(folio, archivoId);
  let blob = f.getBlob();
  if (esZip) {
    const entradas = Utilities.unzip(blob).filter(b => entradaZipUtil(b.getName()));
    if (entrada === undefined || entrada === null || entrada === '') {
      return { modo: 'zip', nombre: nombre, entradas: entradas.map((b, i) => ({
        i: i, nombre: b.getName(), mb: Math.round(b.getBytes().length / 10485.76) / 100, vista: tipoVista(b.getName()) })) };
    }
    const e = entradas[Number(entrada)];
    if (!e) throw new Error('Ese documento ya no está en el ZIP.');
    nombre = e.getName();
    blob = Utilities.newBlob(e.getBytes(), mimePorNombre(nombre), nombre.split('/').pop());
  }
  const tipo = tipoVista(nombre);
  if (!tipo || tipo === 'zip') throw new Error('Este tipo de archivo no se puede mostrar aquí. Use «Descargar».');
  if (blob.getBytes().length / 1048576 > max) throw new Error('El documento supera ' + max + ' MB; descárguelo para verlo.');
  if (tipo === 'word') {
    const pdf = convertirAPdf_(blob, nombre);
    return { modo: 'ver', tipo: 'pdf', convertido: true, nombre: nombre.split('/').pop().replace(/\.[^.]+$/, '') + '.pdf',
      mime: 'application/pdf', base64: Utilities.base64Encode(pdf.getBytes()) };
  }
  return { modo: 'ver', tipo: tipo, nombre: nombre.split('/').pop(), mime: mimePorNombre(nombre), base64: Utilities.base64Encode(blob.getBytes()) };
}

/**
 * Word → PDF con el servicio avanzado de Drive (appsscript.json): se sube una copia convertida a Documento de Google en la
 * carpeta Temporal, se exporta a PDF y se borra. Si el borrado fallara, la limpieza diaria de Temporal la elimina.
 */
function convertirAPdf_(blob, nombre) {
  if (typeof Drive === 'undefined' || !Drive.Files) throw new Error('Para ver documentos Word falta el servicio avanzado de Drive (ver ACTIVACION.md).');
  const tmp = Drive.Files.create({ name: 'vista-temporal-' + Utilities.getUuid(), mimeType: 'application/vnd.google-apps.document',
    parents: [carpetaTemporal_().getId()] }, blob);
  try {
    return DriveApp.getFileById(tmp.id).getAs('application/pdf');
  } catch (e) {
    throw new Error('No se pudo convertir «' + nombre + '» a PDF: ' + e.message + '. Use «Descargar».');
  } finally {
    try { Drive.Files.remove(tmp.id); } catch (e) { try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (e2) { /* la limpieza diaria lo borra */ } }
  }
}

/* ── PDF del formulario de solicitud: lo que el estudiante envió, para imprimir o tramitar por STD. ── */
function esc_(x) {
  return String(x === null || x === undefined ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function htmlSolicitud_(s, antecedentes, quien) {
  const fila = (et, v) => '<tr><th>' + esc_(et) + '</th><td>' + (v === '' || v === null || v === undefined ? '—' : esc_(v)) + '</td></tr>';
  const tipos = [s.tipo_catalogo, s.tipo_texto_libre ? 'Otro: ' + s.tipo_texto_libre : ''].filter(Boolean).join(' · ');
  const ahora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm');
  return '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:28px}' +
    'h1{font-size:15pt;margin:0 0 2px;color:#00756F} .sub{color:#666;font-size:9.5pt;margin:0 0 14px}' +
    'h2{font-size:11.5pt;margin:18px 0 6px;padding-bottom:3px;border-bottom:1.5px solid #E07B1F}' +
    'table{width:100%;border-collapse:collapse} th{width:34%;text-align:left;vertical-align:top;font-weight:bold;padding:4px 8px 4px 0;color:#444}' +
    'td{padding:4px 0;vertical-align:top} .fund{white-space:pre-wrap;line-height:1.45;text-align:justify}' +
    '.pie{margin-top:26px;border-top:1px solid #ccc;padding-top:6px;color:#777;font-size:8.5pt}' +
    '</style></head><body>' +
    '<h1>Solicitud de Concesión Académica de Excepción (CAE)</h1>' +
    '<p class="sub">Vicedecanato de Investigación y Postgrado · Facultad de Humanidades · Universidad de Santiago de Chile</p>' +
    '<table>' + fila('Folio', s.folio) + fila('Fecha de recepción', fechaCorta_(s.fecha_recepcion)) + '</table>' +
    '<h2>I. Persona solicitante</h2><table>' +
    fila('Apellido paterno', s.apellido1) + fila('Apellido materno', s.apellido2) + fila('Nombres', s.nombres) +
    fila(s.tipo_documento === 'pasaporte' ? 'Pasaporte' : 'RUN', s.run) +
    fila('Cuenta USACH con que envió', s.correo_verificado) + fila('Correo de contacto', s.correo) + fila('Teléfono', s.telefono) + '</table>' +
    '<h2>II. Programa</h2><table>' + fila('Programa', s.programa) + fila('Año', s.anio) + fila('Semestre', s.semestre) + '</table>' +
    '<h2>III. Requerimiento</h2><table>' + fila('Tipo de concesión', tipos) + '</table>' +
    '<h2>IV. Fundamentación</h2><div class="fund">' + (esc_(s.fundamentacion) || '—') + '</div>' +
    '<h2>V. Antecedentes adjuntos</h2>' + (antecedentes.length ? '<ul>' + antecedentes.map(a => '<li>' + esc_(a) + '</li>').join('') + '</ul>' : '<p>Sin antecedentes adjuntos.</p>') +
    '<div class="pie">Documento generado el ' + esc_(ahora) + ' por ' + esc_(quien) + ' desde la plataforma CAE, a partir de los datos registrados en el formulario de solicitud.</div>' +
    '</body></html>';
}
/** Genera el PDF, lo guarda en la carpeta del caso (categoría «Formulario de solicitud (PDF)») y lo deja en la bitácora. */
function generarPdfSolicitud_(s, u, motivo) {
  const antecedentes = archivosDe_(s.folio).filter(a => a.categoria === 'antecedentes_formulario').map(a => a.nombre);
  const nombre = 'Solicitud CAE ' + String(s.folio).replace(/\//g, '-') + ' (formulario).pdf';
  let pdf;
  try {
    pdf = Utilities.newBlob(htmlSolicitud_(s, antecedentes, u.correo), 'text/html', 'solicitud.html').getAs('application/pdf').setName(nombre);
  } catch (e) {
    throw new Error('No se pudo generar el PDF del formulario de solicitud: ' + e.message);
  }
  const f = carpetaCaso_(s).createFile(pdf);
  const mb = Math.round(pdf.getBytes().length / 10485.76) / 100;
  anexar_(HOJAS.archivos, { fecha: new Date(), folio: s.folio, archivo_id: f.getId(), nombre: nombre, categoria: 'formulario_solicitud', tamano_mb: mb, subido_por: u.correo });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: s.folio, tipo: 'archivo', quien: u.correo, texto: 'PDF del formulario de solicitud generado (' + motivo + ').' });
  return { id: f.getId(), nombre: nombre };
}
/** A pedido, desde el expediente (analistas y administración). */
function api_pdfSolicitud(folio) {
  const u = requiere_('edicion');
  const s = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  return generarPdfSolicitud_(s, u, 'a pedido desde el expediente');
}
