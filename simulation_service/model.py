from mesa import Model
from mesa.datacollection import DataCollector
from agents import CitizenAgent

def compute_avg_satisfaction(model):
    # In Mesa 3.x, model.agents is an AgentSet or list-like
    agent_satisfactions = [a.satisfaction for a in model.agents]
    return sum(agent_satisfactions) / len(agent_satisfactions) if agent_satisfactions else 0

def compute_compliance_rate(model):
    compliant_agents = [a for a in model.agents if a.compliance]
    return len(compliant_agents) / len(model.agents) if model.agents else 0

class CivicModel(Model):
    """
    A model with some number of agents to simulate civic behavior.
    """
    def __init__(self, N=100, strictness=0.5, infra_spending=0, subsidy=0, training_budget=0, job_creation_rate=0.0):
        super().__init__()
        self.num_agents = N
        self.strictness = strictness
        self.infra_spending = infra_spending
        self.subsidy = subsidy
        self.training_budget = training_budget
        self.job_creation_rate = job_creation_rate
        
        self.migrated_count = 0
        self.running = True

        # Create agents
        for i in range(self.num_agents):
            CitizenAgent(self)

        self.datacollector = DataCollector(
            model_reporters={
                "Average Satisfaction": compute_avg_satisfaction,
                "Compliance Rate": compute_compliance_rate,
                "Unemployment Rate": compute_unemployment,
                "Average Income": compute_avg_income,
                "Migration Count": lambda m: m.migrated_count,
            }
        )

    def step(self):
        self.datacollector.collect(self)
        self.agents.shuffle_do("step")

def compute_unemployment(model):
    labor_force = [a for a in model.agents if not a.has_migrated]
    if not labor_force: return 0
    unemployed = [a for a in labor_force if not a.is_employed]
    return len(unemployed) / len(labor_force)

def compute_avg_income(model):
    active_agents = [a for a in model.agents if not a.has_migrated]
    if not active_agents: return 0
    incomes = [a.income for a in active_agents]
    return sum(incomes) / len(incomes)
