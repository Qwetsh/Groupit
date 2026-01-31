// ============================================================
// LOGOS INSTITUTIONNELS POUR LES EXPORTS PDF
// ============================================================

// Import des images via Vite pour obtenir les URLs correctes
import logoAcademieImg from '../../../public/logos/logo-academie-grand-est.png';
import logoEducationImg from '../../../public/logos/logo-education-nationale.jpg';

/**
 * Logo de la Région Académique Grand Est
 */
export const LOGO_ACADEMIE_GRAND_EST = logoAcademieImg;

/**
 * Logo de l'Éducation Nationale
 */
export const LOGO_EDUCATION_NATIONALE = logoEducationImg;

/**
 * Configuration des logos pour l'export PDF
 */
export interface LogosConfig {
  showAcademie: boolean;
  showEducationNationale: boolean;
  customAcademieLogo?: string;
  customEducationNationaleLogo?: string;
}

/**
 * Retourne le logo Académie si activé
 */
export function getAcademieLogo(config: LogosConfig): string | null {
  if (!config.showAcademie) return null;
  return config.customAcademieLogo || LOGO_ACADEMIE_GRAND_EST;
}

/**
 * Retourne le logo Éducation Nationale si activé
 */
export function getEducationNationaleLogo(config: LogosConfig): string | null {
  if (!config.showEducationNationale) return null;
  return config.customEducationNationaleLogo || LOGO_EDUCATION_NATIONALE;
}
