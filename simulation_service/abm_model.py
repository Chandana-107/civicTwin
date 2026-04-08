"""Mesa model implementation for additive ABM simulation endpoints."""

from __future__ import annotations

from mesa import Model
from mesa.datacollection import DataCollector

try:
    # Package import path when imported as simulation_service.abm_model
    from .abm_agents import Firm, Government, Household, Worker
except ImportError:
    # Direct module import path when running from simulation_service directory
    from abm_agents import Firm, Government, Household, Worker


class CivicABMModel(Model):
    """Agent-based civic model with workers, firms, households, and government."""

    def __init__(
        self,
        n_workers: int = 120,
        n_firms: int = 20,
        n_households: int = 45,
        job_find_prob: float = 0.3,
        move_prob: float = 0.1,
        subsidy_pct: float = 0.1,
        infra_spend: float = 1000.0,
        training_budget: float = 500.0,
        seed: int | None = None,
    ):
        super().__init__(seed=seed)

        self.job_find_prob = job_find_prob
        self.move_prob = move_prob
        self.migration_count = 0
        self.rent_index = 1.0

        self.government = Government(
            self,
            subsidy_pct=subsidy_pct,
            infra_spend=infra_spend,
            training_budget=training_budget,
        )

        self.workers: list[Worker] = []
        for _ in range(n_workers):
            worker = Worker(self)
            self.workers.append(worker)

        self.firms: list[Firm] = []
        for _ in range(n_firms):
            firm = Firm(self)
            self.firms.append(firm)

        self.households: list[Household] = []
        household_size = max(1, n_workers // max(1, n_households))
        for idx in range(n_households):
            start = idx * household_size
            end = min(n_workers, start + household_size)
            members = self.workers[start:end] if start < n_workers else []
            if not members and self.workers:
                members = [self.random.choice(self.workers)]
            household = Household(self, members)
            self.households.append(household)

        self.datacollector = DataCollector(
            model_reporters={
                "unemployment_rate": lambda model: model.unemployment_rate(),
                "avg_income": lambda model: model.avg_income(),
                "migration_count": lambda model: model.migration_count,
                "rent_index": lambda model: model.rent_index,
            }
        )

    def unemployment_rate(self) -> float:
        """Fraction of workers currently unemployed."""
        if not self.workers:
            return 0.0
        unemployed = sum(1 for worker in self.workers if not worker.employed)
        return unemployed / len(self.workers)

    def avg_income(self) -> float:
        """Average worker income for the current step."""
        if not self.workers:
            return 0.0
        return sum(worker.income for worker in self.workers) / len(self.workers)

    def _update_rent_index(self):
        """Compute a bounded rent stress index from household affordability."""
        if not self.households:
            self.rent_index = 1.0
            return

        pressure = []
        for household in self.households:
            total_income = sum(worker.income for worker in household.members)
            pressure.append(household.rent / max(1.0, total_income))

        avg_pressure = sum(pressure) / len(pressure)
        self.rent_index = max(0.5, min(2.0, 1.0 + ((avg_pressure - 0.15) * 1.4)))

    def step(self):
        """Advance one time step and collect model-level metrics."""
        # Activate all agents in random order using Mesa's AgentSet API.
        self.agents.shuffle_do("step")
        self._update_rent_index()
        self.datacollector.collect(self)
