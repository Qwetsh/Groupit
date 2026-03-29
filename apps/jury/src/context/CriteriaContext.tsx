import { createContext, useContext } from 'react';
import type { CriteriaConfig } from '@groupit/shared';
import { DEFAULT_CRITERIA_CONFIG } from '@groupit/shared';

const CriteriaContext = createContext<CriteriaConfig>(DEFAULT_CRITERIA_CONFIG);

export function CriteriaProvider({ config, children }: { config: CriteriaConfig; children: React.ReactNode }) {
  return (
    <CriteriaContext.Provider value={config}>
      {children}
    </CriteriaContext.Provider>
  );
}

export function useCriteriaConfig(): CriteriaConfig {
  return useContext(CriteriaContext);
}
