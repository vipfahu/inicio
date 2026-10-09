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
  assert.equal(estado.correos.length, 3);
  assert.equal(estado.correos[0].to, 'est7@usach.cl');
  assert.match(estado.correos[0].subject, /07\/2026/);
  assert.match(estado.correos[0].body, /\?v=seguimiento/);
  assert.equal(estado.correos[0].replyTo, 'analista.uno@usach.cl');
  // Aviso al equipo: Vicedecano/a + todas las analistas con cuenta activa
  assert.match(estado.correos[1].subject, /Nueva solicitud CAE · 07\/2026/);
  assert.equal(estado.correos[1].to, 'analista.uno@usach.cl,vice@usach.cl,consulta@usach.cl', 'todas las cuentas con acceso al panel; no Registro Curricular (sin acceso)');
  assert.match(estado.correos[1].body, /Analista: Analista Uno/);
  // Aviso de asignación a la analista asignada
  assert.equal(estado.correos[2].to, 'analista.uno@usach.cl');
  assert.match(estado.correos[2].subject, /asignada/);
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
  // devolver al programa (vía STD) desde el V°B°: sin correo, pero exige y guarda la observación
  const s = tabla(env, 'Solicitudes').find(x => x.folio === '05/2026');
  assert.equal(s.estado, 'programa');
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger con condiciones' } });
  assert.match(estado.correos.pop().to, /vice@usach\.cl/);
  estado.usuario = 'vice@usach.cl'; // el V°B° (también la devolución) lo registra el Vicedecano/a
  const pvDev = ctx.api_previsualizar('05/2026', 'programa', {});
  assert.equal(pvDev.conCorreo, false);
  assert.deepEqual([...pvDev.requeridos], ['observacion']);
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'programa', { campos: {} }), /observacion/);
  const enviados = estado.correos.length;
  assert.equal(ctx.api_cambiarEstado('05/2026', 'programa', { campos: { observacion: 'Precisar condiciones' } }).conCorreo, false);
  assert.equal(estado.correos.length, enviados, 'la devolución va por STD: no sale correo');
  const s2 = tabla(env, 'Solicitudes').find(x => x.folio === '05/2026');
  assert.equal(s2.estado, 'programa');
  assert.equal(s2.obs_vicedecano, 'Precisar condiciones');
  assert.match(tabla(env, 'Bitácora').pop().texto, /Observación: Precisar condiciones/);
});

test('informe → programa: la analista registra la solicitud vía STD, sin correo, y el estudiante la ve', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  // Sin N° STD registrado no se pasa a Informe de Registro Curricular.
  assert.throws(() => ctx.api_cambiarEstado('03/2026', 'informe_rc', {}), /registre el N° STD/);
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '03/2026').estado, 'aceptada');
  ctx.api_guardarGestion('03/2026', { n_std: 'STD-2026-0099' });
  const r = ctx.api_cambiarEstado('03/2026', 'informe_rc', {});
  // Antes de Informe RC se genera el PDF del formulario y queda en el expediente, ofrecido para descarga.
  assert.match(r.pdfSolicitud.nombre, /^Solicitud CAE 03-2026 \(formulario\)\.pdf$/);
  const fpdf = ctx.api_expediente('03/2026').archivos.find(a => a.id === r.pdfSolicitud.id);
  assert.equal(fpdf.categoria, 'Formulario de solicitud (PDF)');
  const html = estado.pdfs[estado.pdfs.length - 1];
  assert.match(html, /Solicitud de Concesión Académica de Excepción/);
  assert.match(html, /Folio<\/th><td>03\/2026/);
  assert.match(html, /IV\. Fundamentación/);
  assert.match(html, /generado el .* por analista\.uno@usach\.cl/);
  assert.ok(tabla(env, 'Bitácora').some(b => b.folio === '03/2026' && /PDF del formulario de solicitud generado \(automático/.test(b.texto)));
  const pv = ctx.api_previsualizar('03/2026', 'programa', {});
  assert.equal(pv.conCorreo, false);
  assert.match(pv.haciaEtiqueta, /vía STD/);
  const antes = estado.correos.length;
  assert.equal(ctx.api_cambiarEstado('03/2026', 'programa', {}).conCorreo, false);
  assert.equal(estado.correos.length, antes, 'no se notifica a nadie');
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '03/2026').estado, 'programa');
  const b = tabla(env, 'Bitácora').pop();
  assert.equal(b.estado_nuevo, 'programa');
  assert.equal(b.evento, '');
});

