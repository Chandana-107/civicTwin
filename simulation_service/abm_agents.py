"""Mesa agent classes for the additive ABM simulation flow."""

from __future__ import annotations

import random
from mesa import Agent


class Worker(Agent):
    """Worker agent with employment state and income dynamics."""

    # Probability of losing a job each step (layoffs / churn / automation).
    JOB_LOSS_PROB: float = 0.05  # 5% per step keeps the market dynamic

    def __init__(self, model, employed: bool | None = None):
        super().__init__(model)
        # Workers start with ~40% unemployed so the ABM begins with a
        # realistic slack labour market and churn keeps it dynamic.
        self.employed = employed if employed is not None else random.random() < 0.60
        self.base_income = random.uniform(900.0, 1300.0)
        self.skill = random.uniform(0.3, 1.0)
        self.income = self.base_income if self.employed else 0.0

    def step(self):
        """Apply layoff churn, then try to find a job, then update income."""
        # ── 1. Layoff / churn phase ──────────────────────────────────────
        # Each employed worker has a small chance of losing their job every
        # step, keeping the labour market dynamic throughout the simulation.
        if self.employed and random.random() < self.JOB_LOSS_PROB:
            self.employed = False

        # ── 2. Job-search phase ──────────────────────────────────────────
        if not self.employed:
            training_boost = min(0.2, self.model.government.training_budget / 10000.0)
            find_prob = min(1.0, self.model.job_find_prob + (0.08 * self.skill) + training_boost)
            if random.random() < find_prob:
                self.employed = True

        # ── 3. Income phase ──────────────────────────────────────────────
        support = self.base_income * self.model.government.subsidy_pct
        infra_bonus = min(0.2, self.model.government.infra_spend / 20000.0)
        self.income = self.base_income * (1 + infra_bonus) if self.employed else support


class Firm(Agent):
    """Firm agent that opens roles and hires unemployed workers.

    ``hiring_rate`` (0–1) controls the probability that any individual
    unemployed worker gets an offer in a given step, preventing the labour
    market from saturating too quickly.
    """

    def __init__(self, model, hiring_rate: float = 0.3):
        super().__init__(model)
        self.openings = random.randint(1, 4)
        self.hiring_rate = hiring_rate

    def step(self):
        """Generate openings and probabilistically hire at most one worker per step."""
        # Firms only open new vacancies occasionally (30% chance per step)
        # to prevent the market from saturating within a few steps.
        if random.random() < 0.30:
            self.openings += 1

        if self.openings <= 0:
            return

        unemployed = [worker for worker in self.model.workers if not worker.employed]
        if not unemployed:
            return

        # Each firm hires at most ONE worker per step via stochastic gate.
        # This prevents firms from clearing the entire queue in a single tick.
        random.shuffle(unemployed)
        for worker in unemployed:
            if random.random() < self.hiring_rate:
                worker.employed = True
                self.openings = max(0, self.openings - 1)
                break  # one hire per firm per step


class Household(Agent):
    """Household agent that can migrate when rent pressure is high."""

    def __init__(self, model, members: list[Worker]):
        super().__init__(model)
        self.members = members
        self.rent = random.uniform(300.0, 650.0)
        self.moved_this_step = False

    def step(self):
        """Move when unaffordable or due to baseline migration probability."""
        total_income = sum(worker.income for worker in self.members)
        affordability_threshold = self.rent * 3.0
        unaffordable = total_income < affordability_threshold

        should_move = (unaffordable and random.random() < 0.55) or (random.random() < self.model.move_prob)
        if should_move:
            self.moved_this_step = True
            self.model.migration_count += 1
            self.rent = max(180.0, self.rent * random.uniform(0.9, 1.06))
        else:
            self.moved_this_step = False


