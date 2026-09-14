import type { PowerProgramFit } from './powerProgram'

/** Learned on earlier-season forecasts; released for 2026 onward. */
export const POWER_PROGRAM_RELEASE: PowerProgramFit = {
  weight: 0.09265833905529011,
  scale: 1.0931991166723183,
  homeOffset: 0.15456797531503463,
  trainingSeasons: [
    2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
  ],
  probability: {
    fitCount: 7762,
    intercept: 0,
    maximumProbability: 0.99,
    minimumProbability: 0.01,
    slope: 0.1180020563,
    trainingSeasons: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    version: 'logistic-margin-v1',
  },
}
