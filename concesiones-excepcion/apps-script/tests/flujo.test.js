// Prueba de punta a punta con el simulador: instalación, migración, recepción, tramitación, correos, archivos y permisos.
// Datos sintéticos que imitan los problemas reales de la planilla (folio como fecha, folio duplicado, sin folio,
// tres columnas de estado en conflicto, «En trámite», tipos en texto libre).
const test = require('node:test');
const assert = require('node:assert/strict');
const { fila, preparar, instalar } = require('./escenario');

const tabla = (env, n) => {
  const h = env.libro.getSheetByName(n);
  const [enc, ...filas] = h.getDataRange().getValues();
  return filas.filter(f => f.some(x => x !== '')).map(f => Object.fromEntries(enc.map((k, j) => [k, f[j]])));
};

test('instalación y migración', () => {
  const env = instalar(preparar());
  const s = tabla(env, 'Solicitudes');
  assert.equal(s.length, 6);
  assert.deepEqual(s.map(x => x.folio), ['01/2026', '02/2026', '03/2026', '05/2026', '04/2026', '06/2026']);
  assert.deepEqual(s.map(x => x.estado), ['resuelto', 'no_procede', 'aceptada', 'programa', 'rechazada', 'recibida']);
  assert.deepEqual(s.map(x => x.revisar), ['', '', 'SÍ', 'SÍ', 'SÍ', 'SÍ']);
  assert.equal(s[0].analista, 'analista.uno@usach.cl');
  assert.equal(s[3].semestre, 'Semestre I');
  assert.equal(s[2].tipo_texto_libre, 'Matrícula fuera de plazo');
  // Folio canónico escrito en la columna A de las respuestas
  assert.equal(env.hoja.datos[1][0], '01/2026');
  assert.equal(env.hoja.datos[4][0], '05/2026');
  // Notas antiguas separadas en la bitácora
  const b = tabla(env, 'Bitácora').filter(x => x.folio === '01/2026' && x.tipo === 'nota');
  assert.equal(b.length, 2);
  // Columnas antiguas ocultas (desde «Estado de Presentación»)
  assert.ok(env.hoja.ocultas.includes(16));
  // Disparadores y atajo al adjunto del Formulario
  assert.deepEqual(env.estado.triggers.map(t => t.getHandlerFunction()).sort(), ['alRecibirFormulario', 'tareaDiaria']);
  assert.ok(Object.values(env.estado.carpetas).some(c => c.atajos.includes('adjFormularioUno1234')));
  assert.equal(env.estado.correos.length, 0, 'la migración no debe enviar correos');
});

test('paso 2 exige correos en Cuentas', () => {
  const env = preparar();
  env.estado.usuario = env.estado.duenia;
  env.ctx.instalarPaso1();
  assert.throws(() => env.ctx.instalarPaso2(), /Faltan correos/);
});

test('la instalación solo la ejecuta la cuenta dueña', () => {
  const env = preparar();
  env.estado.usuario = 'intruso@usach.cl';
  assert.throws(() => env.ctx.instalarPaso1(), /cuenta dueña/);
});

test('recepción desde el formulario: folio, analista, correos automáticos', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  hoja.appendRow(fila('', new Date(2026, 9, 7), 7, ['', '', ''], { programa: 'Magíster en Prueba A', analista: '' }).slice(0, 15));
  const r = hoja.getLastRow();
  estado.usuario = '';
  ctx.alRecibirFormulario({ range: hoja.getRange(r, 1) });
  const s = tabla(env, 'Solicitudes').pop();
  assert.equal(s.folio, '07/2026');
  assert.equal(s.estado, 'recibida');
  assert.equal(s.analista, 'analista.uno@usach.cl');
  assert.equal(estado.correos.length, 2);
  assert.equal(estado.correos[0].to, 'est7@usach.cl');
  assert.match(estado.correos[0].subject, /07\/2026/);
  assert.match(estado.correos[0].body, /\?v=seguimiento/);
  assert.equal(estado.correos[0].replyTo, 'analista.uno@usach.cl');
  assert.equal(estado.correos[1].to, 'analista.uno@usach.cl');
  // Idempotente: la misma fila no se procesa dos veces
  ctx.alRecibirFormulario({ range: hoja.getRange(r, 1) });
  assert.equal(tabla(env, 'Solicitudes').length, 7);
  // Desde el panel no se puede invocar (no hay objeto Range)
  assert.throws(() => ctx.alRecibirFormulario({ range: { row: 2 } }), /inválida/);
});