class Government(Agent):
    """Government agent controlling subsidy, infrastructure, and training policy.

    Sets government_spending_multiplier each step based on fiscal policy keywords.
    Infrastructure and environment scores are now owned by InfrastructureAgent
    and EnvironmentAgent respectively — Government no longer writes them directly.
    """

    def __init__(self, model, subsidy_pct: float, infra_spend: float, training_budget: float):
        super().__init__(model)
        self.subsidy_pct = subsidy_pct
        self.infra_spend = infra_spend
        self.training_budget = training_budget

    def step(self):
        """Adjust policy levers and set government_spending_multiplier each step."""
        # ── Labour market response (unchanged from Step A) ───────────────
        unemployment = self.model.unemployment_rate()
        if unemployment > 0.16:
            self.subsidy_pct = min(0.3, self.subsidy_pct + 0.003)
            self.training_budget = min(6000.0, self.training_budget + 15.0)
        else:
            self.subsidy_pct = max(0.02, self.subsidy_pct - 0.001)

        self.infra_spend = max(250.0, self.infra_spend + random.uniform(-30.0, 30.0))

        # ── Fiscal stance: set multiplier read by InfrastructureAgent ────
        # spending_keywords → expansionary fiscal policy
        spending_keywords = [
            "invest", "infrastructure", "education",
            "training", "subsidy", "stimulus", "spending",
        ]
        # austerity_keywords → contractionary fiscal policy
        austerity_keywords = [
            "cut", "austerity", "deregulat",
            "tax cut", "privatise", "privatize",
        ]

        scenario = self.model.scenario.lower()
        if any(kw in scenario for kw in spending_keywords):
            self.model.government_spending_multiplier = 1.6
        elif any(kw in scenario for kw in austerity_keywords):
            self.model.government_spending_multiplier = 0.4
        else:
            self.model.government_spending_multiplier = 1.0

        # NOTE: infrastructure_score and env_score are now written exclusively
        # by InfrastructureAgent.step() and EnvironmentAgent.step().
        # Government no longer touches them directly.


class InfrastructureAgent(Agent):
    """
    Represents the public infrastructure stock of the economy.
    One instance per model. Score reflects cumulative investment
    minus depreciation and demand pressure from employed-worker activity.

    Uses employed-worker count as an activity proxy because Firm agents do
    not track their own headcount in this Mesa 3.x codebase (workers hold
    the employment flag). This is equivalent to counting «active firms» by
    effect.
    """

    DEPRECIATION_RATE  = 0.5   # score points lost per step (wear and tear)
    WORKER_DEMAND_FACTOR = 0.004  # each employed worker adds this much demand pressure
    GOV_INVESTMENT_BASE  = 0.8   # baseline government investment per step

    def __init__(self, model):
        super().__init__(model)
        self.score = 50.0  # starts at 50 out of 100

    def step(self):
        # 1. Count employed workers as an activity proxy for firm demand
        employed_count = sum(1 for w in self.model.workers if w.employed)

        # 2. Demand pressure: more economic activity = more infrastructure strain
        demand_pressure = employed_count * self.WORKER_DEMAND_FACTOR

        # 3. Government investment: scaled by government_spending_multiplier
        gov_investment = (
            self.GOV_INVESTMENT_BASE
            * self.model.government_spending_multiplier
        )

        # 4. Scenario keyword boost: direct infrastructure policy investment
        infra_keywords = [
            "infrastructure", "road", "transport",
            "rail", "bridge", "broadband", "utilities",
        ]
        keyword_boost = 0.6 if any(
            kw in self.model.scenario.lower() for kw in infra_keywords
        ) else 0.0

        # 5. Update score (clamped to [0, 100])
        delta = gov_investment + keyword_boost - self.DEPRECIATION_RATE - demand_pressure
        self.score = max(0.0, min(100.0, self.score + delta))


class EnvironmentAgent(Agent):
    """
    Represents environmental quality (air, water, land).
    One instance per model. Score falls with production activity
    (proxied by employed-worker count) and rises with green policy investment.
    """

    NATURAL_RECOVERY   = 0.1    # slow baseline recovery per step
    PRODUCTION_DAMAGE  = 0.004  # each employed worker damages env by this much

    def __init__(self, model):
        super().__init__(model)
        self.score = 60.0  # starts at 60 out of 100

    def step(self):
        # 1. Count employed workers as production-activity proxy
        employed_count = sum(1 for w in self.model.workers if w.employed)

        # 2. Production damage scales with economic activity
        production_damage = employed_count * self.PRODUCTION_DAMAGE

        # 3. Green policy boost
        green_keywords = [
            "green", "environment", "renewable", "solar",
            "wind", "sustainability", "carbon", "emissions",
            "electric", "clean energy",
        ]
        green_boost = 0.8 if any(
            kw in self.model.scenario.lower() for kw in green_keywords
        ) else 0.0

        # 4. Update score (clamped to [0, 100])
        delta = self.NATURAL_RECOVERY + green_boost - production_damage
        self.score = max(0.0, min(100.0, self.score + delta))
