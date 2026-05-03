"""Mesa model implementation for additive ABM simulation endpoints."""

from __future__ import annotations

from mesa import Model
from mesa.datacollection import DataCollector

try:
    # Package import path when imported as simulation_service.abm_model
    from .abm_agents import (
        Firm, Government, Household, Worker,
        InfrastructureAgent, EnvironmentAgent,
    )
except ImportError:
    # Direct module import path when running from simulation_service directory
    from abm_agents import (
        Firm, Government, Household, Worker,
        InfrastructureAgent, EnvironmentAgent,
    )


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
        firm_hiring_rate: float = 0.3,
        scenario: str = '',
        seed: int | None = None,
    ):
        super().__init__(seed=seed)

        self.job_find_prob = job_find_prob
        self.move_prob = move_prob
        self.firm_hiring_rate = firm_hiring_rate
        self.migration_count = 0
        self.rent_index = 1.0

        # Scenario string — read by Government, InfrastructureAgent,
        # EnvironmentAgent each step.
        self.scenario = scenario or ''

        # Government fiscal stance multiplier — set by Government.step(),
        # read by InfrastructureAgent.step().
        self.government_spending_multiplier = 1.0

        # ── Create Government first (Worker.step() references it) ────────
        self.government = Government(
            self,
            subsidy_pct=subsidy_pct,
            infra_spend=infra_spend,
            training_budget=training_budget,
        )

        # ── Workers ──────────────────────────────────────────────────────
        self.workers: list[Worker] = []
        for _ in range(n_workers):
            worker = Worker(self)
            self.workers.append(worker)

        # ── Firms ────────────────────────────────────────────────────────
        self.firms: list[Firm] = []
        for _ in range(n_firms):
            firm = Firm(self, hiring_rate=self.firm_hiring_rate)
            self.firms.append(firm)

        # ── Households ──────────────────────────────────────────────────
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

        # ── Infrastructure and Environment singleton agents ──────────────
        self.infra_agent = InfrastructureAgent(self)
        self.env_agent   = EnvironmentAgent(self)

        # ── DataCollector ────────────────────────────────────────────────
        # infrastructure_score and env_score now read from the singleton
        # agent instances, NOT from model-level attributes.
        self.datacollector = DataCollector(
            model_reporters={
                "unemployment_rate":    lambda model: model.unemployment_rate(),
                "avg_income":           lambda model: model.avg_income(),
                "migration_count":      lambda model: model.migration_count,
                "rent_index":           lambda model: model.rent_index,
                "avg_welfare":          lambda model: model.avg_welfare(),
                "infrastructure_score": lambda model: next(
                    (a.score for a in model.agents
                     if isinstance(a, InfrastructureAgent)), 50.0
                ),
                "env_score": lambda model: next(
                    (a.score for a in model.agents
                     if isinstance(a, EnvironmentAgent)), 60.0
                ),
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

    def avg_welfare(self) -> float:
        """Welfare index in [0, 1]: combines employment rate and normalised income."""
        if not self.workers:
            return 0.0
        employment_rate = 1.0 - self.unemployment_rate()
        # Normalise average income to a 0-1 scale anchored at 1200 base income.
        income_score = min(1.0, self.avg_income() / 1500.0)
        return round((employment_rate * 0.6) + (income_score * 0.4), 4)

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
        """Advance one time step and collect model-level metrics.

        Activation order is intentionally fixed to enforce the causal chain:

          Phase 1 — Government
            Sets government_spending_multiplier for the current tick based on
            the scenario string and labour-market conditions.  Must run first so
            the multiplier is visible to all downstream agents in the same step.

          Phase 2 — Infrastructure & Environment
            Read government_spending_multiplier (just set) and employed-worker
            counts (from the previous tick — Workers haven't stepped yet).
            Running these before Workers ensures a consistent activity snapshot.

          Phase 3 — Workers, Firms, Households  (shuffled within the group)
            Intra-group order is randomised to avoid position-bias artefacts,
            but all three run after Policy and Infrastructure agents so their
            employment/income state does not feed back into infra/env scores
            until the *next* tick.
        """
        # ── Phase 1: fiscal policy ────────────────────────────────────────
        self.government.step()

        # ── Phase 2: infrastructure and environment ───────────────────────
        # Both read government_spending_multiplier (set above) and the
        # previous tick's employed-worker count. Order between the two
        # singleton agents does not matter — they don't interact with each
        # other — but both must come before Workers change employment state.
        self.infra_agent.step()
        self.env_agent.step()

        # ── Phase 3: workers, firms, households (shuffled) ───────────────
        # Build a combined list and shuffle to preserve stochasticity within
        # the labour-market agents without affecting the policy → infra causal
        # chain established by Phases 1 and 2.
        labour_agents = list(self.workers) + list(self.firms) + list(self.households)
        self.random.shuffle(labour_agents)
        for agent in labour_agents:
            agent.step()

        self._update_rent_index()
        self.datacollector.collect(self)
