// ============================================================
// UTILITAIRES DE GESTION D'ERREURS
// ============================================================

/**
 * Types d'erreurs applicatives
 */
export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'GEOCODING_ERROR'
  | 'IMPORT_ERROR'
  | 'EXPORT_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

/**
 * Structure d'erreur applicative
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
  originalError?: unknown;
}

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

/**
 * Crée une erreur applicative structurée
 */
export function createAppError(
  code: ErrorCode,
  message: string,
  originalError?: unknown
): AppError {
  return {
    code,
    message,
    details: originalError ? extractErrorMessage(originalError) : undefined,
    originalError,
  };
}

/**
 * Vérifie si une erreur est une erreur réseau
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      error.name === 'TypeError' // Souvent les erreurs fetch
    );
  }
  return false;
}

/**
 * Vérifie si une erreur est une erreur de quota (IndexedDB)
 */
export function isQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('quota') ||
      message.includes('storage') ||
      error.name === 'QuotaExceededError'
    );
  }
  return false;
}

/**
 * Log une erreur avec contexte (pour debug)
 */
export function logError(context: string, error: unknown): void {
  const message = extractErrorMessage(error);
  console.error(`[${context}] ${message}`, error);
}
