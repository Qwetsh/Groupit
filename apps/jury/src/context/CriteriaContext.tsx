import type { CriteriaConfig } from '@groupit/shared';
import { CriteriaContext } from './criteriaConfig';

export function CriteriaProvider({ config, children }: { config: CriteriaConfig; children: React.ReactNode }) {
  return (
    <CriteriaContext.Provider value={config}>
      {children}
    </CriteriaContext.Provider>
  );
}
