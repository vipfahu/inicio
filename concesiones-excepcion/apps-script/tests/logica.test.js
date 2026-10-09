// Pruebas de las reglas puras (Logica.gs). Ejecutar: node --test concesiones-excepcion/apps-script/tests/
// Solo datos sintéticos: este repositorio es público.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../Logica.gs');

test('transiciones: solo las declaradas', () => {
  assert.ok(L.transicionValida('recibida', 'revision'));
  assert.ok(!L.transicionValida('recibida', 'resuelto'));
  assert.ok(L.transicionValida('informe_rc', 'programa'), 'la analista registra directo el envío al programa');
  assert.ok(!L.transicionValida('informe_rc', 'vb_informe'), 'ya no existe el V°B° al informe');
  assert.ok(!L.transicionValida('resuelto', 'revision'));
  assert.ok(L.esCierre('negado') && !L.esCierre('vb'));
});

test('el programa se consulta por STD: registrar el envío o la devolución no genera correo', () => {
  assert.equal(L.eventoTransicion('informe_rc', 'programa'), '');
  assert.equal(L.eventoTransicion('vb', 'programa'), '');
  assert.deepEqual([...L.camposRequeridos('vb', 'programa')], ['observacion']);
  assert.deepEqual([...L.camposRequeridos('informe_rc', 'programa')], []);
  assert.deepEqual([...L.camposRequeridos('revision', 'rechazada')], ['motivo']);
  assert.equal(L.eventoTransicion('revision', 'aceptada'), 'aceptada');
  assert.equal(L.eventoTransicion('aceptada', 'informe_rc'), '');
});

test('folios: normalización y correlativo', () => {
  assert.equal(L.normalizarFolio('01 /2025'), '01/2025');
  assert.equal(L.normalizarFolio('8 / 2026'), '08/2026');
  assert.equal(L.normalizarFolio(new Date(2026, 0, 1)), '01/2026');
  assert.equal(L.normalizarFolio(null), '');
  assert.equal(L.siguienteFolio(['01/2026', '33/2026', '05/2025', 'basura'], 2026), '34/2026');
  assert.equal(L.siguienteFolio([], 2027), '01/2027');
});

test('migración: vale el último estado no vacío (derecha a izquierda)', () => {
  assert.deepEqual(L.estadoMigrado('Rechazado', 'Negado', 'NO PROCEDE').estado, 'no_procede');
  assert.equal(L.estadoMigrado('Rechazado', '', '').estado, 'rechazada');
  assert.equal(L.estadoMigrado('Aprobado', 'Resuelto', 'RESUELTO').estado, 'resuelto');
  assert.equal(L.estadoMigrado('', '', '').estado, 'recibida');
  const t = L.estadoMigrado('Aprobado', 'En trámite', 'En trámite');
  assert.equal(t.estado, 'aceptada'); assert.ok(t.revisar);
  const r = L.estadoMigrado('en revisión', 'En trámite', 'En trámite');
  assert.equal(r.estado, 'revision'); assert.ok(r.revisar);
  const rc = L.estadoMigrado('Rechazado', '', '', 'Debe ingresarse en la página web y enviada a RC.');
  assert.equal(rc.estado, 'rechazada'); assert.ok(rc.revisar);
});

test('tipos: catálogo vs texto libre', () => {
  const s = L.separarTipos('Prórroga de Periodo Lectivo, Matrícula fuera de plazo');
  assert.equal(s.catalogo, 'Prórroga de Periodo Lectivo');
  assert.equal(s.libre, 'Matrícula fuera de plazo');
});

test('plantillas: variables faltantes quedan visibles', () => {
  assert.equal(L.rellenar('Hola {nombre}, folio {folio}', { nombre: 'Ana' }), 'Hola Ana, folio {folio}');
  assert.deepEqual(L.variablesSinResolver('Hola Ana, folio {folio} {folio} {std}'), ['folio', 'std']);
});

const cuentas = [
  { correo: 'analista.a@usach.cl', nombre: 'A', rol: 'Analista', nivel: 'edicion', activo: 'SÍ', recibe_eventos: '' },
  { correo: 'vice@usach.cl', nombre: 'V', rol: 'Vicedecano/a', nivel: 'administracion', activo: 'SÍ', recibe_eventos: '' },
  { correo: 'vice.antiguo@usach.cl', nombre: 'V0', rol: 'Vicedecano/a', nivel: 'consulta', activo: 'NO', recibe_eventos: '' },
  { correo: 'rc@usach.cl', nombre: 'RC', rol: 'Registro Curricular', nivel: 'sin_acceso', activo: 'SÍ', recibe_eventos: '' },
  { correo: 'coord@usach.cl', nombre: 'C', rol: 'Consulta', nivel: 'consulta', activo: 'SÍ', recibe_eventos: 'vb, registro' }
];
const programas = [{ programa: 'Magíster X', correo_direccion: 'dir.x@usach.cl' }, { programa: 'Magíster Y', correo_direccion: 'COMPLETAR' }];
const sol = { correo: 'Est@usach.cl', analista: 'analista.a@usach.cl', programa: 'Magíster X' };

