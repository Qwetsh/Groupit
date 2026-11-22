import { createContext, useContext } from 'react';
import type { CriteriaConfig } from '@groupit/shared';
import { DEFAULT_CRITERIA_CONFIG } from '@groupit/shared';

export const CriteriaContext = createContext<CriteriaConfig>(DEFAULT_CRITERIA_CONFIG);

export function useCriteriaConfig(): CriteriaConfig {
  return useContext(CriteriaContext);
}