test('resolución: CAE admisible y CAE rechazada notifican al estudiante; el cierre no envía correo', () => {
  for (const [folio, hacia, etiqueta, frase] of [['05/2026', 'resolucion', /CAE admisible/, /ha sido declarada admisible/], ['05/2026', 'rechazo_vb', /CAE rechazada/, /no ha sido acogida/]]) {
    const env = instalar(preparar());
    const { ctx, estado } = env;
    estado.usuario = 'analista.uno@usach.cl';
    ctx.api_cambiarEstado(folio, 'vb', { campos: { propuesta_comite: 'Propuesta' } });
    estado.usuario = 'vice@usach.cl';
    const pv = ctx.api_previsualizar(folio, hacia, {});
    assert.equal(pv.conCorreo, true);
    assert.deepEqual([...pv.requeridos], []);
    assert.match(pv.haciaEtiqueta, etiqueta);
    assert.match(pv.haciaEtiqueta, /resolución en tramitación/);
    const previo = estado.correos.length;
    ctx.api_cambiarEstado(folio, hacia, {});
    const enviados = estado.correos.slice(previo);
    assert.equal(enviados.length, 1, 'un correo, solo al estudiante (no a Registro Curricular)');
    assert.equal(enviados[0].to, 'est4@usach.cl');
    assert.match(enviados[0].subject, etiqueta);
    assert.match(enviados[0].body, frase);
    assert.match(enviados[0].body, /resolución correspondiente se encuentra en elaboración, para su distribución desde la Unidad de Registro Curricular/);
    const antes = estado.correos.length;
    // El estudiante ve el nuevo estado en su seguimiento
    estado.usuario = 'est4@usach.cl';
    const mis = ctx.api_misSolicitudes().solicitudes.find(x => x.folio === folio);
    assert.equal(mis.estado, hacia);
    assert.ok(mis.hitos.some(h => h.estado === hacia));
    // Cierre: se anota la resolución de Registro Curricular, sin correo
    estado.usuario = 'analista.uno@usach.cl';
    const pvc = ctx.api_previsualizar(folio, 'negado', {});
    assert.equal(pvc.conCorreo, false);
    assert.deepEqual([...pvc.requeridos], ['resolucion']);
    // Se puede cargar el archivo de la resolución (categoría «Resolución») antes de cerrar
    ctx.api_subirArchivo(folio, 'resolucion.pdf', 'application/pdf', Buffer.from('%PDF').toString('base64'), 'resolucion');
    ctx.api_cambiarEstado(folio, 'negado', { campos: { resolucion: 'Res. 123 del 01-11-2026' } });
    assert.ok(ctx.api_expediente(folio).archivos.some(a => a.nombre === 'resolucion.pdf' && a.categoria === 'Resolución'));
    assert.equal(estado.correos.length, antes);
    assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === folio).resolucion, 'Res. 123 del 01-11-2026');
  }
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
  assert.throws(() => ctx.api_subirArchivo('03/2026', 'x.pdf', 'application/pdf', b64, 'formulario_solicitud'), /Categoría/, 'ese PDF lo genera la plataforma');
  ctx.api_guardarGestion('03/2026', { n_std: 'STD-1' });
  ctx.api_cambiarEstado('03/2026', 'informe_rc', {});
  ctx.api_cambiarEstado('03/2026', 'programa', {});
  ctx.api_cambiarEstado('03/2026', 'vb', { campos: { propuesta_comite: 'Acoger' }, adjuntos: [exp.archivos[0].id, 'idAjeno'] });
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