test('permisos: sin cuenta, consulta, edición', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'desconocido@usach.cl';
  assert.equal(ctx.api_inicio().acceso, false);
  assert.throws(() => ctx.api_bandeja(), /SIN_ACCESO/);
  estado.usuario = '';
  assert.throws(() => ctx.api_bandeja(), /SIN_IDENTIDAD/);
  estado.usuario = 'consulta@usach.cl';
  assert.equal(ctx.api_bandeja().length, 6);
  const e = ctx.api_expediente('01/2026');
  assert.equal(e.verDetalle, false);
  assert.equal(e.fundamentacion, undefined);
  assert.equal(e.run, '');
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'revision', {}), /SIN_ACCESO/);
  assert.throws(() => ctx.api_cuentas(), /SIN_ACCESO/);
  estado.usuario = 'analista.uno@usach.cl';
  const e2 = ctx.api_expediente('01/2026');
  assert.equal(e2.verDetalle, true);
  assert.match(e2.fundamentacion, /confidencial/);
  assert.throws(() => ctx.api_cuentas(), /SIN_ACCESO/);
});

test('tramitación: vista previa, campos obligatorios, envío y orden seguro', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'resuelto', {}), /cambió de estado|no permitida/);
  // recibida → revisión: sin correo
  assert.equal(ctx.api_cambiarEstado('06/2026', 'revision', {}).conCorreo, false);
  // revisión → rechazada exige motivo
  const pv = ctx.api_previsualizar('06/2026', 'rechazada', {});
  assert.deepEqual([...pv.requeridos], ['motivo']);
  assert.equal(pv.correo.para[0], 'est6@usach.cl');
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'rechazada', { campos: {} }), /motivo/);
  // si el correo falla, el estado no cambia
  estado.fallaCorreo = true;
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'rechazada', { campos: { motivo: 'Fuera de plazo' } }), /Fallo simulado/);
  assert.equal(tabla(env, 'Solicitudes').find(s => s.folio === '06/2026').estado, 'revision');
  estado.fallaCorreo = false;
  // texto editado por la analista queda registrado
  const c = ctx.api_previsualizar('06/2026', 'rechazada', { motivo: 'Fuera de plazo' }).correo;
  ctx.api_cambiarEstado('06/2026', 'rechazada', { campos: { motivo: 'Fuera de plazo' }, asunto: c.asunto, cuerpo: c.cuerpo + '\nPD: editado' });
  const m = estado.correos.pop();
  assert.match(m.body, /Motivo: Fuera de plazo/);
  assert.match(m.body, /PD: editado/);
  assert.match(m.cc, /dir\d+@usach\.cl/);
  const ultima = tabla(env, 'Bitácora').pop();
  assert.equal(ultima.estado_nuevo, 'rechazada');
  assert.equal(ultima.editado, 'SÍ');
  // devolver al programa desde el V°B° usa la plantilla de devolución y exige observación
  const s = tabla(env, 'Solicitudes').find(x => x.folio === '05/2026');
  assert.equal(s.estado, 'programa');
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger con condiciones' } });
  assert.match(estado.correos.pop().to, /vice@usach\.cl/);
  assert.equal(ctx.api_previsualizar('05/2026', 'programa', {}).evento, 'devolucion');
  ctx.api_cambiarEstado('05/2026', 'programa', { campos: { observacion: 'Precisar condiciones' } });
  const dev = estado.correos.pop();
  assert.match(dev.subject, /observación del Vicedecanato/);
  assert.match(dev.body, /Precisar condiciones/);
});

test('correo a Registro Curricular exige N° STD (variable sin completar bloquea)', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'resolucion', {}), /\{std\}/);
  ctx.api_guardarGestion('05/2026', { n_std: '12345' });
  ctx.api_cambiarEstado('05/2026', 'resolucion', {});
  const m = estado.correos.pop();
  assert.equal(m.to, 'rc@usach.cl');
  assert.match(m.subject, /STD 12345/);
  assert.equal(m.cc, 'est4@usach.cl');
});

