import { useEffect, useState } from 'react';
import { payrollParameterApi } from '../services/payrollParameterApi';
import { todayVn } from '../utils/format';

/** Fallback when no clinic-wide standard_working_days parameter is configured (mirrors the backend default). */
export const DEFAULT_STANDARD_WORKING_DAYS = 26;

/** The clinic-wide standard_working_days parameter in force today, or the default until it loads. */
export function useStandardWorkingDays(): number {
  const [days, setDays] = useState(DEFAULT_STANDARD_WORKING_DAYS);

  useEffect(() => {
    let cancelled = false;
    payrollParameterApi
      .listRateConfigs({ code: 'standard_working_days', status: 'active', effectiveOn: todayVn() })
      .then(configs => {
        const global = configs.find(c => !c.positionId && !c.staffId);
        if (!cancelled && global && global.value > 0) setDays(global.value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return days;
}