test('cuentas con recibe_eventos reciben copia; sin correo de dirección, el correo al estudiante sale igual', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  assert.equal(estado.correos.pop().cc, 'consulta@usach.cl');
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: '', analista: 'analista.uno@usach.cl', activo: 'SÍ' }, false);
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  const pv = ctx.api_previsualizar('06/2026', 'aceptada', {});
  assert.deepEqual([...pv.correo.faltantes], []);
  assert.match(pv.correo.omitidos[0], /dirección de «Magíster en Prueba A»/);
  ctx.api_cambiarEstado('06/2026', 'aceptada', {});
  const m = estado.correos.pop();
  assert.match(m.to, /est6@usach\.cl/);
  assert.ok(!m.cc, 'sale sin la copia a la dirección de programa');
  assert.match(m.body, /por especial encargo de Vice Decano, Vicedecano/, 'nombre sin grado → «de»');
  // Con grado en el nombre de la cuenta → «del».
  const cu = env.libro.getSheetByName('Cuentas');
  const fv = cu.datos.findIndex(r => r[0] === 'vice@usach.cl');
  cu.datos[fv][1] = 'Dr. Vice Decano';
  const sol = tabla(env, 'Solicitudes').find(x => x.folio === '06/2026');
  assert.match(ctx.componer_('aceptada', sol, {}).cuerpo, /por especial encargo del Dr\. Vice Decano, Vicedecano/);
  cu.datos[fv][1] = 'Dra. Vice Decana';
  assert.match(ctx.componer_('cae_admisible', sol, {}).cuerpo, /por especial encargo de la Dra\. Vice Decana, /);
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '06/2026').estado, 'aceptada');
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
  assert.equal(recordatorios.length, 0, 'los plazos corren desde la migración (hoy)');
  const aviso = estado.correos.slice(antes).find(m => /accesos no autorizados/.test(m.subject));
  assert.ok(aviso, 'avisa del editor antiguo con acceso directo');
  assert.match(aviso.body, /editor\.antiguo@usach\.cl/);
  // Simula plazo vencido
  const h = env.libro.getSheetByName('Solicitudes');
  const enc = h.datos[0];
  const f = h.datos.findIndex(r => r[0] === '05/2026');
  h.datos[f][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  const g = h.datos.findIndex(r => r[0] === '06/2026'); // «Recibida», sin analista
  h.datos[g][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  const n = estado.correos.length;
  ctx.tareaDiaria();
  const r = estado.correos.slice(n).filter(m => /Recordatorio · Solicitud CAE 05/.test(m.subject));
  assert.equal(r.length, 1);
  const adm = estado.correos.slice(n).filter(m => /06\/2026 · admisibilidad pendiente/.test(m.subject));
  assert.equal(adm.length, 1, 'recordatorio de admisibilidad del caso sin revisión');
  assert.match(adm[0].body, /asignar analista y abrir la revisión/);
  assert.match(adm[0].to, /analista\.uno@usach\.cl/);
  assert.ok(!/est6@usach\.cl/.test(adm[0].to + (adm[0].cc || '')), 'es interno: no se escribe al estudiante');
  assert.equal(h.datos[g][enc.indexOf('recordatorios')], 1);
  // Al asignar analista, el contador se reinicia para que ella reciba sus propios recordatorios
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_guardarGestion('06/2026', { analista: 'analista.uno@usach.cl' });
  assert.equal(Number(h.datos[g][enc.indexOf('recordatorios')]), 0);
  estado.usuario = '';
  assert.match(r[0].to, /^dir\d+@usach\.cl$/, 'el recordatorio va a la dirección de programa');
  assert.equal(r[0].cc, 'analista.uno@usach.cl', 'con copia a la analista del caso');
  assert.match(r[0].body, /Estimado\/a Director\/a/);
  assert.match(r[0].body, /a través del Sistema de Trazabilidad Documental \(STD\)/);
  assert.match(r[0].body, /El plazo de 2 días hábiles para responder venció el \S+\./);
  assert.equal(r[0].replyTo, 'analista.uno@usach.cl', 'las respuestas llegan a la analista');
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

test('nueva solicitud sin analista en el programa: aviso al equipo, sin asignación; reasignar envía aviso', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja, libro } = env;
  // Una segunda analista con cuenta y el programa sin analista asignada
  libro.getSheetByName('Cuentas').appendRow(['analista.dos@usach.cl', 'Analista Dos', 'Analista', 'edicion', 'todos', 'SÍ', '', '', '', '']);
  libro.getSheetByName('Cuentas').appendRow(['analista.tres@usach.cl', 'Analista Tres', 'Analista', 'edicion', 'todos', 'NO', '', '', '', '']);
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: '', activo: 'SÍ' }, false);
  hoja.appendRow(fila('', new Date(2026, 9, 9), 9, ['', '', ''], { analista: '' }).slice(0, 15));
  estado.usuario = '';
  const n = estado.correos.length;
  ctx.alRecibirFormulario({ range: hoja.getRange(hoja.getLastRow(), 1) });
  const nuevos = estado.correos.slice(n);
  assert.equal(nuevos.length, 2, 'recepción + aviso al equipo, sin asignación');
  const equipo = nuevos.find(m => /Nueva solicitud CAE/.test(m.subject));
  assert.equal(equipo.to, 'analista.uno@usach.cl,vice@usach.cl,consulta@usach.cl,analista.dos@usach.cl', 'sin la cuenta inactiva ni Registro Curricular');
  assert.match(equipo.body, /sin asignar \(asígnela desde el expediente\)/);
  const s = tabla(env, 'Solicitudes').pop();
  assert.equal(s.analista, '');
  // Asignar desde el panel envía el aviso a la analista asignada
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_guardarGestion(s.folio, { analista: 'analista.dos@usach.cl' });
  const m = estado.correos.pop();
  assert.equal(m.to, 'analista.dos@usach.cl');
  assert.match(m.subject, /asignada · 07\/2026/);
  // No se puede asignar a una cuenta inactiva ni a quien no es Analista
  assert.throws(() => ctx.api_guardarGestion(s.folio, { analista: 'analista.tres@usach.cl' }), /rol Analista/);
  assert.throws(() => ctx.api_guardarGestion(s.folio, { analista: 'vice@usach.cl' }), /rol Analista/);
});