test('archivos: subida con límite, adjunto en correo, descarga o acceso puntual', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  const b64 = Buffer.alloc(1024, 1).toString('base64');
  ctx.api_subirArchivo('03/2026', 'informe.pdf', 'application/pdf', b64, 'informe_academico');
  assert.throws(() => ctx.api_subirArchivo('03/2026', 'x.pdf', 'application/pdf', Buffer.alloc(21 * 1048576).toString('base64'), 'otro'), /máximo es 20/);
  assert.throws(() => ctx.api_subirArchivo('03/2026', 'x.pdf', 'application/pdf', b64, 'antecedentes_formulario'), /Categoría/);
  const exp = ctx.api_expediente('03/2026');
  assert.equal(exp.archivos.length, 1);
  ctx.api_cambiarEstado('03/2026', 'informe_rc', {});
  ctx.api_cambiarEstado('03/2026', 'vb_informe', { adjuntos: [exp.archivos[0].id, 'idAjeno'] });
  const m = estado.correos.pop();
  assert.equal(m.attachments.length, 1, 'solo se adjuntan archivos del propio expediente');
  // Antecedentes del Formulario de 90 MB: acceso de lectura puntual, registrado
  const grande = ctx.api_expediente('01/2026').archivos.find(a => /antecedentes/.test(a.nombre));
  const r = ctx.api_descargarArchivo('01/2026', grande.id);
  assert.equal(r.modo, 'enlace');
  assert.deepEqual(estado.archivos.adjFormularioUno1234.viewers, ['analista.uno@usach.cl']);
  assert.throws(() => ctx.api_descargarArchivo('03/2026', grande.id), /no pertenece/);
});

test('cuentas: crear, editar, desactivar con efecto inmediato y salvaguardas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'Nueva@usach.cl', nombre: 'Nueva Analista', rol: 'Analista', nivel: 'edicion', programas: 'Magíster en Prueba A', activo: 'SÍ', recibe_eventos: 'asignacion' }, true);
  assert.throws(() => ctx.api_guardarCuenta({ correo: 'x@gmail.com', nombre: 'X', rol: 'Analista', nivel: 'edicion', activo: 'SÍ' }, true), /usach/);
  assert.throws(() => ctx.api_guardarCuenta({ correo: 'vice@usach.cl', nombre: 'Vice Decano', rol: 'Vicedecano/a', nivel: 'edicion', activo: 'SÍ' }, false), /al menos una/);
  estado.usuario = 'nueva@usach.cl';
  assert.equal(ctx.api_bandeja().length, 6);
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'nueva@usach.cl', nombre: 'Nueva Analista', rol: 'Analista', nivel: 'edicion', programas: 'Otro programa', activo: 'SÍ' }, false);
  estado.usuario = 'nueva@usach.cl';
  assert.equal(ctx.api_bandeja().length, 0, 'el alcance por programa rige en la siguiente llamada');
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'nueva@usach.cl', nombre: 'Nueva Analista', rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'NO' }, false);
  estado.usuario = 'nueva@usach.cl';
  assert.throws(() => ctx.api_bandeja(), /SIN_ACCESO/);
  const reg = tabla(env, 'Bitácora').filter(b => b.tipo === 'cuenta');
  assert.equal(reg.length, 3);
  assert.match(reg[1].texto, /programas: «Magíster en Prueba A» → «Otro programa»/);
});

test('cuentas con recibe_eventos reciben copia; programas sin correo bloquean', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  assert.equal(estado.correos.pop().cc, 'consulta@usach.cl');
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: '', analista: 'analista.uno@usach.cl', activo: 'SÍ' }, false);
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'aceptada', {}), /dirección de «Magíster en Prueba A»/);
});

