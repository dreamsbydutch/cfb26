import type { PowerCalibration } from './powerCalibration'

/** Trained on 2017-2025 forecasts; valid for editions from 2026 onward. */
export const POWER_RELEASE_CALIBRATION: PowerCalibration = {
  scale: 1.3780864735018248,
  homeOffset: -0.8503795343373222,
  probability: {
    fitCount: 7762,
    intercept: 0,
    maximumProbability: 0.99,
    minimumProbability: 0.01,
    slope: 0.1132212447,
    trainingSeasons: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    version: 'logistic-margin-v1',
  },
  trainingSeasons: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
}