test('asignación automática solo hacia cuentas activas con rol Analista', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'sin.cuenta@usach.cl', activo: 'SÍ' }, false);
  hoja.appendRow(fila('', new Date(2026, 9, 9), 9, ['', '', ''], { analista: '' }).slice(0, 15));
  estado.usuario = '';
  ctx.alRecibirFormulario({ range: hoja.getRange(hoja.getLastRow(), 1) });
  assert.equal(tabla(env, 'Solicitudes').pop().analista, '');
  assert.ok(!estado.correos.some(m => m.to === 'sin.cuenta@usach.cl'));
  assert.ok(tabla(env, 'Bitácora').some(b => /sin\.cuenta@usach\.cl.*no tiene una cuenta activa/.test(b.texto)));
});

test('actualizar instalación agrega plantillas nuevas sin tocar las editadas', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const h = libro.getSheetByName('Plantillas');
  const i = h.datos.findIndex(r => r[0] === 'nueva_solicitud');
  h.datos.splice(i, 1); // instalación anterior, sin la plantilla nueva
  const j = h.datos.findIndex(r => r[0] === 'recepcion');
  h.datos[j][5] = 'Texto editado por el equipo {enlace}';
  estado.usuario = estado.duenia;
  ctx.actualizarInstalacion();
  assert.ok(tabla(env, 'Plantillas').some(t => t.evento === 'nueva_solicitud'));
  assert.equal(tabla(env, 'Plantillas').find(t => t.evento === 'recepcion').cuerpo, 'Texto editado por el equipo {enlace}');
});

