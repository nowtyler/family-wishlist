import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Settings, Database, Mail, Shield, Trash2, Plus, 
  Edit, Eye, EyeOff, Check, X, AlertTriangle, RefreshCw,
  Home, UserPlus, UserMinus, Lock, Unlock, Send, TestTube,
  Calendar, Gift, FileText, Archive, Download, Upload, Save, ArrowUp,
  CheckCircle, XCircle, Database, ExclamationCircle, Cube
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  getFamilyMembers,
  getHouseholds,
  getSystemStats,
  createHousehold,
  testEmailSettings,
  createBackup,
  getBackups,
  getMigrations,
  deleteFamilyMember,
  updateUserWithAuth,
  updateHousehold,
  deleteHousehold,
  addUserToHousehold,
  removeUserFromHousehold,
  getEmailSettings,
  updateEmailSettings,
  getEmailTemplates,
  updateEmailTemplate,
  resetMigrationState,
  hardResetMigrations,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  getSystemStatus,
  getSystemSettings,
  updateSystemSettings,
  setMaintenanceMode,
  clearSystemCache,
  getAllItems,
  deleteItemAsAdmin
} from '../services/api';
import FamilyMemberManager from './admin/FamilyMemberManager';
import Navbar from './Navbar';

const AdminPage = () => {
  const { selectedUser } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data states
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeHouseholds: 0,
    totalItems: 0,
    systemStatus: 'Loading...'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [migrations, setMigrations] = useState([]);
  const [backups, setBackups] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    version: '',
    uptime: '',
    memory_usage: '',
    disk_usage: '',
    active_users: 0,
    last_backup: '',
    environment: '',
    debug_mode: false,
    database_status: '',
    cache_status: ''
  });

  // Check if user is admin
  useEffect(() => {
    if (!selectedUser || !selectedUser.is_admin) {
      navigate('/');
      return;
    }
  }, [selectedUser, navigate]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch stats
        const statsResponse = await getSystemStats();
        setStats(statsResponse.data);

        // Fetch migrations
        const migrationsResponse = await getMigrations();
        setMigrations(migrationsResponse.data.available_migrations || []);

        // Fetch backups
        const backupsResponse = await getBackups();
        setBackups(backupsResponse.data.backups || []);

        // Fetch system status
        const statusResponse = await getSystemStatus();
        setSystemStatus(statusResponse.data);

        // Set users and households for other tabs
        setUsers(familyMembersRes.data || []);
        setHouseholds(householdsRes.data || []);

        // Set recent activity if available
        if (systemStatsRes.data?.recent_activity) {
          setRecentActivity(systemStatsRes.data.recent_activity);
        }
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        toast.error('Failed to load admin dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleQuickAction = async (action) => {
    setIsLoading(true);

    try {
      switch (action) {
        case 'addUser':
          navigate('/admin?tab=users&action=add');
          break;
        case 'createHousehold':
          const newHousehold = await createHousehold({ name: 'New Household' });
          if (newHousehold.data) {
            toast.success('Household created successfully');
            setHouseholds([...households, newHousehold.data]);
          }
          break;
        case 'testEmail':
          const emailTest = await testEmailSettings();
          toast.success(emailTest.data.message || 'Test email sent successfully');
          break;
        case 'createBackup':
          const backup = await createBackup();
          toast.success('Backup created successfully');
          const backupsRes = await getBackups();
          setBackups(backupsRes.data || []);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Quick action failed:', err);
      toast.error(err.response?.data?.detail || 'Action failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'households', label: 'Households', icon: Home },
    { id: 'items', label: 'Items', icon: Gift },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'system', label: 'System', icon: Settings }
  ];

  const AdminCard = ({ title, icon: Icon, children, className = '' }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${className}`}
    >
      <div className="flex items-center mb-4">
        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );

  const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
      <div className="flex items-center">
        <div className={`p-2 bg-${color}-100 dark:bg-${color}-900/30 rounded-lg`}>
          <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );

  const DashboardTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <StatCard
        title="System Status"
        value={systemStatus?.status || "Unknown"}
        icon={systemStatus?.status === "healthy" ? CheckCircle : XCircle}
        color={systemStatus?.status === "healthy" ? "green" : "red"}
      />
      <StatCard
        title="Database Status"
        value={systemStatus?.database_status || "Unknown"}
        icon={systemStatus?.database_status === "connected" ? Database : ExclamationCircle}
        color={systemStatus?.database_status === "connected" ? "blue" : "yellow"}
      />
      <StatCard
        title="Cache Status"
        value={systemStatus?.cache_status || "Unknown"}
        icon={systemStatus?.cache_status === "available" ? Cube : ExclamationCircle}
        color={systemStatus?.cache_status === "available" ? "purple" : "yellow"}
      />
      {/* Add more stat cards as needed */}
    </div>
  );

  const UsersTab = () => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [editMode, setEditMode] = useState('');

    useEffect(() => {
      fetchUsers();
    }, []);

    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await api.getFamilyMembers();
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        toast.error('Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    const handleEditUser = (user) => {
      setSelectedUser(user);
      setEditMode('edit');
      setIsModalOpen(true);
    };

    const handleCloseModal = () => {
      setIsModalOpen(false);
      setSelectedUser(null);
      setEditMode('');
    };

    const handleAddUser = () => {
      setEditMode('add');
      setIsModalOpen(true);
    };

    const handleSaveUser = async (userData) => {
      try {
        setIsLoading(true);
        if (editMode === 'add') {
          await api.createUserWithAuth(userData);
          toast.success('User created successfully');
        } else {
          await api.updateUserWithAuth(selectedUser.id, userData);
          toast.success('User updated successfully');
        }
        await fetchUsers();
        handleCloseModal();
      } catch (error) {
        console.error('Failed to save user:', error);
        toast.error(error.response?.data?.detail || 'Failed to save user');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteUser = async (userId) => {
      if (!confirm('Are you sure you want to delete this user?')) return;
      
      try {
        setIsLoading(true);
        await api.deleteFamilyMember(userId);
        toast.success('User deleted successfully');
        await fetchUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        toast.error(error.response?.data?.detail || 'Failed to delete user');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">User Management</h3>
          <button
            onClick={handleAddUser}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add User
          </button>
        </div>

        {isLoading && !users.length ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.is_admin
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {editMode === 'add' ? 'Add User' : 'Edit User'}
              </h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleSaveUser({
                  username: formData.get('username'),
                  password: formData.get('password'),
                  name: formData.get('name'),
                  email: formData.get('email'),
                  is_admin: formData.get('is_admin') === 'true'
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      defaultValue={selectedUser?.username}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>
                  {editMode === 'add' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                      </label>
                      <input
                        type="password"
                        name="password"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                        required
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={selectedUser?.name}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={selectedUser?.email}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Role
                    </label>
                    <select
                      name="is_admin"
                      defaultValue={selectedUser?.is_admin.toString()}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="false">User</option>
                      <option value="true">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const HouseholdsTab = () => {
    const [households, setHouseholds] = useState([]);
    const [selectedHousehold, setSelectedHousehold] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
      name: '',
      description: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const fetchHouseholds = async () => {
      setIsLoading(true);
      try {
        const response = await getHouseholds();
        setHouseholds(response.data || []);
      } catch (err) {
        console.error('Failed to fetch households:', err);
        toast.error(err.response?.data?.detail || 'Failed to load households');
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      fetchHouseholds();
    }, []);

    const handleCreateHousehold = async () => {
      setIsLoading(true);
      try {
        const response = await createHousehold({
          name: 'New Household',
          description: 'New household description'
        });
        setHouseholds(prevHouseholds => [...prevHouseholds, response.data]);
        toast.success('Household created successfully');
      } catch (err) {
        console.error('Failed to create household:', err);
        toast.error(err.response?.data?.detail || 'Failed to create household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleEditHousehold = (household) => {
      setSelectedHousehold(household);
      setEditForm({
        name: household.name,
        description: household.description || ''
      });
      setIsEditing(true);
    };

    const handleSaveHousehold = async () => {
      if (!selectedHousehold?.id) {
        toast.error('No household selected for editing');
        return;
      }
      
      setIsLoading(true);
      try {
        const response = await updateHousehold(selectedHousehold.id, editForm);
        setHouseholds(prevHouseholds => 
          prevHouseholds.map(h => h.id === selectedHousehold.id ? response.data : h)
        );
        toast.success('Household updated successfully');
        setIsEditing(false);
        setSelectedHousehold(null);
        setEditForm({
          name: '',
          description: ''
        });
      } catch (err) {
        console.error('Failed to update household:', err);
        toast.error(err.response?.data?.detail || 'Failed to update household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteHousehold = async (householdId) => {
      if (!confirm('Are you sure you want to delete this household?')) return;
      
      setIsLoading(true);
      try {
        await deleteHousehold(householdId);
        setHouseholds(prevHouseholds => prevHouseholds.filter(h => h.id !== householdId));
        toast.success('Household deleted successfully');
      } catch (err) {
        console.error('Failed to delete household:', err);
        toast.error(err.response?.data?.detail || 'Failed to delete household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleAddUserToHousehold = async (householdId, userId) => {
      setIsLoading(true);
      try {
        await addUserToHousehold(householdId, userId);
        await fetchHouseholds(); // Refresh the list
        toast.success('User added to household successfully');
      } catch (err) {
        console.error('Failed to add user to household:', err);
        toast.error(err.response?.data?.detail || 'Failed to add user to household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleRemoveUserFromHousehold = async (householdId, userId) => {
      if (!confirm('Are you sure you want to remove this user from the household?')) return;
      
      setIsLoading(true);
      try {
        await removeUserFromHousehold(householdId, userId);
        await fetchHouseholds(); // Refresh the list
        toast.success('User removed from household successfully');
      } catch (err) {
        console.error('Failed to remove user from household:', err);
        toast.error(err.response?.data?.detail || 'Failed to remove user from household');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="Household Management" icon={Home}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Households</h4>
              <button 
                onClick={handleCreateHousehold}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Household
              </button>
            </div>
            
            {isLoading && !households.length ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading households...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {households.map(household => (
                  <div key={household.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900 dark:text-white">{household.name}</h5>
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                        {Array.isArray(household.members) ? household.members.length : 0} members
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {household.description || 'No description'}
                    </p>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditHousehold(household)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        disabled={isLoading}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteHousehold(household.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        disabled={isLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {!households.length && !isLoading && (
                  <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">
                    No households available
                  </div>
                )}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Edit Household Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Household</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Members</label>
                  <div className="space-y-2">
                    {selectedHousehold?.members?.map(member => (
                      <div key={member.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-gray-900 dark:text-white">{member.name}</span>
                        <button
                          onClick={() => handleRemoveUserFromHousehold(selectedHousehold.id, member.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          disabled={isLoading}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddUserToHousehold(selectedHousehold.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      value=""
                      disabled={isLoading}
                    >
                      <option value="">Add member...</option>
                      {users
                        .filter(user => !selectedHousehold?.members?.find(m => m.id === user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveHousehold}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const EmailTab = () => {
    const [emailSettings, setEmailSettings] = useState({
      smtp_server: '',
      smtp_port: '',
      smtp_username: '',
      smtp_password: '',
      use_tls: true,
      from_email: '',
      from_name: ''
    });
    const [emailTemplates, setEmailTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [templateForm, setTemplateForm] = useState({
      subject: '',
      body: ''
    });
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);

    const fetchEmailData = async () => {
      setIsLoadingSettings(true);
      setIsLoadingTemplates(true);
      try {
        const settingsRes = await getEmailSettings();
        setEmailSettings(settingsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
        toast.error('Failed to load email settings');
      } finally {
        setIsLoadingSettings(false);
      }

      try {
        const templatesRes = await getEmailTemplates();
        setEmailTemplates(templatesRes.data || []);
      } catch (err) {
        console.error('Failed to fetch email templates:', err);
        toast.error('Failed to load email templates');
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    useEffect(() => {
      fetchEmailData();
    }, []);

    const handleSaveSettings = async () => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        await updateEmailSettings(emailSettings);
        toast.success('Email settings updated successfully');
      } catch (err) {
        console.error('Failed to update email settings:', err);
        toast.error(err.response?.data?.detail || 'Failed to update email settings');
      } finally {
        setIsSaving(false);
      }
    };

    const handleTestEmail = async () => {
      if (isTestingEmail) return;
      setIsTestingEmail(true);
      try {
        const response = await testEmailSettings();
        toast.success(response.data.message || 'Test email sent successfully');
      } catch (err) {
        console.error('Failed to send test email:', err);
        toast.error(err.response?.data?.detail || 'Failed to send test email');
      } finally {
        setIsTestingEmail(false);
      }
    };

    const handleEditTemplate = (template) => {
      setSelectedTemplate(template);
      setTemplateForm({
        subject: template.subject,
        body: template.body
      });
      setIsEditingTemplate(true);
    };

    const handleSaveTemplate = async () => {
      if (!selectedTemplate || isSaving) return;
      
      setIsSaving(true);
      try {
        await updateEmailTemplate(selectedTemplate.name, templateForm);
        setEmailTemplates(templates => 
          templates.map(t => 
            t.name === selectedTemplate.name 
              ? { ...t, ...templateForm }
              : t
          )
        );
        toast.success('Email template updated successfully');
        setIsEditingTemplate(false);
      } catch (err) {
        console.error('Failed to update email template:', err);
        toast.error(err.response?.data?.detail || 'Failed to update email template');
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="Email Configuration" icon={Mail}>
          <div className="space-y-4">
            {isLoadingSettings ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading email settings...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SMTP Server
                    </label>
                    <input
                      type="text"
                      value={emailSettings.smtp_server}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_server: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="smtp.gmail.com"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={emailSettings.smtp_port}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="587"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={emailSettings.smtp_username}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="your-email@gmail.com"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={emailSettings.smtp_password}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="App password"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={emailSettings.from_email}
                      onChange={(e) => setEmailSettings({ ...emailSettings, from_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="noreply@yourapp.com"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={emailSettings.from_name}
                      onChange={(e) => setEmailSettings({ ...emailSettings, from_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Family Wishlist"
                      disabled={isSaving}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button 
                    onClick={handleSaveSettings}
                    className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleTestEmail}
                    className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    disabled={isTestingEmail}
                  >
                    {isTestingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Email
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </AdminCard>

        <AdminCard title="Email Templates" icon={FileText}>
          <div className="space-y-3">
            {isLoadingTemplates ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading email templates...</p>
              </div>
            ) : (
              <>
                {emailTemplates.length > 0 ? (
                  emailTemplates.map(template => (
                    <div key={template.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">{template.name}</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
                      </div>
                      <button 
                        onClick={() => handleEditTemplate(template)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        disabled={isSaving}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No email templates available
                  </div>
                )}
              </>
            )}
          </div>
        </AdminCard>

        {/* Edit Template Modal */}
        {isEditingTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Edit Template: {selectedTemplate?.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Body (HTML)
                  </label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono"
                    rows={15}
                    disabled={isSaving}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsEditingTemplate(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Template'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const MigrationsTab = () => {
    const [selectedSubTab, setSelectedSubTab] = useState('migrations');
    
    return (
      <div className="space-y-6">
        <AdminCard title="Database Management" icon={Database}>
          <div className="space-y-4">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setSelectedSubTab('migrations')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedSubTab === 'migrations'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Migrations
                </button>
                <button
                  onClick={() => setSelectedSubTab('backups')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedSubTab === 'backups'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Backups
                </button>
              </nav>
            </div>
            
            {selectedSubTab === 'migrations' && <MigrationsSubTab />}
            {selectedSubTab === 'backups' && <BackupsSubTab />}
          </div>
        </AdminCard>
      </div>
    );
  };
  
  const MigrationsSubTab = () => {
    const [migrationStatus, setMigrationStatus] = useState('current');
    const [availableMigrations, setAvailableMigrations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isHardResetting, setIsHardResetting] = useState(false);

    const fetchMigrations = async () => {
      setIsLoading(true);
      try {
        const response = await getMigrations();
        setAvailableMigrations(response.data.migrations || []);
        setMigrationStatus(response.data.status || 'current');
      } catch (err) {
        console.error('Failed to fetch migrations:', err);
        toast.error(err.response?.data?.detail || 'Failed to load migrations');
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      fetchMigrations();
    }, []);

    const handleCheckUpdates = async () => {
      await fetchMigrations();
      toast.success('Migration status checked successfully');
    };

    const handleResetMigrations = async () => {
      if (!confirm('Are you sure you want to reset the migration state? This will create a backup first.')) return;
      
      setIsResetting(true);
      try {
        const response = await resetMigrationState();
        if (response.data.success) {
          toast.success(response.data.message || 'Migration state reset successfully');
          await fetchMigrations();
        } else {
          toast.error(response.data.message || 'Failed to reset migration state');
        }
      } catch (err) {
        console.error('Failed to reset migrations:', err);
        toast.error(err.response?.data?.detail || 'Failed to reset migrations');
      } finally {
        setIsResetting(false);
      }
    };

    const handleHardReset = async () => {
      if (!confirm('WARNING: This will completely reset the migration state and might require manual intervention. Continue?')) return;
      
      setIsHardResetting(true);
      try {
        const response = await hardResetMigrations();
        if (response.data.success) {
          toast.success(response.data.message || 'Migration state hard reset successfully');
          await fetchMigrations();
        } else {
          toast.error(response.data.message || 'Failed to hard reset migration state');
        }
      } catch (err) {
        console.error('Failed to hard reset migrations:', err);
        toast.error(err.response?.data?.detail || 'Failed to hard reset migrations');
      } finally {
        setIsHardResetting(false);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="Database Migrations" icon={Database}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">Current Status</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {migrationStatus === 'current' ? 'Database is up to date' : 'Updates available'}
                </p>
              </div>
              <button 
                onClick={handleCheckUpdates}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Check for Updates
                  </>
                )}
              </button>
            </div>
            
            {isLoading && !availableMigrations.length ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading migration status...</p>
              </div>
            ) : migrationStatus === 'current' ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-green-800 dark:text-green-200">All migrations are up to date</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                    <span className="text-yellow-800 dark:text-yellow-200">Database updates available</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {availableMigrations.map(migration => (
                    <div key={migration.version} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">Version {migration.version}</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{migration.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpgradeMigration(migration.version)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          disabled={isLoading}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Advanced Options</h5>
              <div className="flex space-x-3">
                <button 
                  onClick={handleResetMigrations}
                  className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                  disabled={isResetting || isHardResetting}
                >
                  {isResetting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset Migration State
                    </>
                  )}
                </button>
                <button 
                  onClick={handleHardReset}
                  className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  disabled={isResetting || isHardResetting}
                >
                  {isHardResetting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Hard Resetting...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Hard Reset
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </AdminCard>
      </div>
    );
  };

  const BackupsTab = () => {
    const [backupsList, setBackupsList] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [backupNote, setBackupNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const fetchBackups = async () => {
      setIsLoading(true);
      try {
        const response = await getBackups();
        // Ensure we always have an array
        setBackupsList(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch backups:', err);
        toast.error(err.response?.data?.detail || 'Failed to load backups');
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
      if (isCreating) return;
      setIsCreating(true);
      try {
        const response = await createBackup({ note: backupNote });
        setBackupsList(prevBackups => [response.data, ...prevBackups]);
        toast.success('Backup created successfully');
        setIsCreating(false);
        setBackupNote('');
      } catch (err) {
        console.error('Failed to create backup:', err);
        toast.error(err.response?.data?.detail || 'Failed to create backup');
      } finally {
        setIsCreating(false);
      }
    };

    const handleRestoreBackup = async (backupId) => {
      if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) return;
      
      setIsRestoring(backupId);
      try {
        await restoreBackup(backupId);
        toast.success('Backup restored successfully');
      } catch (err) {
        console.error('Failed to restore backup:', err);
        toast.error(err.response?.data?.detail || 'Failed to restore backup');
      } finally {
        setIsRestoring(null);
      }
    };

    const handleDeleteBackup = async (backupId) => {
      if (!confirm('Are you sure you want to delete this backup?')) return;
      
      setIsDeleting(backupId);
      try {
        await deleteBackup(backupId);
        setBackupsList(prevBackups => prevBackups.filter(b => b.id !== backupId));
        toast.success('Backup deleted successfully');
      } catch (err) {
        console.error('Failed to delete backup:', err);
        toast.error(err.response?.data?.detail || 'Failed to delete backup');
      } finally {
        setIsDeleting(null);
      }
    };

    const handleDownloadBackup = async (backupId) => {
      setIsDownloading(backupId);
      try {
        const response = await downloadBackup(backupId);
        // Create a download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `backup-${backupId}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Backup downloaded successfully');
      } catch (err) {
        console.error('Failed to download backup:', err);
        toast.error(err.response?.data?.detail || 'Failed to download backup');
      } finally {
        setIsDownloading(null);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="Database Backups" icon={Archive}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Backup Management</h4>
              <button 
                onClick={() => setIsCreating(true)}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Backup
              </button>
            </div>

            {isLoading && !backupsList.length ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading backups...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backupsList.map(backup => (
                  <div key={backup.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {new Date(backup.created_at).toLocaleString()}
                        </h5>
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                          {backup.size}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {backup.note || 'No description'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleDownloadBackup(backup.id)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        disabled={isDownloading === backup.id}
                        title="Download"
                      >
                        {isDownloading === backup.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      <button 
                        onClick={() => handleRestoreBackup(backup.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        disabled={isRestoring === backup.id}
                        title="Restore"
                      >
                        {isRestoring === backup.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button 
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        disabled={isDeleting === backup.id}
                        title="Delete"
                      >
                        {isDeleting === backup.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                {!backupsList.length && !isLoading && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No backups available
                  </div>
                )}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Create Backup Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Backup</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backup Note (optional)
                  </label>
                  <textarea
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    rows={3}
                    placeholder="Add a note to help identify this backup later..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setBackupNote('');
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateBackup}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center transition-colors"
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      'Create Backup'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ItemsTab = () => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
      const fetchItems = async () => {
        setIsLoading(true);
        try {
          const response = await getAllItems();
          setItems(response.data || []);
        } catch (err) {
          console.error('Failed to fetch items:', err);
          toast.error(err.response?.data?.detail || 'Failed to load items');
        } finally {
          setIsLoading(false);
        }
      };

      fetchItems();
    }, []);

    const handleDeleteItem = async (itemId) => {
      if (!confirm('Are you sure you want to delete this item?')) return;
      
      setIsLoading(true);
      try {
        await deleteItemAsAdmin(itemId);
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
        toast.success('Item deleted successfully');
      } catch (err) {
        console.error('Failed to delete item:', err);
        toast.error(err.response?.data?.detail || 'Failed to delete item');
      } finally {
        setIsLoading(false);
      }
    };

    const filteredItems = items.filter(item =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.households.some(h => h.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="space-y-6">
        <AdminCard title="Items Management" icon={Gift}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">All Wishlist Items</h4>
              <input
                type="text"
                placeholder="Search items, owners, or households..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {isLoading && !items.length ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading items...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Owner</th>
                      <th className="px-6 py-3">Households</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Priority</th>
                      <th className="px-6 py-3">Price</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div>
                            <div className="font-semibold">{item.title}</div>
                            {item.description && (
                              <div className="text-xs text-gray-500 truncate max-w-xs">
                                {item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">{item.owner_name}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {item.households.map((household, index) => (
                              <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                                {household}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`bg-${item.is_purchased ? 'green' : 'gray'}-100 text-${item.is_purchased ? 'green' : 'gray'}-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-${item.is_purchased ? 'green' : 'gray'}-900 dark:text-${item.is_purchased ? 'green' : 'gray'}-300`}>
                            {item.is_purchased ? `Purchased${item.purchased_by ? ` by ${item.purchased_by}` : ''}` : 'Available'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.priority === 2 ? 'bg-red-100 text-red-800' :
                            item.priority === 1 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {item.priority === 2 ? 'High' : item.priority === 1 ? 'Medium' : 'Low'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {item.price ? `$${(item.price / 100).toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No items match your search.' : 'No items found.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </AdminCard>
      </div>
    );
  };

  const SystemTab = () => {
    const [systemSettings, setSystemSettings] = useState({
      maintenance_mode: false,
      debug_mode: false,
      log_level: 'info',
      max_upload_size: '5MB',
      session_timeout: '24h',
      backup_retention_days: 30
    });
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);

    const fetchSystemInfo = async () => {
      setIsLoadingStatus(true);
      setIsLoadingSettings(true);
      try {
        const statusRes = await getSystemStatus();
        setSystemStatus(statusRes.data || {});
      } catch (err) {
        console.error('Failed to fetch system status:', err);
        toast.error('Failed to load system status');
      } finally {
        setIsLoadingStatus(false);
      }

      try {
        const settingsRes = await getSystemSettings();
        setSystemSettings(settingsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch system settings:', err);
        toast.error('Failed to load system settings');
      } finally {
        setIsLoadingSettings(false);
      }
    };

    useEffect(() => {
      fetchSystemInfo();
    }, []);

    const handleRefreshStatus = async () => {
      await fetchSystemInfo();
      toast.success('System status refreshed');
    };

    const handleEditSettings = () => {
      setEditForm({ ...systemSettings });
      setIsEditingSettings(true);
    };

    const handleSaveSettings = async () => {
      setIsSavingSettings(true);
      try {
        await updateSystemSettings(editForm);
        setSystemSettings(editForm);
        toast.success('System settings updated successfully');
        setIsEditingSettings(false);
      } catch (err) {
        console.error('Failed to update settings:', err);
        toast.error(err.response?.data?.detail || 'Failed to update system settings');
      } finally {
        setIsSavingSettings(false);
      }
    };

    const handleMaintenanceMode = async (enabled) => {
      if (!confirm(`Are you sure you want to ${enabled ? 'enable' : 'disable'} maintenance mode?`)) return;
      
      setIsTogglingMaintenance(true);
      try {
        await setMaintenanceMode(enabled);
        setSystemSettings(prev => ({ ...prev, maintenance_mode: enabled }));
        toast.success(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
      } catch (err) {
        console.error('Failed to update maintenance mode:', err);
        toast.error(err.response?.data?.detail || 'Failed to update maintenance mode');
      } finally {
        setIsTogglingMaintenance(false);
      }
    };

    const handleClearCache = async () => {
      if (!confirm('Are you sure you want to clear the system cache?')) return;
      
      setIsClearingCache(true);
      try {
        await clearSystemCache();
        toast.success('System cache cleared successfully');
      } catch (err) {
        console.error('Failed to clear cache:', err);
        toast.error(err.response?.data?.detail || 'Failed to clear system cache');
      } finally {
        setIsClearingCache(false);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="System Status" icon={Settings}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">System Information</h4>
              <button 
                onClick={handleRefreshStatus}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                disabled={isLoadingStatus}
              >
                {isLoadingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </>
                )}
              </button>
            </div>

            {isLoadingStatus ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading system status...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(systemStatus).map(([key, value]) => (
                  <div key={key} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                      {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </h5>
                    <p className="text-gray-600 dark:text-gray-400">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value.toString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminCard>

        <AdminCard title="System Settings" icon={Settings}>
          <div className="space-y-4">
            {isLoadingSettings ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading system settings...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">Configuration</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Manage system-wide settings and configurations
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => handleMaintenanceMode(!systemSettings.maintenance_mode)}
                      className={`flex items-center px-4 py-2 ${
                        systemSettings.maintenance_mode 
                          ? 'bg-yellow-500 hover:bg-yellow-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      } text-white rounded-lg transition-colors`}
                      disabled={isTogglingMaintenance}
                    >
                      {isTogglingMaintenance ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          {systemSettings.maintenance_mode ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                          {systemSettings.maintenance_mode ? 'Disable Maintenance' : 'Enable Maintenance'}
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleClearCache}
                      className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      disabled={isClearingCache}
                    >
                      {isClearingCache ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Clearing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear Cache
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleEditSettings}
                      className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Settings
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(systemSettings).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value.toString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </AdminCard>

        {/* Edit Settings Modal */}
        {isEditingSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit System Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Debug Mode
                  </label>
                  <select
                    value={editForm.debug_mode ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, debug_mode: e.target.value === 'true' })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isSavingSettings}
                  >
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Log Level
                  </label>
                  <select
                    value={editForm.log_level}
                    onChange={(e) => setEditForm({ ...editForm, log_level: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isSavingSettings}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Upload Size
                  </label>
                  <input
                    type="text"
                    value={editForm.max_upload_size}
                    onChange={(e) => setEditForm({ ...editForm, max_upload_size: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isSavingSettings}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Session Timeout
                  </label>
                  <input
                    type="text"
                    value={editForm.session_timeout}
                    onChange={(e) => setEditForm({ ...editForm, session_timeout: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isSavingSettings}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backup Retention (days)
                  </label>
                  <input
                    type="number"
                    value={editForm.backup_retention_days}
                    onChange={(e) => setEditForm({ ...editForm, backup_retention_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    disabled={isSavingSettings}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsEditingSettings(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    disabled={isSavingSettings}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center transition-colors"
                    disabled={isSavingSettings}
                  >
                    {isSavingSettings ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'users':
        return <UsersTab />;
      case 'households':
        return <HouseholdsTab />;
      case 'items':
        return <ItemsTab />;
      case 'email':
        return <EmailTab />;
      case 'database':
        return <MigrationsTab />;
      case 'system':
        return <SystemTab />;
      default:
        return <DashboardTab />;
    }
  };

  if (!selectedUser || !selectedUser.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-2 px-2 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminPage; 