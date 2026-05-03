"""Runner utilities for additive ABM simulation execution and aggregation."""

from __future__ import annotations

import time
from statistics import mean
from typing import Dict, Any

try:
    from .abm_model import CivicABMModel
except ImportError:
    from abm_model import CivicABMModel

# ── Shared progress store ─────────────────────────────────────────────────────
_progress: Dict[str, Dict[str, Any]] = {}

# ── Shared incremental results store ─────────────────────────────────────────
# Written after EVERY individual step inside run_abm_single().
# GET /results/{id} reads this to serve partial data mid-run.
_live_results: Dict[str, Dict[str, Any]] = {}

# All metrics tracked by the DataCollector.
ALL_METRICS = [
    "unemployment_rate",
    "avg_income",
    "migration_count",
    "rent_index",
    "avg_welfare",
    "infrastructure_score",
    "env_score",
]


def get_progress(simulation_id: str) -> Dict[str, Any]:
    """Return the current progress dict for a simulation, or a default."""
    return _progress.get(simulation_id, {
        "status": "unknown",
        "steps_done": 0,
        "total_steps": 0,
        "pct": 0,
    })


def get_live_results(simulation_id: str) -> Dict[str, Any] | None:
    """Return partial results written so far for a running simulation."""
    return _live_results.get(simulation_id)


def run_abm_single(
    config: dict,
    simulation_id: str | None = None,
    seed_idx: int = 0,
) -> dict:
    """Run one ABM simulation seed and return per-step values.

    Writes to _progress and _live_results INSIDE the per-step loop so that
    concurrent GET /progress and GET /results requests see live data.

    Fix 4: time.sleep(step_delay_s) between steps keeps the simulation visible.
    Default 300ms → 20 steps ≈ 6 s observable window.
    """
    n_steps = int(config.get("n_steps", 50))
    n_runs  = int(config.get("n_runs", 1))
    scenario = config.get("scenario", "") or ""
    # Fix 4: configurable inter-step delay for observability
    step_delay_s = float(config.get("step_delay_ms", 300)) / 1000.0
    total_global_steps = n_steps * n_runs

    model = CivicABMModel(
        n_workers=int(config.get("n_workers", 120)),
        n_firms=int(config.get("n_firms", 8)),
        n_households=int(config.get("n_households", 45)),
        job_find_prob=float(config.get("job_find_prob", 0.15)),
        move_prob=float(config.get("move_prob", 0.1)),
        subsidy_pct=float(config.get("subsidy_pct", 0.1)),
        infra_spend=float(config.get("infra_spend", 1000.0)),
        training_budget=float(config.get("training_budget", 500.0)),
        firm_hiring_rate=float(config.get("firm_hiring_rate", 0.3)),
        scenario=scenario,
        seed=config.get("seed"),
    )

    # ── Per-step loop ─────────────────────────────────────────────────────────
    for step in range(n_steps):
        model.step()

        if simulation_id is not None:
            done = seed_idx * n_steps + step + 1

            # V1: _progress written INSIDE loop — visible to concurrent GETs
            _progress[simulation_id] = {
                "status": "running",
                "steps_done": done,
                "total_steps": total_global_steps,
                "pct": round(done / total_global_steps * 100, 1),
            }

            # V1: _live_results written INSIDE loop after every step
            frame = model.datacollector.get_model_vars_dataframe()
            partial_series = {
                col: [float(v) for v in frame[col].tolist()]
                for col in frame.columns
            }
            partial_final = {
                k: float(v[-1]) if v else 0.0
                for k, v in partial_series.items()
            }
            _live_results[simulation_id] = {
                "status": "running",
                "steps_done": done,
                "results": {
                    "n_runs":        n_runs,
                    "n_steps":       done,
                    "mean_by_step":  partial_series,
                    "mean_final":    partial_final,
                },
            }

        # Fix 4: sleep AFTER writing results so the frontend can observe
        # each step before the next one begins.
        # With step_delay_ms=300 and n_steps=20: ~6 seconds total.
        # With polling every 800ms: frontend receives ~2-3 new steps per poll.
        if step_delay_s > 0:
            time.sleep(step_delay_s)

    # ── Final collection after all steps complete ─────────────────────────────
    frame = model.datacollector.get_model_vars_dataframe()
    series = {
        col: [float(v) for v in frame[col].tolist()]
        for col in frame.columns
    }
    final = {
        key: float(values[-1]) if values else 0.0
        for key, values in series.items()
    }

    return {
        "seed":             config.get("seed"),
        "n_steps":          n_steps,
        "metrics_by_step":  series,
        "final_metrics":    final,
    }


def run_abm_multi_seed(
    config: dict,
    simulation_id: str | None = None,
) -> dict:
    """Run multiple seeds and aggregate mean metrics.

    n_runs taken directly from config — no hard floor.
    Called from a background thread (see app.py Fix 1) so it may block freely.
    """
    n_runs  = int(config.get("n_runs", 1))
    n_steps = int(config.get("n_steps", 50))

    if simulation_id is not None:
        _progress[simulation_id] = {
            "status":      "running",
            "steps_done":  0,
            "total_steps": n_steps * n_runs,
            "pct":         0.0,
        }

    runs = []
    for seed in range(n_runs):
        run_config = dict(config)
        run_config["seed"]   = seed
        run_config["n_steps"] = n_steps
        run_config["n_runs"]  = n_runs
        runs.append(
            run_abm_single(run_config, simulation_id=simulation_id, seed_idx=seed)
        )

    # Aggregate means across all seeds
    mean_by_step: Dict[str, list] = {}
    for metric_name in ALL_METRICS:
        try:
            mean_by_step[metric_name] = [
                float(mean(run["metrics_by_step"][metric_name][step] for run in runs))
                for step in range(n_steps)
            ]
        except (KeyError, IndexError):
            mean_by_step[metric_name] = [0.0] * n_steps

    mean_final: dict = {}
    for metric_name in ALL_METRICS:
        try:
            mean_final[metric_name] = float(
                mean(run["final_metrics"][metric_name] for run in runs)
            )
        except (KeyError, IndexError):
            mean_final[metric_name] = 0.0

    result = {
        "n_runs":        n_runs,
        "n_steps":       n_steps,
        "runs":          runs,
        "mean_by_step":  mean_by_step,
        "mean_final":    mean_final,
    }

    if simulation_id is not None:
        _progress[simulation_id] = {
            "status":      "complete",
            "steps_done":  n_steps * n_runs,
            "total_steps": n_steps * n_runs,
            "pct":         100.0,
        }
        _live_results[simulation_id] = {
            "status":     "complete",
            "steps_done": n_steps * n_runs,
            "results":    result,
        }

    return result