test('código nuevo: la planilla se actualiza sola, una sola vez, y repara estados que ya no existen', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const h = libro.getSheetByName('Plantillas');
  h.appendRow(['decision', 'obsoleta', 'Analista', '', 'a', 'b', 'a', 'b', '', '']);
  const sh = libro.getSheetByName('Solicitudes');
  const enc = sh.datos[0];
  sh.datos[2][enc.indexOf('estado')] = 'autorizada';
  sh.datos[3][enc.indexOf('estado')] = 'vb_informe';
  delete estado.props.huella_estructura; // como si se acabara de subir código nuevo
  ctx.actualizarSiCorresponde_();
  assert.ok(!h.datos.some(r => r[0] === 'decision'), 'retira plantillas que el flujo vigente no usa');
  assert.ok(!h.datos.some(r => ['vb_informe', 'programa', 'devolucion'].indexOf(r[0]) >= 0), 'el programa va por STD: sin plantillas de correo');
  assert.equal(sh.datos[2][enc.indexOf('estado')], 'vb');
  assert.equal(sh.datos[3][enc.indexOf('estado')], 'informe_rc', 'un caso esperando V°B° al informe queda listo para registrar el envío al programa');
  assert.equal(sh.datos[2][enc.indexOf('revisar')], 'SÍ');
  const n = () => tabla(env, 'Bitácora').filter(b => /Actualización automática/.test(b.texto)).length;
  assert.equal(n(), 1);
  ctx.actualizarSiCorresponde_();
  assert.equal(n(), 1);
});

test('feriados automáticos: oficial primero, respaldo, caché y sin carga manual', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const anio = new Date().getFullYear();
  const d = (m, dia) => new Date(Date.UTC(anio, m - 1, dia));
  // Sin calendario disponible: lista vacía (lunes a viernes) y queda constancia del error
  estado.fallaCalendario = true;
  assert.deepEqual([...ctx.feriados_()], []);
  assert.match(ctx.cacheFeriados_().error, /no disponible/);
  // Solo el calendario general (con conmemoraciones): se filtran
  estado.fallaCalendario = false;
  estado.calendarios = { 'es.cl#holiday@group.v.calendar.google.com': [
    { inicio: d(9, 18), fin: d(9, 19), titulo: 'Fiestas Patrias', descripcion: 'Feriado público' },
    { inicio: d(5, 10), fin: d(5, 11), titulo: 'Día de la Madre', descripcion: 'Celebración' }
  ] };
  let c = ctx.actualizarFeriados_(true);
  assert.deepEqual([...c.fechas], [anio + '-09-18']);
  assert.equal(c.fuente, 'es.cl#holiday@group.v.calendar.google.com');
  // Si existe el oficial, se prefiere
  estado.calendarios['es.cl.official#holiday@group.v.calendar.google.com'] = [{ inicio: d(1, 1), fin: d(1, 2), titulo: 'Año Nuevo' }];
  c = ctx.actualizarFeriados_(true);
  assert.equal(c.fuente, 'es.cl.official#holiday@group.v.calendar.google.com');
  // Reciente: no vuelve a consultar
  estado.fallaCalendario = true;
  assert.equal(ctx.actualizarFeriados_(false).fuente, 'es.cl.official#holiday@group.v.calendar.google.com');
  // Falla al forzar: conserva la lista anterior y anota el error
  c = ctx.actualizarFeriados_(true);
  assert.deepEqual([...c.fechas], [anio + '-01-01']);
  assert.ok(c.error);
  // Configuración lo muestra (solo lectura)
  estado.usuario = 'vice@usach.cl';
  const cfg = ctx.api_config();
  assert.equal(cfg.feriados.total, 1);
  assert.ok(cfg.feriados.error);
});