test('destinatarios: roles → correos, sin inactivos ni duplicados', () => {
  const d = L.resolverDestinatarios('Vicedecano/a', '', { solicitud: sol, cuentas, programas, evento: 'vb' });
  assert.deepEqual(d.para, ['vice@usach.cl']);
  assert.deepEqual(d.cc, ['coord@usach.cl']);
  assert.deepEqual(d.faltantes, []);
  const e = L.resolverDestinatarios('Estudiante', 'Dirección de programa, Analista', { solicitud: sol, cuentas, programas, evento: 'aceptada' });
  assert.deepEqual(e.para, ['est@usach.cl']);
  assert.deepEqual(e.cc, ['dir.x@usach.cl', 'analista.a@usach.cl']);
});

test('destinatarios: el estudiante recibe en la cuenta de inicio de sesión y en el correo del formulario (sin repetir)', () => {
  const dos = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: 'Ingreso@usach.cl', correo: 'otro@gmail.com' }, cuentas, programas });
  assert.deepEqual(dos.para, ['ingreso@usach.cl', 'otro@gmail.com']);
  const igual = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: 'est@usach.cl', correo: ' EST@usach.cl ' }, cuentas, programas });
  assert.deepEqual(igual.para, ['est@usach.cl']);
  const soloForm = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: '' }, cuentas, programas });
  assert.deepEqual(soloForm.para, ['est@usach.cl']);
  const ninguno = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: '', correo: '' }, cuentas, programas });
  assert.equal(ninguno.faltantes.length, 1);
});

test('destinatarios: un programa sin correo de dirección bloquea el envío', () => {
  const d = L.resolverDestinatarios('Dirección de programa', '', { solicitud: { ...sol, programa: 'Magíster Y' }, cuentas, programas });
  assert.equal(d.para.length, 0);
  assert.equal(d.faltantes.length, 1);
});

test('días hábiles: excluye fines de semana y feriados', () => {
  // vie 2026-09-11 → mar 2026-09-22, con 18 y 19 de septiembre feriados (vie y sáb)
  assert.equal(L.diasHabilesEntre(new Date(2026, 8, 11), new Date(2026, 8, 22), ['2026-09-18', '2026-09-19']), 6);
  assert.equal(L.diasHabilesEntre(new Date(2026, 8, 11), new Date(2026, 8, 11), []), 0);
});

test('recordatorios: tras vencer el plazo, cada N días hábiles, hasta el máximo', () => {
  const p = { plazo_programa_dias: 2, recordatorio_cada_dias: 2, recordatorios_max: 3 };
  const base = { estado: 'programa', estado_desde: new Date(2026, 9, 5), recordatorios: 0 }; // lun 05-10
  assert.ok(!L.necesitaRecordatorio(base, new Date(2026, 9, 7), p, []));   // 2 días: dentro del plazo
  assert.ok(L.necesitaRecordatorio(base, new Date(2026, 9, 8), p, []));    // 3 días: vencido
  const uno = { ...base, recordatorios: 1, ultimo_recordatorio: new Date(2026, 9, 8) };
  assert.ok(!L.necesitaRecordatorio(uno, new Date(2026, 9, 9), p, []));
  assert.ok(L.necesitaRecordatorio(uno, new Date(2026, 9, 12), p, []));
  assert.ok(!L.necesitaRecordatorio({ ...uno, recordatorios: 3 }, new Date(2026, 9, 30), p, []));
  assert.ok(!L.necesitaRecordatorio({ ...base, estado: 'vb' }, new Date(2026, 9, 30), p, []));
});

