"""Runner utilities for additive ABM simulation execution and aggregation."""

from __future__ import annotations

from statistics import mean

try:
    # Package import path
    from .abm_model import CivicABMModel
except ImportError:
    # Direct module import path when running from simulation_service directory
    from abm_model import CivicABMModel


def run_abm_single(config: dict) -> dict:
    """Run one ABM simulation and return per-step and final values."""
    n_steps = int(config.get("n_steps", 50))

    model = CivicABMModel(
        n_workers=int(config.get("n_workers", 120)),
        n_firms=int(config.get("n_firms", 20)),
        n_households=int(config.get("n_households", 45)),
        job_find_prob=float(config.get("job_find_prob", 0.3)),
        move_prob=float(config.get("move_prob", 0.1)),
        subsidy_pct=float(config.get("subsidy_pct", 0.1)),
        infra_spend=float(config.get("infra_spend", 1000.0)),
        training_budget=float(config.get("training_budget", 500.0)),
        seed=config.get("seed"),
    )

    for _ in range(n_steps):
        model.step()

    frame = model.datacollector.get_model_vars_dataframe()
    series = {column: [float(v) for v in frame[column].tolist()] for column in frame.columns}
    final = {key: float(values[-1]) if values else 0.0 for key, values in series.items()}

    return {
        "seed": config.get("seed"),
        "n_steps": n_steps,
        "metrics_by_step": series,
        "final_metrics": final,
    }


def run_abm_multi_seed(config: dict, min_runs: int = 10) -> dict:
    """Run multiple seeds and aggregate mean metrics into JSON-ready output."""
    n_runs = max(min_runs, int(config.get("n_runs", min_runs)))
    n_steps = int(config.get("n_steps", 50))

    runs = []
    for seed in range(n_runs):
        run_config = dict(config)
        run_config["seed"] = seed
        run_config["n_steps"] = n_steps
        runs.append(run_abm_single(run_config))

    metric_names = ["unemployment_rate", "avg_income", "migration_count", "rent_index"]

    mean_by_step = {}
    for metric_name in metric_names:
        mean_by_step[metric_name] = [
            float(mean(run["metrics_by_step"][metric_name][step] for run in runs))
            for step in range(n_steps)
        ]

    mean_final = {
        metric_name: float(mean(run["final_metrics"][metric_name] for run in runs))
        for metric_name in metric_names
    }

    return {
        "n_runs": n_runs,
        "n_steps": n_steps,
        "runs": runs,
        "mean_by_step": mean_by_step,
        "mean_final": mean_final,
    }