test('correos se leen bien con y sin analista asignada', () => {
  const env = instalar(preparar());
  const { ctx } = env;
  const base = tabla(env, 'Solicitudes').find(s => s.folio === '06/2026');
  const con = Object.assign({}, base, { analista: 'analista.uno@usach.cl', estado: 'programa', estado_desde: new Date(2026, 9, 1) });
  const sin = Object.assign({}, con, { analista: '' });
  const nombre = ctx.nombreDe_('analista.uno@usach.cl', tabla(env, 'Cuentas'));

  const a1 = ctx.componer_('aceptada', con).cuerpo;
  assert.match(a1, new RegExp('La analista a cargo, ' + nombre + ', podrá contactarle'));
  assert.match(a1, new RegExp('Atentamente,\\n' + nombre + '\\nVicedecanato de Investigación y Postgrado · FAHU$'));
  const a2 = ctx.componer_('aceptada', sin).cuerpo;
  assert.match(a2, /El equipo del Vicedecanato podrá contactarle/);
  assert.doesNotMatch(a2, /analista a cargo/);
  assert.match(a2, /Atentamente,\nVicedecanato de Investigación y Postgrado · FAHU$/);

  assert.match(ctx.componer_('recordatorio', con).cuerpo, new RegExp('llegará a la analista a cargo, ' + nombre + '\\.'));
  assert.match(ctx.componer_('recordatorio', sin).cuerpo, /llegará al equipo del Vicedecanato\./);
  [a1, a2].forEach(c => assert.doesNotMatch(c, /\{\w+\}/));
});

test('analistas: se asignan o asignan a otra analista, y editan solo el correo de dirección de los programas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  // Asignarse a sí misma un caso sin analista (aviso de asignación incluido)
  estado.usuario = 'analista.uno@usach.cl';
  const n = estado.correos.length;
  ctx.api_guardarGestion('06/2026', { analista: 'analista.uno@usach.cl' });
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '06/2026').analista, 'analista.uno@usach.cl');
  assert.ok(estado.correos.slice(n).some(m => /asignada/.test(m.subject) && m.to === 'analista.uno@usach.cl'));
  // No se puede asignar a quien no es analista activa
  assert.throws(() => ctx.api_guardarGestion('06/2026', { analista: 'consulta@usach.cl' }), /rol Analista/);
  // Correo de dirección: la analista lo edita y queda en la bitácora
  ctx.api_guardarCorreoPrograma('Magíster en Prueba A', 'Nueva.Direccion@usach.cl');
  assert.equal(tabla(env, 'Programas').find(p => p.programa === 'Magíster en Prueba A').correo_direccion, 'nueva.direccion@usach.cl');
  assert.ok(tabla(env, 'Bitácora').some(b => /Correo de dirección de «Magíster en Prueba A»/.test(b.texto) && b.quien === 'analista.uno@usach.cl'));
  assert.throws(() => ctx.api_guardarCorreoPrograma('Magíster en Prueba A', 'no-es-correo'), /no válido/);
  assert.throws(() => ctx.api_guardarCorreoPrograma('Inexistente', 'a@usach.cl'), /no existe/);
  // Lo demás del programa sigue siendo de administración
  assert.throws(() => ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'x@usach.cl', analista: '', activo: 'NO' }, false), /nivel requerido/);
  // Nivel consulta no puede
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_guardarCorreoPrograma('Magíster en Prueba A', 'otra@usach.cl'), /nivel requerido/);
});

test('una analista asigna el caso a otra analista (y esta recibe el aviso)', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'analista.dos@usach.cl', nombre: 'Analista Dos', rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'SÍ' }, true);
  estado.usuario = 'analista.uno@usach.cl';
  const n = estado.correos.length;
  ctx.api_guardarGestion('05/2026', { analista: 'analista.dos@usach.cl' });
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '05/2026').analista, 'analista.dos@usach.cl');
  assert.ok(estado.correos.slice(n).some(m => m.to === 'analista.dos@usach.cl' && /asignada/.test(m.subject)));
});

