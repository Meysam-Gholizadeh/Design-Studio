import type { TemplateDefinition } from '@/domain/schemas/catalog';
import { learningPlatformOverview } from './education/learningPlatformOverview';
import { fitnessOverview } from './fitness/fitnessOverview';
import { executiveBusinessOverview } from './executive/executiveBusinessOverview';
import { financePerformanceOverview } from './finance/financePerformanceOverview';
import { personalFinanceHub } from './finance/personalFinanceHub';
import { hospitalOperations } from './healthcare/hospitalOperations';
import { patientExperience } from './healthcare/patientExperience';
import { physioPatientRecovery } from './healthcare/physioPatientRecovery';
import { physioRecoveryJourney } from './healthcare/physioRecoveryJourney';
import { hrWorkforceOverview } from './hr/hrWorkforceOverview';
import { operationsPerformanceOverview } from './operations/operationsPerformanceOverview';
import { procurementOverview } from './procurement/procurementOverview';
import { salesPerformance } from './sales/salesPerformance';
import { storefrontOverview } from './sales/storefrontOverview';

/** All catalog templates, in gallery order. Add new templates here. */
export const TEMPLATE_DEFINITIONS: readonly TemplateDefinition[] = [
  financePerformanceOverview,
  personalFinanceHub,
  fitnessOverview,
  learningPlatformOverview,
  storefrontOverview,
  operationsPerformanceOverview,
  hrWorkforceOverview,
  salesPerformance,
  procurementOverview,
  executiveBusinessOverview,
  physioRecoveryJourney,
  physioPatientRecovery,
  hospitalOperations,
  patientExperience,
];
