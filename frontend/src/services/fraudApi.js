import api from '../utils/api';

export async function runFraudDetection() {
  const res = await api.post('/fraud/run');
  return res.data;
}

export async function getFraudFlags() {
  const res = await api.get('/fraud/flags');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getFraudClusters() {
  const res = await api.get('/fraud/clusters');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getFraudLatestRun() {
  const res = await api.get('/fraud/runs/latest');
  return res.data || null;
}

export async function getFraudRuns(limit = 20) {
  try {
    const res = await api.get(`/fraud/runs?limit=${limit}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    // Backward compatible fallback if /fraud/runs not deployed yet
    if (err?.response?.status === 404) {
      const latest = await getFraudLatestRun();
      return latest ? [latest] : [];
    }
    throw err;
  }
}

export async function updateFraudFlagStatus(id, status) {
  const res = await api.patch(`/fraud/flags/${id}`, { status });
  return res.data;
}

export async function fetchFraudBundle() {
  const [flagsRes, clustersRes, latestRes, runsRes] = await Promise.allSettled([
    getFraudFlags(),
    getFraudClusters(),
    getFraudLatestRun(),
    getFraudRuns(20)
  ]);

  const errors = {};
  const flags = flagsRes.status === 'fulfilled' ? flagsRes.value : (errors.flags = 'Failed to load findings', []);
  const clusters = clustersRes.status === 'fulfilled' ? clustersRes.value : (errors.clusters = 'Failed to load clusters', []);
  const latestRun = latestRes.status === 'fulfilled' ? latestRes.value : (errors.latestRun = 'Failed to load latest run', null);
  const runs = runsRes.status === 'fulfilled' ? runsRes.value : (errors.runs = 'Failed to load run history', []);

  return { flags, clusters, latestRun, runs, errors };
}
