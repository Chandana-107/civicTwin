from mesa import Agent
import random

class CitizenAgent(Agent):
    """
    A citizen agent with economic and social attributes.
    """
    def __init__(self, model):
        super().__init__(model)
        self.satisfaction = random.uniform(0.4, 0.9)
        self.compliance = random.choice([True, False])
        
        # Economic attributes
        self.skill_level = random.uniform(0.1, 1.0) # Affected by training budget
        self.is_employed = random.choice([True, False]) if random.random() > 0.1 else False
        self.income = 0
        self.savings = random.uniform(0, 1000)
        self.has_migrated = False
        
    def step(self):
        if self.has_migrated:
            return

        # 1. Employment Logic
        # Job creation rate increases probability of finding a job
        job_creation = getattr(self.model, 'job_creation_rate', 0.05)
        # Training budget improves skill matching
        training_impact = getattr(self.model, 'training_budget', 0) / 10000.0
        
        if not self.is_employed:
            # Probability to find job depends on skill and job creation
            find_job_prob = (self.skill_level + training_impact) * 0.5 + job_creation
            if random.random() < find_job_prob:
                self.is_employed = True
        
        # 2. Income Logic
        subsidy = getattr(self.model, 'subsidy', 0)
        base_income = 1000 if self.is_employed else 0
        # Infra spending boosts general economy efficiency
        infra_mult = 1.0 + (getattr(self.model, 'infra_spending', 0) / 100000.0)
        
        self.income = (base_income * infra_mult) + subsidy
        self.savings += self.income * 0.1 # Save 10%
        
        # 3. Satisfaction Update
        # strictness lowers satisfaction initially but might improve order long term (ignored for now)
        strictness = getattr(self.model, 'strictness', 0.5)
        
        sat_change = 0
        if self.income > 800: sat_change += 0.02
        if self.is_employed: sat_change += 0.01
        
        if strictness > 0.7: sat_change -= 0.01
        
        self.satisfaction += sat_change
        self.satisfaction = max(0.0, min(1.0, self.satisfaction))

        # 4. Compliance Logic
        if self.satisfaction < 0.3 or (self.income < 200 and strictness < 0.8):
            self.compliance = False
        else:
            self.compliance = True
            
        # 5. Migration Logic (Leaving the city)
        # If unemployed long term or satisfaction very low
        if self.satisfaction < 0.15 and self.savings < 500:
            if random.random() < 0.1:
                self.has_migrated = True
                self.model.migrated_count += 1