test('V°B°: solo el Vicedecano/a; la analista solo con «aprueba por otro medio» e indicando cuál', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'resolucion', {}), /lo registra el Vicedecano\/a/);
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'resolucion', { otroMedio: true, campos: {} }), /por qué medio/);
  const pv = ctx.api_previsualizar('05/2026', 'resolucion', {});
  assert.equal(pv.requiereVicedecano, true);
  assert.equal(pv.esVicedecano, false);
  ctx.api_cambiarEstado('05/2026', 'resolucion', { otroMedio: true, campos: { otro_medio: 'Correo del 10-10-2026' } });
  const b = tabla(env, 'Bitácora').filter(x => x.tipo === 'estado').pop();
  assert.match(b.texto, /por otro medio \(Correo del 10-10-2026\), registrado por analista\.uno@usach\.cl/);
  // El Vicedecano/a registra directo, sin marcar nada
  const env2 = instalar(preparar());
  env2.estado.usuario = 'analista.uno@usach.cl';
  env2.ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  env2.estado.usuario = 'vice@usach.cl';
  env2.ctx.api_cambiarEstado('05/2026', 'rechazo_vb', {});
  assert.match(tabla(env2, 'Bitácora').filter(x => x.tipo === 'estado').pop().texto, /registrado por el Vicedecano\/a/);
});

test('recordatorio de V°B° al Vicedecano/a, con copia a la analista', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  const h = env.libro.getSheetByName('Solicitudes'); const enc = h.datos[0];
  const f = h.datos.findIndex(r => r[0] === '05/2026');
  h.datos[f][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  estado.usuario = '';
  const n = estado.correos.length;
  ctx.tareaDiaria();
  const r = estado.correos.slice(n).filter(m => /V°B° pendiente/.test(m.subject));
  assert.equal(r.length, 1);
  assert.equal(r[0].to, 'vice@usach.cl');
  assert.equal(r[0].cc, 'analista.uno@usach.cl');
  assert.match(r[0].body, /Propuesta del Comité: Acoger/);
});

test('el nombre del Vicedecano/a sale de su cuenta y Configuración solo lo muestra', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  assert.equal(typeof ctx.api_guardarVicedecano, 'undefined');
  assert.ok(!tabla(env, 'Parámetros').some(p => p.clave === 'vicedecano_nombre'));
  estado.usuario = 'analista.uno@usach.cl';
  const vd = ctx.api_config().vicedecano;
  const cuenta = tabla(env, 'Cuentas').find(c => c.rol === 'Vicedecano/a' && c.activo === 'SÍ');
  assert.deepEqual({ ...vd }, { nombre: cuenta.nombre, correo: cuenta.correo, activas: 1 });
  // Cambiar el nombre en «Cuentas» cambia el de los correos.
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ ...cuenta, nombre: 'Dra. Nueva Vicedecana' }, false);
  assert.equal(ctx.api_config().vicedecano.nombre, 'Dra. Nueva Vicedecana');
});

test('actualización: retira vicedecano_nombre y copia el nombre a la cuenta si estaba vacío', () => {
  const env = instalar(preparar());
  const { ctx } = env;
  const par = env.libro.getSheetByName('Parámetros');
  par.appendRow(['vicedecano_nombre', 'Dr. Antiguo Nombre', 'obsoleto']);
  const hc = env.libro.getSheetByName('Cuentas');
  const enc = hc.datos[0];
  const fila = hc.datos.findIndex(r => r[enc.indexOf('rol')] === 'Vicedecano/a');
  hc.datos[fila][enc.indexOf('nombre')] = '';
  const cambios = ctx.aplicarActualizacion_();
  assert.ok(cambios.some(c => /Parámetros retirados: vicedecano_nombre/.test(c)));
  assert.ok(!tabla(env, 'Parámetros').some(p => p.clave === 'vicedecano_nombre'));
  assert.equal(tabla(env, 'Cuentas').find(c => c.rol === 'Vicedecano/a').nombre, 'Dr. Antiguo Nombre');
});

