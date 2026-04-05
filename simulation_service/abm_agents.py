"""Mesa agent classes for the additive ABM simulation flow."""

from __future__ import annotations

import random
from mesa import Agent


class Worker(Agent):
    """Worker agent with employment state and income dynamics."""

    def __init__(self, model, employed: bool | None = None):
        super().__init__(model)
        self.employed = employed if employed is not None else random.random() < 0.75
        self.base_income = random.uniform(900.0, 1300.0)
        self.skill = random.uniform(0.3, 1.0)
        self.income = self.base_income if self.employed else 0.0

    def step(self):
        """Try to find a job and update income for this step."""
        if not self.employed:
            training_boost = min(0.2, self.model.government.training_budget / 10000.0)
            find_prob = min(1.0, self.model.job_find_prob + (0.08 * self.skill) + training_boost)
            if random.random() < find_prob:
                self.employed = True

        support = self.base_income * self.model.government.subsidy_pct
        infra_bonus = min(0.2, self.model.government.infra_spend / 20000.0)
        self.income = self.base_income * (1 + infra_bonus) if self.employed else support


class Firm(Agent):
    """Firm agent that opens roles and hires unemployed workers."""

    def __init__(self, model):
        super().__init__(model)
        self.openings = random.randint(1, 4)

    def step(self):
        """Generate openings and hire available workers."""
        if random.random() < 0.4:
            self.openings += 1

        unemployed = [worker for worker in self.model.workers if not worker.employed]
        random.shuffle(unemployed)

        hired = 0
        for worker in unemployed:
            if hired >= self.openings:
                break
            worker.employed = True
            hired += 1

        self.openings = max(0, self.openings - hired)


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
    """Government agent controlling subsidy, infrastructure, and training policy."""

    def __init__(self, model, subsidy_pct: float, infra_spend: float, training_budget: float):
        super().__init__(model)
        self.subsidy_pct = subsidy_pct
        self.infra_spend = infra_spend
        self.training_budget = training_budget

    def step(self):
        """Slightly adjust policy levers over time."""
        unemployment = self.model.unemployment_rate()
        if unemployment > 0.16:
            self.subsidy_pct = min(0.3, self.subsidy_pct + 0.003)
            self.training_budget = min(6000.0, self.training_budget + 15.0)
        else:
            self.subsidy_pct = max(0.02, self.subsidy_pct - 0.001)

        self.infra_spend = max(250.0, self.infra_spend + random.uniform(-30.0, 30.0))
