// ============================================================
// UTILITAIRES DE GESTION D'ERREURS
// ============================================================

/**
 * Extrait un message d'erreur lisible à partir de n'importe quelle valeur
 * Gère les cas Error, string, objets avec message, etc.
 */
export function extractErrorMessage(error: unknown): string {
  // Null ou undefined
  if (error == null) {
    return 'Une erreur inconnue est survenue';
  }

  // Instance Error standard
  if (error instanceof Error) {
    return error.message || error.name || 'Erreur inconnue';
  }

  // String directe
  if (typeof error === 'string') {
    return error || 'Erreur inconnue';
  }

  // Objet avec propriété message
  if (typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
  }

  // Objet avec propriété error
  if (typeof error === 'object' && 'error' in error) {
    const err = (error as { error: unknown }).error;
    if (typeof err === 'string') {
      return err;
    }
  }

  // Fallback: conversion en string
  try {
    const str = String(error);
    return str !== '[object Object]' ? str : 'Erreur inconnue';
  } catch {
    return 'Erreur inconnue';
  }
}

