import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Settings, Database, Mail, Shield, Trash2, Plus, 
  Edit, Eye, EyeOff, Check, X, AlertTriangle, RefreshCw,
  Home, UserPlus, UserMinus, Lock, Unlock, Send, TestTube,
  Calendar, Gift, FileText, Archive, Download, Upload, Save, LogOut, ArrowUp
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
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
  clearSystemCache
} from '../services/api';

const AdminPage = () => {
  const { selectedUser, logout } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        const [statsRes, usersRes, householdsRes] = await Promise.all([
          getSystemStats(),
          getFamilyMembers(),
          getHouseholds()
        ]);

        setStats({
          totalUsers: statsRes.data.total_users || 0,
          activeHouseholds: statsRes.data.active_households || 0,
          totalItems: statsRes.data.total_items || 0,
          systemStatus: statsRes.data.system_status || 'Healthy'
        });
        setUsers(usersRes.data || []);
        setHouseholds(householdsRes.data || []);
        setRecentActivity(statsRes.data.recent_activity || []);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        setError('Failed to load admin dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleQuickAction = async (action) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      switch (action) {
        case 'addUser':
          navigate('/admin?tab=users&action=add');
          break;
        case 'createHousehold':
          const newHousehold = await createHousehold({ name: 'New Household' });
          if (newHousehold.data) {
            setSuccess('Household created successfully');
            setHouseholds([...households, newHousehold.data]);
          }
          break;
        case 'testEmail':
          const emailTest = await testEmailSettings();
          setSuccess(emailTest.data.message || 'Test email sent successfully');
          break;
        case 'createBackup':
          const backup = await createBackup();
          setSuccess('Backup created successfully');
          const backupsRes = await getBackups();
          setBackups(backupsRes.data || []);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Quick action failed:', err);
      setError(err.response?.data?.detail || 'Action failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'households', label: 'Households', icon: Home },
    { id: 'email', label: 'Email Settings', icon: Mail },
    { id: 'migrations', label: 'Database', icon: Database },
    { id: 'backups', label: 'Backups', icon: Archive },
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers.toString()} icon={Users} color="blue" />
        <StatCard title="Active Households" value={stats.activeHouseholds.toString()} icon={Home} color="green" />
        <StatCard title="Total Items" value={stats.totalItems.toString()} icon={Gift} color="purple" />
        <StatCard title="System Status" value={stats.systemStatus} icon={Check} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard title="Recent Activity" icon={FileText}>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    {activity.type === 'user_added' && <UserPlus className="w-4 h-4 text-green-500 mr-2" />}
                    {activity.type === 'household_created' && <Home className="w-4 h-4 text-blue-500 mr-2" />}
                    {activity.type === 'email_sent' && <Mail className="w-4 h-4 text-purple-500 mr-2" />}
                    <span className="text-sm text-gray-700 dark:text-gray-300">{activity.message}</span>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                No recent activity
              </div>
            )}
          </div>
        </AdminCard>

        <AdminCard title="Quick Actions" icon={Settings}>
          <div className="space-y-3">
            <button 
              onClick={() => handleQuickAction('addUser')}
              className="w-full flex items-center justify-center p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add New User
            </button>
            <button 
              onClick={() => handleQuickAction('createHousehold')}
              className="w-full flex items-center justify-center p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              <Home className="w-4 h-4 mr-2" />
              Create Household
            </button>
            <button 
              onClick={() => handleQuickAction('testEmail')}
              className="w-full flex items-center justify-center p-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              <Mail className="w-4 h-4 mr-2" />
              Test Email
            </button>
            <button 
              onClick={() => handleQuickAction('createBackup')}
              className="w-full flex items-center justify-center p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              disabled={isLoading}
            >
              <Archive className="w-4 h-4 mr-2" />
              Create Backup
            </button>
          </div>
        </AdminCard>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center text-red-800 dark:text-red-200">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center text-green-800 dark:text-green-200">
            <Check className="w-5 h-5 mr-2" />
            <span>{success}</span>
          </div>
        </div>
      )}
    </div>
  );

  const UsersTab = () => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
      name: '',
      username: '',
      email: '',
      households: []
    });

    const handleEditUser = (user) => {
      setSelectedUser(user);
      setEditForm({
        name: user.name,
        username: user.username || '',
        email: user.email || '',
        households: user.households || []
      });
      setIsEditing(true);
    };

    const handleDeleteUser = async (userId) => {
      if (!confirm('Are you sure you want to delete this user?')) return;
      
      setIsLoading(true);
      try {
        await deleteFamilyMember(userId);
        setUsers(users.filter(u => u.id !== userId));
        setSuccess('User deleted successfully');
      } catch (err) {
        console.error('Failed to delete user:', err);
        setError(err.response?.data?.detail || 'Failed to delete user');
      } finally {
        setIsLoading(false);
      }
    };

    const handleSaveUser = async () => {
      setIsLoading(true);
      try {
        const response = await updateUserWithAuth(selectedUser.id, editForm);
        const updatedUser = response.data;
        setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSuccess('User updated successfully');
        setIsEditing(false);
      } catch (err) {
        console.error('Failed to update user:', err);
        setError(err.response?.data?.detail || 'Failed to update user');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="User Management" icon={Users}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Family Members</h4>
              <button 
                onClick={() => navigate('/admin?tab=users&action=add')}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Households</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{user.name}</td>
                      <td className="px-6 py-4">{user.username}</td>
                      <td className="px-6 py-4">{user.email}</td>
                      <td className="px-6 py-4">{user.households?.map(h => h.name).join(', ') || 'None'}</td>
                      <td className="px-6 py-4">
                        <span className={`bg-${user.is_active ? 'green' : 'gray'}-100 text-${user.is_active ? 'green' : 'gray'}-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-${user.is_active ? 'green' : 'gray'}-900 dark:text-${user.is_active ? 'green' : 'gray'}-300`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!user.is_admin && (
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </AdminCard>

        {/* Edit User Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit User</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUser}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const HouseholdsTab = () => {
    const [selectedHousehold, setSelectedHousehold] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
      name: '',
      description: ''
    });

    const handleCreateHousehold = async () => {
      setIsLoading(true);
      try {
        const response = await createHousehold({
          name: 'New Household',
          description: 'New household description'
        });
        setHouseholds([...households, response.data]);
        setSuccess('Household created successfully');
      } catch (err) {
        console.error('Failed to create household:', err);
        setError(err.response?.data?.detail || 'Failed to create household');
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
      setIsLoading(true);
      try {
        const response = await updateHousehold(selectedHousehold.id, editForm);
        setHouseholds(households.map(h => h.id === selectedHousehold.id ? response.data : h));
        setSuccess('Household updated successfully');
        setIsEditing(false);
      } catch (err) {
        console.error('Failed to update household:', err);
        setError(err.response?.data?.detail || 'Failed to update household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteHousehold = async (householdId) => {
      if (!confirm('Are you sure you want to delete this household?')) return;
      
      setIsLoading(true);
      try {
        await deleteHousehold(householdId);
        setHouseholds(households.filter(h => h.id !== householdId));
        setSuccess('Household deleted successfully');
      } catch (err) {
        console.error('Failed to delete household:', err);
        setError(err.response?.data?.detail || 'Failed to delete household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleAddUserToHousehold = async (householdId, userId) => {
      setIsLoading(true);
      try {
        await addUserToHousehold(householdId, userId);
        // Refresh households to get updated member list
        const response = await getHouseholds();
        setHouseholds(response.data);
        setSuccess('User added to household successfully');
      } catch (err) {
        console.error('Failed to add user to household:', err);
        setError(err.response?.data?.detail || 'Failed to add user to household');
      } finally {
        setIsLoading(false);
      }
    };

    const handleRemoveUserFromHousehold = async (householdId, userId) => {
      if (!confirm('Are you sure you want to remove this user from the household?')) return;
      
      setIsLoading(true);
      try {
        await removeUserFromHousehold(householdId, userId);
        // Refresh households to get updated member list
        const response = await getHouseholds();
        setHouseholds(response.data);
        setSuccess('User removed from household successfully');
      } catch (err) {
        console.error('Failed to remove user from household:', err);
        setError(err.response?.data?.detail || 'Failed to remove user from household');
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {households.map(household => (
                <div key={household.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-900 dark:text-white">{household.name}</h5>
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                      {household.members?.length || 0} members
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {household.description || 'No description'}
                  </p>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleEditHousehold(household)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteHousehold(household.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdminCard>

        {/* Edit Household Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Household</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Members</label>
                  <div className="space-y-2">
                    {selectedHousehold?.members?.map(member => (
                      <div key={member.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span>{member.name}</span>
                        <button
                          onClick={() => handleRemoveUserFromHousehold(selectedHousehold.id, member.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <select
                      onChange={(e) => handleAddUserToHousehold(selectedHousehold.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                      value=""
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
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveHousehold}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                  >
                    Save Changes
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

    useEffect(() => {
      const fetchEmailData = async () => {
        setIsLoading(true);
        try {
          const [settingsRes, templatesRes] = await Promise.all([
            getEmailSettings(),
            getEmailTemplates()
          ]);
          setEmailSettings(settingsRes.data);
          setEmailTemplates(templatesRes.data);
        } catch (err) {
          console.error('Failed to fetch email data:', err);
          setError(err.response?.data?.detail || 'Failed to load email settings');
        } finally {
          setIsLoading(false);
        }
      };

      fetchEmailData();
    }, []);

    const handleSaveSettings = async () => {
      setIsLoading(true);
      try {
        await updateEmailSettings(emailSettings);
        setSuccess('Email settings updated successfully');
      } catch (err) {
        console.error('Failed to update email settings:', err);
        setError(err.response?.data?.detail || 'Failed to update email settings');
      } finally {
        setIsLoading(false);
      }
    };

    const handleTestEmail = async () => {
      setIsLoading(true);
      try {
        const response = await testEmailSettings();
        setSuccess(response.data.message || 'Test email sent successfully');
      } catch (err) {
        console.error('Failed to send test email:', err);
        setError(err.response?.data?.detail || 'Failed to send test email');
      } finally {
        setIsLoading(false);
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
      if (!selectedTemplate) return;
      
      setIsLoading(true);
      try {
        await updateEmailTemplate(selectedTemplate.name, templateForm);
        setEmailTemplates(templates => 
          templates.map(t => 
            t.name === selectedTemplate.name 
              ? { ...t, ...templateForm }
              : t
          )
        );
        setSuccess('Email template updated successfully');
        setIsEditingTemplate(false);
      } catch (err) {
        console.error('Failed to update email template:', err);
        setError(err.response?.data?.detail || 'Failed to update email template');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <AdminCard title="Email Configuration" icon={Mail}>
          <div className="space-y-4">
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
                />
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button 
                onClick={handleSaveSettings}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </button>
              <button 
                onClick={handleTestEmail}
                className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Test Email
              </button>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Email Templates" icon={FileText}>
          <div className="space-y-3">
            {emailTemplates.map(template => (
              <div key={template.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white">{template.name}</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
                </div>
                <button 
                  onClick={() => handleEditTemplate(template)}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            ))}
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
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsEditingTemplate(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                  >
                    Save Template
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
    const [migrationStatus, setMigrationStatus] = useState('current');
    const [availableMigrations, setAvailableMigrations] = useState([]);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);

    useEffect(() => {
      const fetchMigrations = async () => {
        setIsLoading(true);
        try {
          const response = await getMigrations();
          setAvailableMigrations(response.data.migrations || []);
          setMigrationStatus(response.data.status || 'current');
        } catch (err) {
          console.error('Failed to fetch migrations:', err);
          setError(err.response?.data?.detail || 'Failed to load migrations');
        } finally {
          setIsLoading(false);
        }
      };

      fetchMigrations();
    }, []);

    const handleCheckUpdates = async () => {
      setIsLoading(true);
      try {
        const response = await getMigrations();
        setAvailableMigrations(response.data.migrations || []);
        setMigrationStatus(response.data.status || 'current');
        setSuccess('Migration status checked successfully');
      } catch (err) {
        console.error('Failed to check migrations:', err);
        setError(err.response?.data?.detail || 'Failed to check migrations');
      } finally {
        setIsLoading(false);
      }
    };

    const handleResetMigrations = async () => {
      if (!confirm('Are you sure you want to reset the migration state? This will create a backup first.')) return;
      
      setIsLoading(true);
      try {
        const response = await resetMigrationState();
        if (response.data.success) {
          setSuccess(response.data.message || 'Migration state reset successfully');
          await handleCheckUpdates();
        } else {
          setError(response.data.message || 'Failed to reset migration state');
        }
      } catch (err) {
        console.error('Failed to reset migrations:', err);
        setError(err.response?.data?.detail || 'Failed to reset migrations');
      } finally {
        setIsLoading(false);
      }
    };

    const handleHardReset = async () => {
      if (!confirm('WARNING: This will completely reset the migration state and might require manual intervention. Continue?')) return;
      
      setIsLoading(true);
      try {
        const response = await hardResetMigrations();
        if (response.data.success) {
          setSuccess(response.data.message || 'Migration state hard reset successfully');
          await handleCheckUpdates();
        } else {
          setError(response.data.message || 'Failed to hard reset migration state');
        }
      } catch (err) {
        console.error('Failed to hard reset migrations:', err);
        setError(err.response?.data?.detail || 'Failed to hard reset migrations');
      } finally {
        setIsLoading(false);
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
                <RefreshCw className="w-4 h-4 mr-2" />
                Check for Updates
              </button>
            </div>
            
            {migrationStatus === 'current' ? (
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
                  disabled={isLoading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Migration State
                </button>
                <button 
                  onClick={handleHardReset}
                  className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  disabled={isLoading}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Hard Reset
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
    const [selectedBackup, setSelectedBackup] = useState(null);

    useEffect(() => {
      const fetchBackups = async () => {
        setIsLoading(true);
        try {
          const response = await getBackups();
          setBackupsList(response.data || []);
        } catch (err) {
          console.error('Failed to fetch backups:', err);
          setError(err.response?.data?.detail || 'Failed to load backups');
        } finally {
          setIsLoading(false);
        }
      };

      fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
      setIsLoading(true);
      try {
        const response = await createBackup({ note: backupNote });
        setBackupsList([response.data, ...backupsList]);
        setSuccess('Backup created successfully');
        setIsCreating(false);
        setBackupNote('');
      } catch (err) {
        console.error('Failed to create backup:', err);
        setError(err.response?.data?.detail || 'Failed to create backup');
      } finally {
        setIsLoading(false);
      }
    };

    const handleRestoreBackup = async (backupId) => {
      if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) return;
      
      setIsLoading(true);
      try {
        await restoreBackup(backupId);
        setSuccess('Backup restored successfully');
      } catch (err) {
        console.error('Failed to restore backup:', err);
        setError(err.response?.data?.detail || 'Failed to restore backup');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteBackup = async (backupId) => {
      if (!confirm('Are you sure you want to delete this backup?')) return;
      
      setIsLoading(true);
      try {
        await deleteBackup(backupId);
        setBackupsList(backupsList.filter(b => b.id !== backupId));
        setSuccess('Backup deleted successfully');
      } catch (err) {
        console.error('Failed to delete backup:', err);
        setError(err.response?.data?.detail || 'Failed to delete backup');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDownloadBackup = async (backupId) => {
      setIsLoading(true);
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
        setSuccess('Backup downloaded successfully');
      } catch (err) {
        console.error('Failed to download backup:', err);
        setError(err.response?.data?.detail || 'Failed to download backup');
      } finally {
        setIsLoading(false);
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
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleRestoreBackup(backup.id)}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      title="Restore"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {backupsList.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No backups available
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        {/* Create Backup Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Backup</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backup Note (optional)
                  </label>
                  <textarea
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
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
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateBackup}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                    disabled={isLoading}
                  >
                    Create Backup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SystemTab = () => {
    const [systemStatus, setSystemStatus] = useState({
      version: '',
      uptime: '',
      memory_usage: '',
      disk_usage: '',
      active_users: 0,
      last_backup: '',
      environment: '',
      debug_mode: false
    });
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

    useEffect(() => {
      const fetchSystemInfo = async () => {
        setIsLoading(true);
        try {
          const [statusRes, settingsRes] = await Promise.all([
            getSystemStatus(),
            getSystemSettings()
          ]);
          setSystemStatus(statusRes.data);
          setSystemSettings(settingsRes.data);
        } catch (err) {
          console.error('Failed to fetch system info:', err);
          setError(err.response?.data?.detail || 'Failed to load system information');
        } finally {
          setIsLoading(false);
        }
      };

      fetchSystemInfo();
    }, []);

    const handleRefreshStatus = async () => {
      setIsLoading(true);
      try {
        const response = await getSystemStatus();
        setSystemStatus(response.data);
        setSuccess('System status refreshed');
      } catch (err) {
        console.error('Failed to refresh status:', err);
        setError(err.response?.data?.detail || 'Failed to refresh system status');
      } finally {
        setIsLoading(false);
      }
    };

    const handleEditSettings = () => {
      setEditForm({ ...systemSettings });
      setIsEditingSettings(true);
    };

    const handleSaveSettings = async () => {
      setIsLoading(true);
      try {
        await updateSystemSettings(editForm);
        setSystemSettings(editForm);
        setSuccess('System settings updated successfully');
        setIsEditingSettings(false);
      } catch (err) {
        console.error('Failed to update settings:', err);
        setError(err.response?.data?.detail || 'Failed to update system settings');
      } finally {
        setIsLoading(false);
      }
    };

    const handleMaintenanceMode = async (enabled) => {
      if (!confirm(`Are you sure you want to ${enabled ? 'enable' : 'disable'} maintenance mode?`)) return;
      
      setIsLoading(true);
      try {
        await setMaintenanceMode(enabled);
        setSystemSettings({ ...systemSettings, maintenance_mode: enabled });
        setSuccess(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
      } catch (err) {
        console.error('Failed to update maintenance mode:', err);
        setError(err.response?.data?.detail || 'Failed to update maintenance mode');
      } finally {
        setIsLoading(false);
      }
    };

    const handleClearCache = async () => {
      if (!confirm('Are you sure you want to clear the system cache?')) return;
      
      setIsLoading(true);
      try {
        await clearSystemCache();
        setSuccess('System cache cleared successfully');
      } catch (err) {
        console.error('Failed to clear cache:', err);
        setError(err.response?.data?.detail || 'Failed to clear system cache');
      } finally {
        setIsLoading(false);
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
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Version</h5>
                <p className="text-gray-600 dark:text-gray-400">{systemStatus.version}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Uptime</h5>
                <p className="text-gray-600 dark:text-gray-400">{systemStatus.uptime}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Memory Usage</h5>
                <p className="text-gray-600 dark:text-gray-400">{systemStatus.memory_usage}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Disk Usage</h5>
                <p className="text-gray-600 dark:text-gray-400">{systemStatus.disk_usage}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Active Users</h5>
                <p className="text-gray-600 dark:text-gray-400">{systemStatus.active_users}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Last Backup</h5>
                <p className="text-gray-600 dark:text-gray-400">{systemStatus.last_backup}</p>
              </div>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="System Settings" icon={Settings}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">Configuration</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage system-wide settings and configurations
                </p>
              </div>
              <button 
                onClick={handleEditSettings}
                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Settings
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white">Maintenance Mode</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {systemSettings.maintenance_mode ? 'System is in maintenance mode' : 'System is operating normally'}
                  </p>
                </div>
                <button 
                  onClick={() => handleMaintenanceMode(!systemSettings.maintenance_mode)}
                  className={`px-4 py-2 rounded-lg text-white ${
                    systemSettings.maintenance_mode 
                      ? 'bg-yellow-500 hover:bg-yellow-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {systemSettings.maintenance_mode ? 'Disable' : 'Enable'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white">System Cache</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Clear system cache to free up memory
                  </p>
                </div>
                <button 
                  onClick={handleClearCache}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Edit Settings Modal */}
        {isEditingSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit System Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Debug Mode
                  </label>
                  <select
                    value={editForm.debug_mode ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, debug_mode: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsEditingSettings(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                  >
                    Save Settings
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
      case 'email':
        return <EmailTab />;
      case 'migrations':
        return <MigrationsTab />;
      case 'backups':
        return <BackupsTab />;
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
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