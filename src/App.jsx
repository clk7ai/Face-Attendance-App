import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserPlus, ScanFace, Activity, Info, Users, Clock, Download, Building2, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { loadModels } from './services/faceService';
import { getDailyReport, getUsers, fetchFromServer, syncToServer } from './services/storageService';
import { downloadCSV } from './services/exportService';
import { isAuthenticated, logout } from './services/authService';

import AttendancePage from './pages/AttendancePage';
import RegistrationPage from './pages/RegistrationPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

const NavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';
  const authenticated = isAuthenticated();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show navbar on login page
  if (location.pathname === '/login') return null;

  return (
    <nav className="navbar">
      <div className="nav-logo">
        <Activity className="text-blue-500" />
        <span>FaceGuard</span>
      </div>
      <div className="nav-items">
        <Link to="/" className={isActive('/')}>
          <LayoutDashboard size={18} /> <span className="hidden-sm">Dashboard</span>
        </Link>
        <Link to="/attendance" className={isActive('/attendance')}>
          <ScanFace size={18} /> <span className="hidden-sm">Attendance</span>
        </Link>
        <Link to="/register" className={isActive('/register')}>
          <UserPlus size={18} /> <span className="hidden-sm">Register</span>
        </Link>
        <Link to="/about" className={isActive('/about')}>
          <Info size={18} /> <span className="hidden-sm">About</span>
        </Link>
        {authenticated && (
          <button onClick={handleLogout} className="nav-link" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <LogOut size={18} /> <span className="hidden-sm">Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
};

const Dashboard = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [allReport, setAllReport] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('All');

  const refreshData = useCallback(() => {
    const users = getUsers() || [];
    const rep = getDailyReport() || [];
    setAllUsers(users);
    setAllReport(rep);
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Derived state
  const { filteredReport, stats, chartData } = useMemo(() => {
    let filteredU = allUsers;
    let filteredR = allReport;

    if (selectedBranch !== 'All') {
      filteredU = allUsers.filter(u => u.branch === selectedBranch);
      filteredR = allReport.filter(r => r.branch === selectedBranch);
    }

    const currentStats = {
      users: filteredU.length,
      present: filteredR.length
    };

    // Chart Data
    const statusCounts = { 'Present': 0, 'Checked Out': 0, 'Active': 0 };
    filteredR.forEach(r => {
      statusCounts['Present']++;
      if (r.status === 'Checked Out') statusCounts['Checked Out']++;
      else statusCounts['Active']++;
    });

    const currentChartData = [
      { name: 'Registered', value: filteredU.length, color: '#38bdf8' },
      { name: 'Present', value: filteredR.length, color: '#4ade80' },
      { name: 'Checked Out', value: statusCounts['Checked Out'], color: '#facc15' }
    ];

    return { filteredReport: filteredR, stats: currentStats, chartData: currentChartData };
  }, [allUsers, allReport, selectedBranch]);

  const handleExport = () => {
    const filename = `attendance_${selectedBranch}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filteredReport, filename);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Branch Filter Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="title text-3xl">Dashboard</h2>
        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10">
          <Building2 size={20} className="text-primary" />
          <span className="text-sm font-semibold">Branch:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-black/30 border-none outline-none text-white rounded px-2 py-1 w-32"
          >
            <option value="All">All Status</option>
            <option value="Malkajgiri">Malkajgiri</option>
            <option value="Manikonda">Manikonda</option>
          </select>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="dashboard-grid">
        <div className="glass-panel stat-card">
          <div>
            <div className="stat-label">Registered</div>
            <div className="stat-value text-white">{stats.users}</div>
          </div>
          <div className="p-3 bg-blue-500/20 rounded-full text-blue-400">
            <Users size={24} />
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div>
            <div className="stat-label">Present</div>
            <div className="stat-value text-green-400">{stats.present}</div>
          </div>
          <div className="p-3 bg-green-500/20 rounded-full text-green-400">
            <Clock size={24} />
          </div>
        </div>

        {/* Chart Card */}
        <div className="glass-panel p-4 flex flex-col justify-center h-full min-h-[140px]">
          <span className="stat-label mb-2">Overview</span>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Report Table */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Today's Attendance</h2>
            <span className="text-sm text-gray-400">{new Date().toLocaleDateString()} • {selectedBranch}</span>
          </div>
          <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-2">
            <Download size={16} /> Export CSV
          </button>
        </div>

        {filteredReport.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">No attendance marked for {selectedBranch} yet.</p>
            <Link to="/attendance" className="btn-primary no-underline text-white inline-block">Start Scanning</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-700">
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">Branch</th>
                  <th className="py-3 font-medium">Login Time</th>
                  <th className="py-3 font-medium">Logout Time</th>
                  <th className="py-3 font-medium">Duration</th>
                  <th className="py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredReport.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 font-medium text-white">{row.name}</td>
                    <td className="py-4 text-gray-400 text-sm">{row.branch}</td>
                    <td className="py-4 text-blue-300">{row.loginTime}</td>
                    <td className="py-4 text-orange-300">{row.logoutTime}</td>
                    <td className="py-4 font-mono text-sm">{row.duration}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${row.status === 'Checked Out' ? 'bg-gray-700 text-gray-300' : 'bg-green-500/20 text-green-400'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  useEffect(() => {
    // 1. Load Face Models
    loadModels().then((res) => {
      if (res) {
        console.log("Models loaded successfully");
        setIsModelLoaded(true);
      }
    });

    // 2. Fetch Initial Data from Server
    fetchFromServer();

    // 3. Setup Final Sync on Unload
    const handleUnload = () => {
      syncToServer();
    };
    window.addEventListener('beforeunload', handleUnload);

    // 4. Periodic Sync
    const syncInterval = setInterval(syncToServer, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearInterval(syncInterval);
    };
  }, []);

  return (
    <Router>
      <div className="page-layout">
        <NavBar />
        <main className="main-content">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/register" element={<ProtectedRoute><RegistrationPage isModelLoaded={isModelLoaded} /></ProtectedRoute>} />
            <Route path="/attendance" element={<AttendancePage isModelLoaded={isModelLoaded} />} />
            <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