test('tarea diaria: recordatorios con plazo y aviso de compartición', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.tareaDiaria(), /reservada/);
  // El caso 05/2026 está en «programa» desde la migración (hoy): no corresponde recordatorio aún.
  estado.usuario = '';
  const antes = estado.correos.length;
  ctx.tareaDiaria();
  const recordatorios = estado.correos.slice(antes).filter(m => /Recordatorio/.test(m.subject));
  assert.equal(recordatorios.length, 0);
  const aviso = estado.correos.slice(antes).find(m => /accesos no autorizados/.test(m.subject));
  assert.ok(aviso, 'avisa del editor antiguo con acceso directo');
  assert.match(aviso.body, /editor\.antiguo@usach\.cl/);
  // Simula plazo vencido
  const h = env.libro.getSheetByName('Solicitudes');
  const enc = h.datos[0];
  const f = h.datos.findIndex(r => r[0] === '05/2026');
  h.datos[f][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  const n = estado.correos.length;
  ctx.tareaDiaria();
  const r = estado.correos.slice(n).filter(m => /Recordatorio/.test(m.subject));
  assert.equal(r.length, 1);
  assert.equal(h.datos[f][enc.indexOf('recordatorios')], 1);
  // El mismo aviso de compartición no se repite
  assert.ok(!estado.correos.slice(n).some(m => /accesos no autorizados/.test(m.subject)));
});

test('seguimiento: cada estudiante ve solo lo suyo y sin notas internas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'est1@usach.cl';
  const r = ctx.api_misSolicitudes();
  assert.equal(r.solicitudes.length, 1);
  assert.equal(r.solicitudes[0].folio, '01/2026');
  assert.equal(JSON.stringify(r).indexOf('confidencial'), -1);
  assert.equal(JSON.stringify(r).indexOf('Enviado a RC'), -1);
  estado.usuario = 'otro@usach.cl';
  assert.equal(ctx.api_misSolicitudes().solicitudes.length, 0);
});

test('paso 2 exige el panel publicado (sin enlace de seguimiento no se instala)', () => {
  const env = preparar();
  const url = env.estado.url;
  env.estado.url = '';
  env.estado.usuario = env.estado.duenia;
  env.ctx.instalarPaso1();
  const cu = env.libro.getSheetByName('Cuentas');
  cu.set(2, 1, 'analista.uno@usach.cl');
  cu.appendRow(['vice@usach.cl', 'Vice Decano', 'Vicedecano/a', 'administracion', 'todos', 'SÍ', '', '', '', '']);
  assert.throws(() => env.ctx.instalarPaso2(), /Primero publique el panel/);
  env.estado.url = url;
  env.ctx.instalarPaso2();
  assert.equal(tabla(env, 'Solicitudes').length, 6);
});

test('todo correo al estudiante lleva el enlace de seguimiento', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const plantillas = tabla(env, 'Plantillas');
  plantillas.filter(p => /Estudiante/.test(p.para)).forEach(p => assert.match(p.cuerpo, /\{enlace\}/, p.evento));
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  ctx.api_cambiarEstado('06/2026', 'no_procede', {});
  const m = estado.correos.pop();
  assert.equal(m.to, 'est6@usach.cl');
  assert.match(m.body, /cuenta USACH con que envió el formulario, en: https:\/\/script\.google\.com\/.*\?v=seguimiento/);
});

test('si un correo automático falla, se avisa de inmediato a la analista y a la administración', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  hoja.appendRow(fila('', new Date(2026, 9, 8), 8, ['', '', ''], { analista: '' }).slice(0, 15));
  estado.usuario = '';
  estado.fallaCorreo = m => /est8@usach\.cl/.test(m.to); // falla solo el correo al estudiante
  ctx.alRecibirFormulario({ range: hoja.getRange(hoja.getLastRow(), 1) });
  const aviso = estado.correos.find(m => /no se envió un correo automático/.test(m.subject));
  assert.ok(aviso);
  assert.match(aviso.subject, /07\/2026/);
  assert.match(aviso.to, /analista\.uno@usach\.cl/);
  assert.match(aviso.to, /vice@usach\.cl/);
  assert.match(aviso.to, /institucional@usach\.cl/);
  assert.match(aviso.body, /recepcion/);
  assert.equal(aviso.body.indexOf('Fundamentación'), -1, 'el aviso no incluye datos del expediente');
  // La solicitud quedó registrada y el error en la bitácora
  assert.equal(tabla(env, 'Solicitudes').pop().folio, '07/2026');
  assert.ok(tabla(env, 'Bitácora').some(b => /ERROR · no se envió «recepcion»/.test(b.texto)));
  // La asignación (otro destinatario) sí salió
  assert.ok(estado.correos.some(m => /Nueva solicitud CAE asignada · 07\/2026/.test(m.subject)));
});
