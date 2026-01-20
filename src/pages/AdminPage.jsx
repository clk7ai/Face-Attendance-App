import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getAdmins, addAdmin, deleteAdmin } from '../services/authService';
import { getUsers, deleteUser, syncToServer, deleteUsersByEntity, updateUserEntity } from '../services/storageService';
import { Shield, UserPlus, User, AlertTriangle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const AdminPage = () => {
    const navigate = useNavigate();

    // Memoize currentUser to avoid infinite loop in useEffect
    const currentUser = React.useMemo(() => getCurrentUser(), []);

    const [admins, setAdmins] = useState([]);

    // Tabs: 'admins', 'users', 'duplicates'
    const [activeTab, setActiveTab] = useState('admins');

    // Duplicate Management
    const [flaggedUsers, setFlaggedUsers] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    // User Management
    const [allUsers, setAllUsers] = useState([]);

    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [entity, setEntity] = useState('Malkajgiri');
    const [status, setStatus] = useState(null);

    useEffect(() => {
        // Security Check
        if (!currentUser || currentUser.role !== 'super_admin') {
            navigate('/');
            return;
        }
        loadAdmins();
        loadFlaggedUsers();
        loadAllUsers();
    }, [currentUser, navigate]);

    const loadAdmins = async () => {
        setAdmins(await getAdmins() || []);
    };

    const loadFlaggedUsers = () => {
        const users = getUsers() || [];
        const flagged = users.filter(u => u.duplicateOf);
        setFlaggedUsers(flagged);
    };

    const loadAllUsers = () => {
        setAllUsers(getUsers() || []);
    };

    // Retroactive Scan
    const scanForDuplicates = async () => {
        if (isScanning) return;
        setIsScanning(true);
        setStatus({ type: 'info', msg: 'Scanning all users for duplicates...' });

        // Give UI a chance to show loading
        setTimeout(() => {
            try {
                const users = getUsers() || [];
                let foundCount = 0;
                let updatedUsers = [...users];

                // Sort by timestamp to define "original"
                updatedUsers.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

                for (let i = 0; i < updatedUsers.length; i++) {
                    const current = updatedUsers[i];
                    if (current.duplicateOf) continue;

                    for (let j = 0; j < i; j++) {
                        const prev = updatedUsers[j];
                        if (!current.descriptors || !prev.descriptors) continue;

                        // Compare descriptors
                        const d1 = current.descriptors[0];
                        const d2 = prev.descriptors[0];

                        if (d1 && d2) {
                            let sum = 0;
                            for (let k = 0; k < d1.length; k++) {
                                sum += Math.pow(d1[k] - d2[k], 2);
                            }
                            const distance = Math.sqrt(sum);

                            if (distance < 0.45) { // Slightly more lenient
                                current.duplicateOf = prev.name;
                                foundCount++;
                                break;
                            }
                        }
                    }
                }

                if (foundCount > 0) {
                    localStorage.setItem('attendance_app_users_v2', JSON.stringify(updatedUsers));
                    loadFlaggedUsers();
                    setStatus({ type: 'success', msg: `Scan Complete. Found ${foundCount} duplicates.` });
                } else {
                    setStatus({ type: 'success', msg: 'Scan Complete. No duplicates found.' });
                }
            } catch (err) {
                console.error("Scan error:", err);
                setStatus({ type: 'error', msg: 'Scan failed due to an internal error.' });
            } finally {
                setIsScanning(false);
            }
        }, 300);
    };

    const handleResolve = (user, action) => {
        const users = getUsers() || [];
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) return;

        if (action === 'keep') {
            delete users[idx].duplicateOf;
            localStorage.setItem('attendance_app_users_v2', JSON.stringify(users));
            setStatus({ type: 'success', msg: `Marked ${user.name} as valid.` });
        } else if (action === 'delete') {
            users.splice(idx, 1);
            localStorage.setItem('attendance_app_users_v2', JSON.stringify(users));
            setStatus({ type: 'success', msg: `Deleted duplicate user ${user.name}.` });
        }

        // Sync these changes to server immediately
        syncToServer();

        loadFlaggedUsers();
        loadAllUsers();
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
            const success = await deleteUser(userId);
            if (success) {
                setStatus({ type: 'success', msg: 'User deleted successfully.' });
                loadAllUsers();
                loadFlaggedUsers();
            } else {
                setStatus({ type: 'error', msg: 'Failed to delete user.' });
            }
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setStatus({ type: 'error', msg: 'Please fill all fields' });
            return;
        }

        const newAdmin = {
            username,
            password,
            entity,
            role: 'branch_admin'
        };

        const result = await addAdmin(newAdmin);
        if (result.success) {
            setStatus({ type: 'success', msg: `Admin ${username} created!` });
            setUsername('');
            setPassword('');
            loadAdmins();
        } else {
            setStatus({ type: 'error', msg: result.error });
        }
    };

    const [deleteModal, setDeleteModal] = useState(null); // { admin, step: 'confirm' | 'action' }
    const [transferEntity, setTransferEntity] = useState('');

    const initiateDeleteAdmin = (admin) => {
        // Prevent accidental clicks
        if (admin.username === currentUser.username) return;

        // If "All" or special admin, just delete.
        if (admin.entity === 'All') {
            if (window.confirm(`Delete Super Admin "${admin.username}"?`)) {
                deleteAdmin(admin.username);
                loadAdmins();
            }
            return;
        }

        // Open custom modal for Entity processing
        setDeleteModal({ admin, step: 'choice' });
    };

    const confirmDeleteAdmin = async (action) => {
        const { admin } = deleteModal;

        if (action === 'keep_users') {
            // Just delete admin, users stay with old entity name (orphaned entity)
            deleteAdmin(admin.username);
            setStatus({ type: 'success', msg: `Admin deleted. Users remain under "${admin.entity}".` });
        } else if (action === 'delete_users') {
            // Delete admin & all users of that entity
            await deleteUsersByEntity(admin.entity);
            deleteAdmin(admin.username);
            setStatus({ type: 'success', msg: `Admin and all users of "${admin.entity}" deleted.` });
        } else if (action === 'transfer_users') {
            // Check transfer
            if (!transferEntity || transferEntity === admin.entity) {
                setStatus({ type: 'error', msg: 'Please select a different valid entity.' });
                return;
            }
            await updateUserEntity(admin.entity, transferEntity);
            deleteAdmin(admin.username);
            setStatus({ type: 'success', msg: `Admin deleted. Users moved to "${transferEntity}".` });
        }

        setDeleteModal(null);
        setTransferEntity('');
        loadAdmins();
        loadAllUsers();
    };

    return (
        <div className="p-4 max-w-6xl mx-auto pb-20 fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Shield size={32} className="text-primary" />
                    <h2 className="title text-3xl m-0">Admin Console</h2>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'admins' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Admins
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Users ({allUsers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('duplicates')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'duplicates' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'} flex items-center gap-2`}
                    >
                        Duplicates
                        {flaggedUsers.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{flaggedUsers.length}</span>}
                    </button>
                </div>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-300 border border-green-500/20' : status.type === 'error' ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'}`}>
                    {status.type === 'error' ? <XCircle size={18} /> : <AlertTriangle size={18} />}
                    {status.msg}
                </div>
            )}


            {/* Content Switcher */}
            {activeTab === 'duplicates' && (
                <div className={`glass-panel p-6 mb-8 border-l-4 ${flaggedUsers.length > 0 ? 'border-yellow-500' : 'border-green-500/30'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                            {flaggedUsers.length > 0 ? <AlertTriangle className="text-yellow-500" size={20} /> : <CheckCircle className="text-green-500" size={20} />}
                            Duplicate Registrations
                        </h3>
                        <button
                            onClick={scanForDuplicates}
                            disabled={isScanning}
                            className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                        >
                            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                            {isScanning ? 'Scanning...' : 'Scan Existing Users'}
                        </button>
                    </div>

                    {flaggedUsers.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-400 text-sm border-b border-gray-700">
                                        <th className="py-2">New User</th>
                                        <th className="py-2">Entity</th>
                                        <th className="py-2">Conflicts With</th>
                                        <th className="py-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flaggedUsers.map((u, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-3 font-bold text-white">
                                                {u.name}
                                                <div className="text-xs text-gray-500">{new Date(u.timestamp).toLocaleDateString()}</div>
                                            </td>
                                            <td className="py-3 text-sm text-gray-300">{u.entity}</td>
                                            <td className="py-3 text-red-400 font-mono font-bold">
                                                {u.duplicateOf}
                                            </td>
                                            <td className="py-3 flex items-center gap-2">
                                                <button
                                                    onClick={() => handleResolve(u, 'keep')}
                                                    className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded border border-green-500/30 flex items-center gap-1"
                                                >
                                                    <CheckCircle size={12} /> Keep
                                                </button>
                                                <button
                                                    onClick={() => handleResolve(u, 'delete')}
                                                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded border border-red-500/30 flex items-center gap-1"
                                                >
                                                    <XCircle size={12} /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No duplicate registrations detected.</p>
                            <p className="text-xs mt-2">Run a scan to verify existing database.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'users' && (
                <div className="glass-panel p-6">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <User size={20} /> Registered Users Repository
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-400 text-sm border-b border-gray-700">
                                    <th className="py-2">Name</th>
                                    <th className="py-2">ID</th>
                                    <th className="py-2">Entity</th>
                                    <th className="py-2">Registered On</th>
                                    <th className="py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-8 text-gray-500">
                                            No users registered yet.
                                        </td>
                                    </tr>
                                ) : allUsers.map((user, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-3 font-medium text-white flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                                                {user.name.charAt(0)}
                                            </div>
                                            {user.name}
                                        </td>
                                        <td className="py-3 text-xs font-mono text-gray-500">{user.id}</td>
                                        <td className="py-3 text-sm text-gray-300">{user.entity}</td>
                                        <td className="py-3 text-sm text-gray-500">
                                            {user.timestamp ? new Date(user.timestamp).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="py-3">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                title="Delete User"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'admins' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <div className="glass-panel p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <UserPlus size={20} /> Create New Admin
                        </h3>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-black/20 border border-gray-700 rounded p-2 text-white outline-none focus:border-primary"
                                    placeholder="e.g. branch_manager"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-gray-700 rounded p-2 text-white outline-none focus:border-primary"
                                    placeholder="Password"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Entity</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        list="entities"
                                        value={entity}
                                        onChange={(e) => setEntity(e.target.value)}
                                        className="w-full bg-black/20 border border-gray-700 rounded p-2 text-white outline-none focus:border-primary"
                                        placeholder="Enter or select entity"
                                    />
                                    <datalist id="entities">
                                        <option value="Malkajgiri" />
                                        <option value="Manikonda" />
                                    </datalist>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Type a new entity name to create it dynamically.</p>
                            </div>

                            {status && (
                                <div className={`p-3 rounded text-sm ${status.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {status.msg}
                                </div>
                            )}

                            <button className="btn-primary w-full justify-center mt-2">
                                Create Admin
                            </button>
                        </form>
                    </div>

                    {/* List */}
                    <div className="md:col-span-2 glass-panel p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <User size={20} /> Existing Admins
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-400 text-sm border-b border-gray-700">
                                        <th className="py-2">Username</th>
                                        <th className="py-2">Role</th>
                                        <th className="py-2">Entity</th>
                                        <th className="py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map((admin, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-3 font-medium text-white">{admin.username}</td>
                                            <td className="py-3 text-sm text-blue-300">
                                                <span className="px-2 py-1 bg-blue-500/10 rounded">{admin.role}</span>
                                            </td>
                                            <td className="py-3">
                                                {admin.entity === 'All' ?
                                                    <span className="text-yellow-400 font-bold">All Entities</span> :
                                                    <span className="text-gray-300">{admin.entity}</span>
                                                }
                                            </td>
                                            <td className="py-3 text-gray-500 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span>Active</span>
                                                    {currentUser.role === 'super_admin' && admin.username !== currentUser.username && (
                                                        <button
                                                            onClick={() => initiateDeleteAdmin(admin)}
                                                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                            title="Delete Admin"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Admin Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Delete Admin "{deleteModal.admin.username}"</h3>
                        <p className="text-gray-400 mb-6">
                            This admin manages the entity <span className="text-blue-400 font-mono">{deleteModal.admin.entity}</span>.
                            What should happen to the users registered under this entity?
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => confirmDeleteAdmin('keep_users')}
                                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <div className="font-bold text-white">Keep Users</div>
                                    <div className="text-xs text-gray-500">Delete admin only. Users remain under "{deleteModal.admin.entity}".</div>
                                </div>
                                <CheckCircle size={18} className="text-gray-600 group-hover:text-green-500" />
                            </button>

                            <button
                                onClick={() => confirmDeleteAdmin('delete_users')}
                                className="w-full p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-left transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <div className="font-bold text-red-400">Delete Users & Admin</div>
                                    <div className="text-xs text-red-300/70">Permanently remove everyone in this entity.</div>
                                </div>
                                <XCircle size={18} className="text-red-500/50 group-hover:text-red-400" />
                            </button>

                            <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                                <div className="font-bold text-white mb-2">Transfer Users</div>
                                <div className="text-xs text-gray-500 mb-2">Move users to another entity, then delete admin.</div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        list="entities_transfer"
                                        placeholder="Target Entity"
                                        className="flex-1 bg-black/30 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                        value={transferEntity}
                                        onChange={(e) => setTransferEntity(e.target.value)}
                                    />
                                    <datalist id="entities_transfer">
                                        <option value="Malkajgiri" />
                                        <option value="Manikonda" />
                                    </datalist>
                                    <button
                                        onClick={() => confirmDeleteAdmin('transfer_users')}
                                        disabled={!transferEntity}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Transfer
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setDeleteModal(null)}
                            className="mt-6 w-full py-2 text-gray-400 hover:text-white text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