test('recordatorio de admisibilidad: primer aviso al día hábil siguiente a la recepción', () => {
  const p = { plazo_admisibilidad_dias: 2, primer_aviso_admisibilidad_dias: 1, plazo_programa_dias: 2, recordatorio_cada_dias: 2, recordatorios_max: 3 };
  const base = { estado: 'recibida', estado_desde: new Date(2026, 9, 5, 15, 0), recordatorios: 0 }; // lun 05-10, 15:00
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 5, 18, 0), p, []), '', 'el mismo día no');
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 6, 8, 0), p, []), 'recordatorio_admisibilidad', 'mar 08:00: primer aviso');
  const viernes = { ...base, estado_desde: new Date(2026, 9, 9, 10, 0) };
  assert.equal(L.recordatorioPendiente(viernes, new Date(2026, 9, 10, 8, 0), p, []), '', 'sábado no cuenta');
  assert.equal(L.recordatorioPendiente(viernes, new Date(2026, 9, 12, 8, 0), p, []), 'recordatorio_admisibilidad', 'lunes siguiente');
  const uno = { ...base, recordatorios: 1, ultimo_recordatorio: new Date(2026, 9, 6, 8, 0) };
  assert.equal(L.recordatorioPendiente(uno, new Date(2026, 9, 7, 8, 0), p, []), '');
  assert.equal(L.recordatorioPendiente(uno, new Date(2026, 9, 8, 8, 0), p, []), 'recordatorio_admisibilidad', 'luego cada 2 días hábiles');
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 6, 8, 0), { ...p, primer_aviso_admisibilidad_dias: '' }, []), 'recordatorio_admisibilidad', 'por defecto, 1 día');
  // vence el plazo de 2 días hábiles: lun 05-10 → mié 07-10; con feriado el 06 → jue 08-10
  assert.equal(L.sumarDiasHabiles(new Date(2026, 9, 5), 2, []).getDate(), 7);
  assert.equal(L.sumarDiasHabiles(new Date(2026, 9, 5), 2, ['2026-10-06']).getDate(), 8);
  assert.equal(L.recordatorioPendiente({ ...base, estado: 'revision' }, new Date(2026, 9, 30), p, []), '', 'abierta la revisión, no hay recordatorio');
  assert.equal(L.recordatorioPendiente({ ...base, estado: 'programa' }, new Date(2026, 9, 8), p, []), 'recordatorio');
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 8), { ...p, recordatorios_max: 0 }, []), '');
});

test('destinatario «Analista o equipo»: la asignada, o quienes pueden asignar', () => {
  const sinAnalista = L.resolverDestinatarios('Analista o equipo', '', { solicitud: { ...sol, analista: '' }, cuentas, programas });
  assert.deepEqual(sinAnalista.para, ['analista.a@usach.cl', 'vice@usach.cl']);
  const conAnalista = L.resolverDestinatarios('Analista o equipo', '', { solicitud: sol, cuentas, programas });
  assert.deepEqual(conAnalista.para, ['analista.a@usach.cl']);
});

test('niveles y alcance por programa', () => {
  assert.ok(L.nivelSuficiente('administracion', 'edicion'));
  assert.ok(!L.nivelSuficiente('consulta', 'edicion'));
  assert.ok(!L.nivelSuficiente('edicion', 'inexistente'));
  assert.ok(L.puedeVerSolicitud({ programas: 'todos' }, { programa: 'Z' }));
  assert.ok(L.puedeVerSolicitud({ programas: 'Magíster X; Magíster Y' }, { programa: 'Magíster Y' }));
  assert.ok(!L.puedeVerSolicitud({ programas: 'Magíster X' }, { programa: 'Magíster Y' }));
});

test('cuentas: validación y última administración', () => {
  const duenia = 'institucional@usach.cl';
  const nueva = { correo: 'nueva@usach.cl', nombre: 'N', rol: 'Analista', nivel: 'edicion', activo: 'SÍ' };
  assert.equal(L.validarCuenta(nueva, cuentas, duenia, true), '');
  assert.match(L.validarCuenta({ ...nueva, correo: 'x@gmail.com' }, cuentas, duenia, true), /@usach\.cl/);
  assert.match(L.validarCuenta({ ...nueva, correo: 'vice@usach.cl' }, cuentas, duenia, true), /Ya existe/);
  assert.match(L.validarCuenta({ ...cuentas[1], nivel: 'edicion' }, cuentas, duenia, false), /al menos una/);
  assert.match(L.validarCuenta({ ...cuentas[1], activo: 'NO' }, cuentas, duenia, false), /al menos una/);
  assert.match(L.validarCuenta({ ...nueva, correo: duenia }, cuentas, duenia, true), /dueña/);
});

test('Apps Script: ningún .gs y .html comparten nombre (el editor no lo permite)', () => {
  const fs = require('fs');
  const path = require('path');
  const nombres = fs.readdirSync(path.join(__dirname, '..')).filter(f => /\.(gs|html)$/.test(f)).map(f => f.replace(/\.(gs|html)$/, ''));
  const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  assert.deepEqual(repetidos, []);
});
