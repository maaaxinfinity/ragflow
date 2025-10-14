import { ReactNode, createContext, useContext } from 'react';
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
export { KBContext };
export type { KBContextType };

interface KBProviderProps {
  children: ReactNode;
  initialKBs?: string[];
  onKBsChange?: (kbIds: string[]) => void;
}

export function KBProvider({
  children,
  initialKBs,
  onKBsChange,
}: KBProviderProps) {
  const kbState = useKBToggle({ initialKBs, onKBsChange });

  return <KBContext.Provider value={kbState}>{children}</KBContext.Provider>;
}

export function useKBContext() {
  const context = useContext(KBContext);
  if (context === undefined) {
    throw new Error('useKBContext must be used within KBProvider');
  }
  return context;
}

// Optional variant for test/mock environments
export function useOptionalKBContext() {
  return useContext(KBContext);
}
