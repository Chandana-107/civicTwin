/**
 * simulationApi.js
 * Thin API layer for the CivicTwin Simulation Service (port 8003).
 */

const BASE_URL = import.meta.env.VITE_SIMULATION_API_URL || 'http://127.0.0.1:8003';

/**
 * Run an ABM simulation with the three UI inputs.
 * @param {number} nAgents   - Number of worker agents (maps to n_workers)
 * @param {string} scenario  - Natural-language policy description
 * @param {number} steps     - Number of simulation steps
 * @param {number} [nRuns=1] - Seed repetitions (default 1 for fast UI run)
 */
export async function runABMSimulation(nAgents, scenario, steps, nRuns = 1) {
  const body = {
    n_workers: parseInt(nAgents, 10),
    scenario: scenario || '',
    n_steps: parseInt(steps, 10),
    n_runs: parseInt(nRuns, 10),
    // Calibrated defaults: fewer firms creates realistic structural unemployment
    n_firms: Math.max(3, Math.round(nAgents / 15)),
    n_households: Math.max(5, Math.round(nAgents / 3)),
  };

  const res = await fetch(`${BASE_URL}/abm/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch ABM simulation progress.
 * @param {string} simulationId
 * @returns {{ status, steps_done, total_steps, pct }}
 */
export async function getABMProgress(simulationId) {
  const res = await fetch(`${BASE_URL}/abm/simulate/${simulationId}/progress`);
  if (!res.ok) throw new Error(`Progress fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch the current (possibly partial) results for a simulation.
 * Works both during execution (returns steps_done completed so far)
 * and after completion (returns full mean_by_step arrays).
 *
 * Response shape:
 *   { status, steps_done, results: { mean_by_step, mean_final, n_steps, n_runs } }
 *
 * @param {string} simulationId
 */
export async function fetchStepResults(simulationId) {
  const res = await fetch(`${BASE_URL}/results/${simulationId}`);
  if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch the full result of a completed ABM simulation.
 * @param {string} simulationId
 */
export async function getABMResults(simulationId) {
  const res = await fetch(`${BASE_URL}/abm/results/${simulationId}`);
  if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch the last 20 simulation runs from the history endpoint.
 */
export async function getSimulationHistory() {
  const res = await fetch(`${BASE_URL}/simulations`);
  if (!res.ok) return { simulations: [] };
  return res.json();
}
