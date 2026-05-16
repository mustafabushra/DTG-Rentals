import { useApp } from '../context/AppProvider';

export function useAppData() {
  return useApp();
}
