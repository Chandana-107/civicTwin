from mesa import Model, Agent
try:
    m = Model()
    print("Model created.")
    print("Has agents attr:", hasattr(m, 'agents'))
    if hasattr(m, 'agents'):
        print("Agents type:", type(m.agents))
        print("Agents dir:", dir(m.agents))

    class MyAgent(Agent):
        def __init__(self, model):
            super().__init__(model)
            print("Agent init called. Unique ID:", self.unique_id)

    a = MyAgent(m)
    print("Agent created.")
    if hasattr(m, 'agents'):
        print("Agent count:", len(m.agents))
    
except Exception as e:
    print("Error:", e)
