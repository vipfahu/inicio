// Pruebas de las reglas puras (Logica.gs). Ejecutar: node --test concesiones-excepcion/apps-script/tests/
// Solo datos sintéticos: este repositorio es público.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../Logica.gs');

test('transiciones: solo las declaradas', () => {
  assert.ok(L.transicionValida('recibida', 'revision'));
  assert.ok(!L.transicionValida('recibida', 'resuelto'));
  assert.ok(L.transicionValida('informe_rc', 'vb_informe'));
  assert.ok(!L.transicionValida('resuelto', 'revision'));
  assert.ok(L.esCierre('negado') && !L.esCierre('vb'));
});

test('devolver al programa usa la plantilla de devolución, no la remisión inicial', () => {
  assert.equal(L.eventoTransicion('vb', 'programa'), 'devolucion');
  assert.equal(L.eventoTransicion('vb_informe', 'programa'), 'programa');
  assert.equal(L.eventoTransicion('vb', 'aceptada'), 'aceptada');
  assert.equal(L.eventoTransicion('revision', 'informe_rc'), '');
  assert.equal(L.eventoTransicion('recibida', 'revision'), 'inicio_autorizado');
  // La presentación solo se acepta después del informe y del programa (desde el V°B°)
  assert.ok(!L.transicionValida('revision', 'aceptada'));
  assert.ok(L.transicionValida('vb', 'aceptada'));
  assert.deepEqual([...L.DECIDE_VICEDECANO], ['recibida', 'vb']);
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
