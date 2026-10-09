#!/bin/bash
# Trae lo último de GitHub y publica la plataforma CAE en la misma URL (macOS: doble clic en Finder).
# Equivale a: git pull  +  node desplegar.js   (desde la carpeta de este archivo, esté donde esté el repositorio).
# El ID de la implementación no va aquí: desplegar.js lo recuerda en .despliegue.json (fuera del repositorio).
# Para fijarlo o cambiarlo: ./actualizar.command AKfycb…
#
# Todo va entre llaves para que bash lea el archivo completo antes de ejecutarlo: «git pull» puede reescribir este mismo archivo.
{
  set -u
  cd "$(dirname "$0")" || exit 1

  pausa() { echo; read -r -p "Presione Enter para cerrar…" _; }
  falla() { echo; echo "✖ $1"; pausa; exit 1; }

  command -v git  >/dev/null || falla "No se encontró git."
  command -v node >/dev/null || falla "No se encontró node (instale Node.js desde nodejs.org)."

  raiz="$(git rev-parse --show-toplevel 2>/dev/null)" || falla "Esta carpeta no está dentro del repositorio."
  echo "▶ Trayendo lo último de GitHub en $raiz"
  git -C "$raiz" pull --ff-only origin main ||
    falla "git pull no pudo traer los cambios (¿hay cambios locales sin guardar? Revise con: git -C \"$raiz\" status). No se publicó nada."

  node desplegar.js "$@" || falla "La publicación no terminó; la versión publicada sigue siendo la anterior."

  pausa
  exit 0
}
