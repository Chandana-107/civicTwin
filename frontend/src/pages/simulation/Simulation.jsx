import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Simulation = () => {
    const [config, setConfig] = useState({
        N: 100,
        strictness: 0.5,
        steps: 20,
        infra_spending: 50000,
        subsidy: 0,
        training_budget: 0,
        job_creation_rate: 0.05,
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [simulationId, setSimulationId] = useState(null);
    const [results, setResults] = useState(null);
    const [status, setStatus] = useState('idle');

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: type === 'number' || type === 'range' ? parseFloat(value) : value
        }));
    };

    const startSimulation = async () => {
        setLoading(true);
        setStatus('running');
        setResults(null);
        try {
            const simulationApiUrl = import.meta.env.VITE_SIMULATION_API_URL;
            const response = await axios.post(`${simulationApiUrl}/simulate`, config);
            setSimulationId(response.data.simulation_id);
            toast.success('Simulation started!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to start simulation');
            setLoading(false);
            setStatus('error');
        }
    };

    useEffect(() => {
        let interval;
        if (simulationId && status === 'running') {
            interval = setInterval(async () => {
                try {
                    const simulationApiUrl = import.meta.env.VITE_SIMULATION_API_URL;
                    const response = await axios.get(`${simulationApiUrl}/results/${simulationId}`);
                    const data = response.data;
                    if (data.status === 'completed') {
                        setResults(data.results);
                        setStatus('completed');
                        setLoading(false);
                        toast.success('Simulation completed!');
                        clearInterval(interval);
                    } else if (data.status === 'failed') {
                        setStatus('failed');
                        setLoading(false);
                        toast.error(`Simulation failed: ${data.error}`);
                        clearInterval(interval);
                    }
                } catch (error) {
                    console.error("Polling error", error);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [simulationId, status]);

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <Toaster />
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>New Policy Simulation</h2>

                <div className="form-group">
                    <label className="form-label">Number of Agents (N)</label>
                    <input
                        type="number"
                        name="N"
                        value={config.N}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Scenario Description</label>
                    <textarea
                        name="description"
                        value={config.description}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="e.g. 'Invest heavily in infrastructure and education to boost jobs'"
                        rows={3}
                    />
                    <small style={{ color: 'var(--text-secondary)' }}>
                        AI will automatically adjust policy parameters based on your description.
                    </small>
                </div>

                <div className="form-group">
                    <label className="form-label">Simulation Steps</label>
                    <input type="number" name="steps" value={config.steps} onChange={handleChange} className="form-input" />
                </div>

                <button
                    onClick={startSimulation}
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%' }}
                >
                    {loading ? <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'white', margin: '0 auto' }}></div> : 'Run Simulation'}
                </button>
            </div>

            {results && (
                <div className="card" style={{ marginTop: '2rem', maxWidth: '800px', margin: '2rem auto' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--primary-dark)' }}>Simulation Results</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: 'var(--light-bg)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <h4>Unemployment</h4>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>
                                {results['Unemployment Rate'] ? (results['Unemployment Rate'][results['Unemployment Rate'].length - 1] * 100).toFixed(1) + '%' : 'N/A'}
                            </p>
                        </div>
                        <div style={{ background: 'var(--light-bg)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <h4>Avg Income</h4>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                                ₹{results['Average Income'] ? results['Average Income'][results['Average Income'].length - 1].toFixed(0) : 'N/A'}
                            </p>
                        </div>
                        <div style={{ background: 'var(--light-bg)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <h4>Migration</h4>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
                                {results['Migration Count'] ? results['Migration Count'][results['Migration Count'].length - 1] : 'N/A'}
                            </p>
                        </div>
                        <div style={{ background: 'var(--light-bg)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <h4>Compliance</h4>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                {results['Compliance Rate'] ? (results['Compliance Rate'][results['Compliance Rate'].length - 1] * 100).toFixed(1) + '%' : 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Economic Trends</h4>

                        {/* Dynamic Summary Box */}
                        <div style={{
                            background: '#f0f9ff',
                            borderLeft: '4px solid var(--primary-color)',
                            padding: '1rem',
                            marginBottom: '1rem',
                            borderRadius: '0.25rem'
                        }}>
                            <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-dark)' }}>Analysis</h5>
                            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                                {(() => {
                                    const incomes = results['Average Income'];
                                    const unemployment = results['Unemployment Rate'];
                                    if (!incomes || !unemployment) return "Insufficient data for analysis.";

                                    const startInc = incomes[0];
                                    const endInc = incomes[incomes.length - 1];
                                    const incChange = ((endInc - startInc) / startInc * 100).toFixed(1);

                                    const startUnemp = unemployment[0];
                                    const endUnemp = unemployment[unemployment.length - 1];
                                    const unempChange = ((endUnemp - startUnemp) * 100).toFixed(1); // percentage point change logic is complex, simpler to just say dropped/rose

                                    let summary = `Over the course of ${config.steps} steps, average income ${Number(incChange) >= 0 ? 'increased' : 'decreased'} by ${Math.abs(incChange)}%. `;

                                    if (endUnemp < startUnemp) {
                                        summary += `Unemployment successfully fell from ${(startUnemp * 100).toFixed(1)}% to ${(endUnemp * 100).toFixed(1)}%. `;
                                    } else if (endUnemp > startUnemp) {
                                        summary += `However, unemployment rose to ${(endUnemp * 100).toFixed(1)}%. `;
                                    } else {
                                        summary += `Unemployment remained stable at ${(endUnemp * 100).toFixed(1)}%. `;
                                    }

                                    if (endInc > 1500 && endUnemp < 0.05) {
                                        summary += "This policy appears highly effective for economic growth.";
                                    } else if (endUnemp > 0.15) {
                                        summary += "Warning: High unemployment persists. Consider increasing job creation or training.";
                                    }

                                    return summary;
                                })()}
                            </p>
                        </div>

                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer>
                                <LineChart
                                    data={results['Average Income'].map((val, idx) => ({
                                        step: idx,
                                        income: val,
                                        unemployment: results['Unemployment Rate'][idx] * 10000 // Scale for visibility
                                    }))}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="step" />
                                    <YAxis yAxisId="left" label={{ value: 'Income (₹)', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Unemployment (Scaled)', angle: 90, position: 'insideRight' }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line yAxisId="left" type="monotone" dataKey="income" name="Avg Income" stroke="var(--success-color)" />
                                    <Line yAxisId="right" type="monotone" dataKey="unemployment" name="Unemployment Index" stroke="var(--danger-color)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Simulation;