test('visor: PDF tal cual, Word convertido a PDF (copia temporal borrada) y ZIP por documento', () => {
  const { crearZip } = require('./simulador');
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  const pdf = Buffer.from('%PDF-1.4 certificado');
  const docx = Buffer.from('PK-docx-simulado');
  const zip = crearZip([['docs/', ''], ['docs/certificado.pdf', pdf], ['docs/carta.docx', docx], ['__MACOSX/docs/._carta.docx', 'x'], ['docs/planilla.xlsx', 'xx']]);
  ctx.api_subirArchivo('05/2026', 'certificado.pdf', 'application/pdf', pdf.toString('base64'), 'otro');
  ctx.api_subirArchivo('05/2026', 'carta.docx', 'application/octet-stream', docx.toString('base64'), 'otro');
  ctx.api_subirArchivo('05/2026', 'antecedentes.zip', 'application/zip', zip.toString('base64'), 'otro');
  const arch = ctx.api_expediente('05/2026').archivos;
  const id = n => arch.find(a => a.nombre === n).id;
  assert.deepEqual([...arch.filter(a => a.vista).map(a => a.vista)].sort(), ['pdf', 'word', 'zip']);

  const vp = ctx.api_verArchivo('05/2026', id('certificado.pdf'));
  assert.equal(vp.tipo, 'pdf');
  assert.equal(Buffer.from(vp.base64, 'base64').toString(), '%PDF-1.4 certificado');

  const vw = ctx.api_verArchivo('05/2026', id('carta.docx'));
  assert.equal(vw.tipo, 'pdf'); assert.equal(vw.convertido, true); assert.equal(vw.nombre, 'carta.pdf');
  assert.equal(estado.convertidos.length, 1);
  assert.equal(estado.convertidos[0].mime, 'application/vnd.google-apps.document');
  assert.deepEqual([...estado.borrados], [estado.convertidos[0].id], 'la copia convertida se borra en el acto');

  const lista = ctx.api_verArchivo('05/2026', id('antecedentes.zip'));
  assert.equal(lista.modo, 'zip');
  assert.deepEqual([...lista.entradas].map(e => [e.nombre, e.vista]), [['docs/certificado.pdf', 'pdf'], ['docs/carta.docx', 'word'], ['docs/planilla.xlsx', '']]);
  const e0 = ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 0);
  assert.equal(e0.nombre, 'certificado.pdf');
  assert.equal(Buffer.from(e0.base64, 'base64').toString(), '%PDF-1.4 certificado');
  const e1 = ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 1);
  assert.equal(e1.tipo, 'pdf'); assert.equal(e1.convertido, true);
  assert.equal(estado.borrados.length, 2);
  assert.throws(() => ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 2), /no se puede mostrar/);
  assert.throws(() => ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 9), /ya no está/);

  assert.throws(() => ctx.api_verArchivo('06/2026', id('certificado.pdf')), /no pertenece a este expediente/);
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_verArchivo('05/2026', id('certificado.pdf')), /nivel requerido/);
});

test('PDF del formulario a pedido: analistas y administración sí; consulta no; escapa el texto del estudiante', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const hs = env.libro.getSheetByName('Solicitudes');
  const enc = hs.datos[0], f = hs.datos.findIndex(x => x[0] === '05/2026');
  hs.datos[f][enc.indexOf('fundamentacion')] = 'Texto con <script>alert(1)</script> & símbolos';
  estado.usuario = 'analista.uno@usach.cl';
  const r = ctx.api_pdfSolicitud('05/2026');
  assert.ok(r.id);
  const html = estado.pdfs[estado.pdfs.length - 1];
  assert.ok(html.indexOf('<script>') < 0);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; símbolos/);
  assert.ok(!r.existente);
  const generados = estado.pdfs.length;
  // Se genera una sola vez: si se pide de nuevo, se informa el existente y no se elabora otro.
  estado.usuario = 'vice@usach.cl';
  const r2 = ctx.api_pdfSolicitud('05/2026');
  assert.equal(r2.existente, true); assert.equal(r2.id, r.id); assert.equal(r2.por, 'Analista Uno');
  assert.equal(estado.pdfs.length, generados);
  assert.equal(tabla(env, 'Archivos').filter(a => a.folio === '05/2026' && a.categoria === 'formulario_solicitud').length, 1);
  // Si el archivo se borró de Drive, se puede volver a generar.
  env.DriveApp.getFileById(r.id).setTrashed(true);
  const r3 = ctx.api_pdfSolicitud('05/2026');
  assert.ok(!r3.existente); assert.notEqual(r3.id, r.id);
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_pdfSolicitud('05/2026'), /nivel requerido/);
});
