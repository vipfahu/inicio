// Simulador mínimo de los servicios de Apps Script usados por la plataforma, para pruebas en Node.
// No pretende ser fiel en todo: cubre solo lo que el código llama, y falla si se llama algo no simulado.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function crearEntorno() {
  const estado = { usuario: '', duenia: 'institucional@usach.cl', correos: [], triggers: [], props: {}, archivos: {}, carpetas: {}, n: 0, url: 'https://script.google.com/a/macros/usach.cl/s/PRUEBA/exec' };
  const nid = p => p + (++estado.n);

  // ── Sheets ──
  class Rango {
    constructor(h, f, c, nf, nc) { Object.assign(this, { h, f, c, nf: nf || 1, nc: nc || 1 }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nf; i++) {
        const fila = this.h.datos[this.f - 1 + i] || [];
        const r = [];
        for (let j = 0; j < this.nc; j++) { const v = fila[this.c - 1 + j]; r.push(v === undefined ? '' : v); }
        out.push(r);
      }
      return out;
    }
    setValues(v) {
      if (v.length !== this.nf || v[0].length !== this.nc) throw new Error('Dimensiones no coinciden: ' + v.length + 'x' + v[0].length + ' vs ' + this.nf + 'x' + this.nc);
      v.forEach((fila, i) => fila.forEach((x, j) => this.h.set(this.f + i, this.c + j, x)));
      return this;
    }
    setValue(x) { this.h.set(this.f, this.c, x); return this; }
    getValue() { return this.getValues()[0][0]; }
    getRow() { return this.f; }
    getSheet() { return this.h; }
    setNumberFormat() { return this; } setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
    setNote(n) { this.h.notas[this.f + ',' + this.c] = n; return this; }
    setDataValidation() { return this; }
  }
  class Hoja {
    constructor(nombre, libro) { this.nombre = nombre; this.libro = libro; this.datos = []; this.ocultas = []; this.notas = {}; this.formUrl = null; }
    getName() { return this.nombre; }
    getFormUrl() { return this.formUrl; }
    set(f, c, v) { while (this.datos.length < f) this.datos.push([]); const fila = this.datos[f - 1]; while (fila.length < c) fila.push(''); fila[c - 1] = v; }
    getLastRow() { for (let i = this.datos.length; i > 0; i--) if (this.datos[i - 1].some(x => x !== '' && x !== undefined)) return i; return 0; }
    getLastColumn() { return this.datos.reduce((m, f) => Math.max(m, f.length), 0); }
    getDataRange() { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
    getRange(a, b, c, d) { if (typeof a === 'string') return new Rango(this, 1, 1, 1, 1); return new Rango(this, a, b, c, d); }
    appendRow(v) { const f = this.getLastRow() + 1; v.forEach((x, j) => this.set(f, j + 1, x)); }
    setFrozenRows() {}
    hideColumns(c, n) { for (let i = 0; i < n; i++) this.ocultas.push(c + i); }
  }
  class Libro {
    constructor(nombre) { this.id = nid('ss'); this.nombre = nombre; this.hojas = [new Hoja('Hoja 1', this)]; estado.archivos[this.id] = archivo(this.id, nombre, 1000); }
    getId() { return this.id; }
    getSheets() { return this.hojas; }
    getSheetByName(n) { return this.hojas.find(h => h.nombre === n) || null; }
    insertSheet(n) { const h = new Hoja(n, this); this.hojas.push(h); return h; }
    deleteSheet(h) { this.hojas = this.hojas.filter(x => x !== h); }
  }
  const libros = {};
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => estado.activo,
    openById: id => { if (!libros[id]) throw new Error('No existe ' + id); return libros[id]; },
    create: n => { const l = new Libro(n); libros[l.id] = l; return l; },
    newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } }),
    getUi: () => { throw new Error('Sin interfaz en pruebas'); }
  };

  // ── Drive ──
  function archivo(id, nombre, bytes, mime) {
    return {
      id, nombre, bytes: bytes || 10, mime: mime || 'application/pdf', viewers: [], editors: [], acceso: 'PRIVATE',
      getId() { return this.id; }, getName() { return this.nombre; }, getSize() { return this.bytes; },
      getBlob() { const b = this; return { getBytes: () => ({ length: b.bytes }), getContentType: () => b.mime, getName: () => b.nombre }; },
      getUrl() { return 'https://drive.google.com/file/d/' + this.id; }, moveTo() { return this; },
      addViewer(c) { this.viewers.push(c); return this; },
      getEditors() { return this.editors.map(e => ({ getEmail: () => e })); }, getViewers() { return this.viewers.map(e => ({ getEmail: () => e })); },
      getSharingAccess() { return this.acceso; }
    };
  }
  function carpeta(nombre, padre) {
    const c = Object.assign(archivo(nid('fold'), nombre), {
      padre, hijos: [], archivosIn: [], atajos: [],
      getFoldersByName(n) { const l = this.hijos.filter(h => h.nombre === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
      createFolder(n) { const h = carpeta(n, this); this.hijos.push(h); return h; },
      createFile(blob) { const a = archivo(nid('file'), blob.getName(), blob.getBytes().length, blob.getContentType()); estado.archivos[a.id] = a; this.archivosIn.push(a); return a; },
      createShortcut(id) { this.atajos.push(id); return archivo(nid('atajo'), 'atajo'); }
    });
    estado.carpetas[c.id] = c;
    return c;
  }
  const DriveApp = {
    Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK' },
    createFolder: n => carpeta(n, null),
    getFolderById: id => { if (!estado.carpetas[id]) throw new Error('No existe carpeta ' + id); return estado.carpetas[id]; },
    getFileById: id => { if (!estado.archivos[id]) throw new Error('No existe archivo ' + id); return estado.archivos[id]; }
  };

  const ctx = {
    console, Date, Logger: { log() {} },
    SpreadsheetApp, DriveApp,
    FormApp: { openByUrl: () => { throw new Error('Formulario no simulado'); }, ItemType: { LIST: 'LIST', MULTIPLE_CHOICE: 'MC' } },
    MailApp: { sendEmail: m => { const f = estado.fallaCorreo; if (f === true || (typeof f === 'function' && f(m))) throw new Error('Fallo simulado de envío'); estado.correos.push(m); }, getRemainingDailyQuota: () => 1500 },
    Session: {
      getActiveUser: () => ({ getEmail: () => estado.usuario }),
      getEffectiveUser: () => ({ getEmail: () => estado.duenia }),
      getScriptTimeZone: () => 'America/Santiago'
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => estado.props[k] || null, setProperty: (k, v) => { estado.props[k] = v; } }) },
    Utilities: {
      formatDate: (d, tz, f) => d.toISOString().slice(0, 10) + (f.indexOf('HH') >= 0 ? ' 00:00' : ''),
      base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b.length ? 'x' : '').toString('base64'),
      newBlob: (bytes, mime, nombre) => ({ getBytes: () => bytes, getContentType: () => mime, getName: () => nombre })
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => estado.url }),
      getProjectTriggers: () => estado.triggers,
      deleteTrigger: t => { estado.triggers = estado.triggers.filter(x => x !== t); },
      newTrigger: fn => {
        const t = { getHandlerFunction: () => fn };
        const cadena = { forSpreadsheet: () => cadena, onFormSubmit: () => cadena, timeBased: () => cadena, everyDays: () => cadena, atHour: () => cadena, create: () => { estado.triggers.push(t); return t; } };
        return cadena;
      }
    },
    HtmlService: {}
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..');
  const codigo = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  vm.runInContext(codigo, ctx, { filename: 'proyecto.gs' });

  // Planilla original con el Formulario conectado
  const libro = new Libro('Concesión Académica de Excepción Postgrado (Respuestas)');
  libros[libro.id] = libro;
  estado.activo = libro;
  libro.hojas[0].nombre = 'Respuestas de formulario 1';
  libro.hojas[0].formUrl = 'https://docs.google.com/forms/d/PRUEBA';
  estado.archivos[libro.id].editors = ['editor.antiguo@usach.cl'];

  return { ctx, estado, libro, hoja: libro.hojas[0], archivo, DriveApp };
}

module.exports = { crearEntorno };
