import { createContext, useContext, ReactNode } from 'react';
import { useKBToggle } from '../hooks/use-kb-toggle';

interface KBContextType {
  enabledKBs: Set<string>;
  availableKBs: any[];
  loading: boolean;
  toggleKB: (kbId: string) => void;
  setKBs: (kbIds: string[]) => void;
  clearKBs: () => void;
  toggleAll: () => void;
  isAllSelected: boolean;
}

const KBContext = createContext<KBContextType | undefined>(undefined);

export function KBProvider({ children }: { children: ReactNode }) {
  const kbState = useKBToggle();

  return <KBContext.Provider value={kbState}>{children}</KBContext.Provider>;
}

export function useKBContext() {
  const context = useContext(KBContext);
  if (context === undefined) {
    throw new Error('useKBContext must be used within KBProvider');
  }
  return context;
}
