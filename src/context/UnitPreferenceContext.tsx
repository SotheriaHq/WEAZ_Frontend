import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getWithTTL, setWithTTL } from '@/utils/sizing';

type UnitPreferenceContextValue = {
  lengthUnit: 'cm' | 'in';
  weightUnit: 'kg' | 'lb';
  setLengthUnit: (unit: 'cm' | 'in') => void;
  setWeightUnit: (unit: 'kg' | 'lb') => void;
};

const STORAGE_KEY = 'sizing_unit_pref';
const PREF_TTL_MS = 1000 * 60 * 60 * 24 * 365;

const UnitPreferenceContext = createContext<UnitPreferenceContextValue>({
  lengthUnit: 'cm',
  weightUnit: 'kg',
  setLengthUnit: () => undefined,
  setWeightUnit: () => undefined,
});

export function UnitPreferenceProvider({ children }: { children: React.ReactNode }) {
  const initial = getWithTTL<{ length?: 'cm' | 'in'; weight?: 'kg' | 'lb' }>(STORAGE_KEY);

  const [lengthUnit, setLengthUnitState] = useState<'cm' | 'in'>(initial?.length ?? 'cm');
  const [weightUnit, setWeightUnitState] = useState<'kg' | 'lb'>(initial?.weight ?? 'kg');

  const setLengthUnit = useCallback((unit: 'cm' | 'in') => {
    setLengthUnitState(unit);
    setWithTTL(STORAGE_KEY, { length: unit, weight: weightUnit }, PREF_TTL_MS);
  }, [weightUnit]);

  const setWeightUnit = useCallback((unit: 'kg' | 'lb') => {
    setWeightUnitState(unit);
    setWithTTL(STORAGE_KEY, { length: lengthUnit, weight: unit }, PREF_TTL_MS);
  }, [lengthUnit]);

  const value = useMemo(
    () => ({ lengthUnit, weightUnit, setLengthUnit, setWeightUnit }),
    [lengthUnit, setLengthUnit, setWeightUnit, weightUnit],
  );

  return <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>;
}

export const useUnitPreference = () => useContext(UnitPreferenceContext);
