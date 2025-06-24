import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Settings, Mail, Shield, Trash2, Plus, 
  Edit, Eye, EyeOff, Check, X, TriangleAlert, RefreshCw,
  Home, UserPlus, UserMinus, Lock, Unlock, Send, TestTube,
  Calendar, Gift, FileText, Archive, Download, Upload, Save, ArrowUp,
  CircleCheck, CircleX, Database, CircleAlert, Box, RotateCcw,
  AlertOctagon, Menu
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatDateEST } from '../utils/dateUtils';
import { 
  getFamilyMembers,
  getHouseholds,
  getHouseholdsWithMembers,
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
  createEmailTemplate,
  deleteEmailTemplate,
  resetMigrationState,
  hardResetMigrations,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  getSystemStatus,
  getDatabaseVersion,
  updateSystemSettings,
  setMaintenanceMode,
  clearSystemCache,
  getAllItems,
  deleteItemAsAdmin,
  clearAllWishlists
} from '../services/api';
import FamilyMemberManager from './admin/FamilyMemberManager';
import Navbar from './Navbar';
import MigrationManager from './admin/MigrationManager';
import EmergencyTokenManager from './admin/EmergencyTokenManager';
import AuthLogViewer from './admin/AuthLogViewer';
import EnhancedUpcomingEventsBanner from './EnhancedUpcomingEventsBanner';

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
  const [systemStatus, setSystemStatus] = useState({
    version: '',
    uptime: '',
    memory_usage: '',
    disk_usage: '',
    active_users: 0,
    last_backup: '',
    environment: '',
    database_status: '',
    database_size_kb: 0
  });
  const [databaseVersion, setDatabaseVersion] = useState('unknown');
  const [systemSettings, setSystemSettings] = useState({
    maintenance_mode: false,
    max_upload_size: '5MB',
    session_timeout: '24h',
    backup_retention_days: 30
  });

  // Check if user is admin or not
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
        // Fetch all data in parallel
        const [
          statsResponse,
          statusResponse,
          familyMembersResponse,
          householdsResponse,
          databaseVersionResponse
        ] = await Promise.all([
          getSystemStats(),
          getSystemStatus(),
          getFamilyMembers(),
          getHouseholdsWithMembers(),
          getDatabaseVersion()
        ]);

        // Set the state with the responses
        setStats(statsResponse.data || {});
        setSystemStatus(statusResponse.data || {});
        setUsers(familyMembersResponse.data || []);
        setHouseholds(householdsResponse.data || []);
        setDatabaseVersion(databaseVersionResponse.data?.current_version || 'unknown');

        // Set recent activity if available
        if (statsResponse.data?.recent_activity) {
          setRecentActivity(statsResponse.data.recent_activity);
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
    <div className="space-y-6">
      {/* System Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="System Status"
          value={systemStatus?.status || "Unknown"}
          icon={systemStatus?.status === "healthy" ? CircleCheck : CircleX}
          color={systemStatus?.status === "healthy" ? "green" : "red"}
        />
        <StatCard
          title="Last Backup"
          value={systemStatus?.last_backup ? formatDateEST(systemStatus.last_backup) : "Never"}
          icon={Archive}
          color="blue"
        />
        <StatCard
          title="Database Size"
          value={`${systemStatus?.database_size_kb || 0} KB`}
          icon={Database}
          color="purple"
        />
      </div>

      {/* Enhanced Upcoming Events Banner - Shows all users' events */}
      {users.length > 0 && (
        <div className="mt-8">
          <EnhancedUpcomingEventsBanner familyMembers={users} />
        </div>
      )}
    </div>
  );

  const UsersTab = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { refreshFamilyMembers } = useAppContext();

    const handleAddUser = () => {
      setIsModalOpen(true);
    };

    const handleCloseModal = () => {
      setIsModalOpen(false);
      // Refresh both local state and global family members data
      const fetchData = async () => {
        try {
          const response = await getFamilyMembers();
          setUsers(response.data || []);
          // Also refresh the global family members state
          await refreshFamilyMembers();
        } catch (err) {
          console.error('Failed to fetch users:', err);
          toast.error('Failed to load users');
        }
      };
      fetchData();
    };

    // Get households for a specific user
    const getUserHouseholds = (userId) => {
      return households.filter(household => 
        household.members?.some(member => member.id === userId)
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Users</h2>
            <button 
            onClick={handleAddUser}
            className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            Manage
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => {
            return (
              <div
                key={user.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{user.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.email || 'No email'}
                    </p>
                  </div>
                  {user.is_admin && (
                    <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      Admin
                    </span>
                  )}
                </div>
                
                {/* Household Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Households ({user.household_count || 0})
                  </h4>
                  {user.household_count > 0 ? (
                    <div className="space-y-1">
                      {getUserHouseholds(user.id).map(household => (
                        <div key={household.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {household.name}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500">
                            {household.member_count || 0} members
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Not in any households
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Use the FamilyMemberManager modal */}
        <FamilyMemberManager
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </div>
    );
  };

  const HouseholdsTab = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedHousehold, setSelectedHousehold] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState('');
    const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);
    const [selectedUsersToRemove, setSelectedUsersToRemove] = useState([]);

    const fetchHouseholds = async () => {
      setIsLoading(true);
      try {
        const response = await getHouseholdsWithMembers();
        setHouseholds(response.data || []);
      } catch (err) {
        console.error('Failed to fetch households:', err);
        toast.error(err.response?.data?.detail || 'Failed to load households');
      } finally {
        setIsLoading(false);
      }
    };

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
      setEditMode('edit');
      setSelectedUsersToAdd([]);
      setSelectedUsersToRemove([]);
    };

    const handleSaveHousehold = async () => {
      if (!selectedHousehold?.id) {
        toast.error('No household selected for editing');
        return;
      }
      
      setIsLoading(true);
      try {
        // First save the household details
        const response = await updateHousehold(selectedHousehold.id, {
          name: selectedHousehold.name,
          description: selectedHousehold.description || ''
        });
        
        // Then handle user additions and removals individually
        const results = [];
        
        // Add selected users
        for (const userId of selectedUsersToAdd) {
          try {
            const result = await addUserToHousehold(selectedHousehold.id, userId);
            results.push({ type: 'add', userId, success: true, result });
          } catch (err) {
            console.error(`Failed to add user ${userId} to household:`, err);
            const errorMessage = err.response?.data?.detail || 'Failed to add user to household';
            toast.error(errorMessage);
            results.push({ type: 'add', userId, success: false, error: errorMessage });
          }
        }
        
        // Remove selected users
        for (const userId of selectedUsersToRemove) {
          try {
            const result = await removeUserFromHousehold(selectedHousehold.id, userId);
            results.push({ type: 'remove', userId, success: true, result });
          } catch (err) {
            console.error(`Failed to remove user ${userId} from household:`, err);
            const errorMessage = err.response?.data?.detail || 'Failed to remove user from household';
            toast.error(errorMessage);
            results.push({ type: 'remove', userId, success: false, error: errorMessage });
          }
        }
        
        // Check if any operations failed
        const failedOperations = results.filter(r => !r.success);
        const successfulOperations = results.filter(r => r.success);
        
        if (successfulOperations.length > 0) {
          toast.success(`Successfully updated household with ${successfulOperations.length} changes`);
        }
        
        // Refresh the households list
        await fetchHouseholds();
        
        // Also refresh the users list to update household counts
        try {
          const usersResponse = await getFamilyMembers();
          setUsers(usersResponse.data || []);
        } catch (err) {
          console.error('Failed to refresh users:', err);
        }
        
        // Only close modal if all operations succeeded or if there were no user changes
        if (failedOperations.length === 0) {
          setEditMode('');
          setSelectedHousehold(null);
          setSelectedUsersToAdd([]);
          setSelectedUsersToRemove([]);
        } else {
          // Keep modal open but clear the failed operations from the pending lists
          const failedUserIds = failedOperations.map(r => r.userId);
          setSelectedUsersToAdd(prev => prev.filter(id => !failedUserIds.includes(id)));
          setSelectedUsersToRemove(prev => prev.filter(id => !failedUserIds.includes(id)));
        }
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

    const handleUserSelectionChange = (userId, action) => {
      if (action === 'add') {
        setSelectedUsersToAdd(prev => 
          prev.includes(userId) ? prev : [...prev, userId]
        );
      } else if (action === 'remove') {
        setSelectedUsersToRemove(prev => 
          prev.includes(userId) ? prev : [...prev, userId]
        );
      }
    };

    const getAvailableUsers = () => {
      if (!selectedHousehold) return [];
      return users.filter(user => {
        // Don't show users who are already members
        const isAlreadyMember = selectedHousehold.members?.some(m => m.id === user.id);
        // Don't show users who are being added (they'll be in the pending changes)
        const isBeingAdded = selectedUsersToAdd.includes(user.id);
        return !isAlreadyMember && !isBeingAdded;
      });
    };

    const isUserAlreadyMember = (userId) => {
      if (!selectedHousehold) return false;
      const isCurrentMember = selectedHousehold.members?.find(m => m.id === userId);
      const isBeingRemoved = selectedUsersToRemove.includes(userId);
      return isCurrentMember && !isBeingRemoved;
    };

    const getCurrentMembers = () => {
      if (!selectedHousehold) return [];
      return selectedHousehold.members?.filter(member => 
        !selectedUsersToRemove.includes(member.id)
      ) || [];
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
                        {household.member_count || 0} members
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
        {editMode === 'edit' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Household</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={selectedHousehold.name}
                    onChange={(e) => setSelectedHousehold({ ...selectedHousehold, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={selectedHousehold.description}
                    onChange={(e) => setSelectedHousehold({ ...selectedHousehold, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    rows={3}
                  />
                </div>
                
                {/* Current Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Members ({getCurrentMembers().length})
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getCurrentMembers().length > 0 ? (
                      getCurrentMembers().map(member => (
                        <div key={member.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                          <span className="text-gray-900 dark:text-white">{member.name}</span>
                          <button
                            onClick={() => handleUserSelectionChange(member.id, 'remove')}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            disabled={isLoading}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No members</p>
                    )}
                  </div>
                </div>

                {/* Add Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Add Members
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getAvailableUsers().length > 0 ? (
                      getAvailableUsers().map(user => (
                        <div key={user.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                          <span className="text-gray-900 dark:text-white">{user.name}</span>
                          <button
                            onClick={() => handleUserSelectionChange(user.id, 'add')}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            disabled={isLoading}
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No users available to add</p>
                    )}
                  </div>
                </div>

                {/* Selected Changes Summary */}
                {(selectedUsersToAdd.length > 0 || selectedUsersToRemove.length > 0) && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Pending Changes:</h4>
                    {selectedUsersToAdd.length > 0 && (
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Will add: {selectedUsersToAdd.map(id => users.find(u => u.id === id)?.name).join(', ')}
                      </p>
                    )}
                    {selectedUsersToRemove.length > 0 && (
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Will remove: {selectedUsersToRemove.map(id => selectedHousehold.members?.find(m => m.id === id)?.name).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setEditMode('');
                      setSelectedHousehold(null);
                      setSelectedUsersToAdd([]);
                      setSelectedUsersToRemove([]);
                    }}
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
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [templateForm, setTemplateForm] = useState({
      name: '',
      subject: '',
      body: ''
    });
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);

    const fetchEmailData = async () => {
      setIsLoadingSettings(true);
      setIsLoadingTemplates(true);
      try {
        const settingsRes = await getEmailSettings();
        setEmailSettings(settingsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
        // Create default settings if none exist
        setEmailSettings({
          smtp_server: '',
          smtp_port: '',
          smtp_username: '',
          smtp_password: '',
          use_tls: true,
          from_email: '',
          from_name: ''
        });
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
      if (isTestingEmail || !testEmail) return;
      setIsTestingEmail(true);
      try {
        const response = await testEmailSettings({ 
          recipient_email: testEmail,
          template_name: 'test_email'  // Use the test email template
        });
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
        name: template.name,
        subject: template.subject,
        body: template.body
      });
      setIsEditingTemplate(true);
    };

    const handleAddTemplate = () => {
      setSelectedTemplate(null);
      setTemplateForm({
        name: '',
        subject: '',
        body: ''
      });
      setIsAddingTemplate(true);
    };

    const handleSaveTemplate = async () => {
      if (!templateForm.name || !templateForm.subject || !templateForm.body || isSaving) return;
      
      setIsSaving(true);
      try {
        if (selectedTemplate) {
          // Update existing template
          await updateEmailTemplate(selectedTemplate.id, templateForm);
          setEmailTemplates(templates => 
            templates.map(t => 
              t.id === selectedTemplate.id 
                ? { ...t, ...templateForm }
                : t
            )
          );
          toast.success('Email template updated successfully');
        } else {
          // Create new template
          const { createEmailTemplate } = await import('../services/api');
          const response = await createEmailTemplate(templateForm);
          setEmailTemplates(templates => [...templates, response.data]);
          toast.success('Email template created successfully');
        }
        setIsEditingTemplate(false);
        setIsAddingTemplate(false);
      } catch (err) {
        console.error('Failed to save email template:', err);
        toast.error(err.response?.data?.detail || 'Failed to save email template');
      } finally {
        setIsSaving(false);
      }
    };

    const handleDeleteTemplate = async () => {
      if (!templateToDelete) return;
      
      try {
        await deleteEmailTemplate(templateToDelete.id);
        setEmailTemplates(templates => templates.filter(t => t.id !== templateToDelete.id));
        toast.success('Email template deleted successfully');
        setShowDeleteConfirm(false);
        setTemplateToDelete(null);
      } catch (err) {
        console.error('Failed to delete email template:', err);
        toast.error(err.response?.data?.detail || 'Failed to delete email template');
      }
    };

    const handleDeleteClick = (template) => {
      setTemplateToDelete(template);
      setShowDeleteConfirm(true);
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
                      Connection Settings
                    </label>
                    <div className="flex gap-3 items-start">
                      <div className="w-1/3">
                        <input
                          type="number"
                          value={emailSettings.smtp_port}
                          onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="465"
                          disabled={isSaving}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">SMTP Port</p>
                      </div>
                      <div className="w-2/3">
                        <select
                          value={emailSettings.smtp_port === 465 ? 'ssl' : 'tls'}
                          onChange={(e) => {
                            const useSSL = e.target.value === 'ssl';
                            setEmailSettings({
                              ...emailSettings,
                              smtp_port: useSSL ? 465 : 587,
                              use_ssl: useSSL,
                              use_tls: !useSSL
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          disabled={isSaving}
                        >
                          <option value="ssl">SSL (Port 465)</option>
                          <option value="tls">TLS (Port 587)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Encryption Type</p>
                      </div>
                    </div>
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
                </div>

                {/* Test Email Section */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Test Email Settings</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Enter email address to test"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isTestingEmail}
                    />
                    <button 
                      onClick={handleTestEmail}
                      className="flex items-center justify-center w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      disabled={isTestingEmail || !testEmail}
                      title="Send test email"
                    >
                      {isTestingEmail ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AdminCard>

        <AdminCard title="Email Templates" icon={FileText}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Templates</h4>
              <button 
                onClick={handleAddTemplate}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                disabled={isSaving}
                title="Add template"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            
            {isLoadingTemplates ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading email templates...</p>
              </div>
            ) : (
              <>
                {emailTemplates.length > 0 ? (
                  emailTemplates.map(template => (
                    <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">{template.name}</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{template.subject}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleEditTemplate(template)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          disabled={isSaving}
                          title="Edit template"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(template)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                          disabled={isSaving}
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
        {(isEditingTemplate || isAddingTemplate) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {isAddingTemplate ? 'Add New Template' : `Edit Template: ${selectedTemplate?.name}`}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
                    rows={15}
                    disabled={isSaving}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setIsEditingTemplate(false);
                      setIsAddingTemplate(false);
                    }}
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <AlertOctagon className="w-6 h-6" />
                <h3 className="text-xl font-bold">Delete Template</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete the template "{templateToDelete?.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setTemplateToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTemplate}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const DatabaseTab = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [backupAction, setBackupAction] = useState(null);
    const [backupActionConfirm, setBackupActionConfirm] = useState(false);
    const [backupActionLoading, setBackupActionLoading] = useState(false);
    const [backupActionResult, setBackupActionResult] = useState(null);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [backupSuccess, setBackupSuccess] = useState(false);
    const [backupError, setBackupError] = useState(false);
    
    const handleBackupItemClick = (backup) => {
      setSelectedBackup(selectedBackup?.filename === backup.filename ? null : backup);
      setBackupAction(null);
      setBackupActionConfirm(false);
      setBackupActionLoading(false);
      setBackupActionResult(null);
    };

    const handleActionClick = (action) => {
      if (!selectedBackup) return;
      
      // If action is already in progress or showing result, do nothing
      if (backupActionLoading || backupActionResult) return;
      
      // If confirmation is already showing for this action type, execute it
      if (backupAction === action && backupActionConfirm) {
        handleActionConfirm();
        return;
      }
      
      // Otherwise show confirmation for this action type
      setBackupAction(action);
      setBackupActionConfirm(true);
    };

    const handleActionConfirm = async () => {
      if (!selectedBackup || !backupAction || !backupActionConfirm) return;

      try {
        setBackupActionLoading(true);
        setIsProcessing(true);
        
        if (backupAction === 'restore') {
          const { restoreBackup } = await import('../services/api');
          const response = await restoreBackup(selectedBackup.filename);
          
          if (response.data.requires_migration) {
            setBackupActionResult('failure');
            toast.error('This backup requires migration. Please upgrade the database first.');
            return;
          }

          if (response.data.success) {
            setBackupActionResult('success');
            toast.success('Backup restored successfully');
          } else {
            setBackupActionResult('failure');
            toast.error(response.data.message);
          }
        } else if (backupAction === 'delete') {
          const { deleteBackup } = await import('../services/api');
          await deleteBackup(selectedBackup.filename);
          setBackupActionResult('success');
          toast.success('Backup deleted successfully');
        }
        
        // Refresh backups after action
        if (window.refreshBackups) {
          await window.refreshBackups();
        }
        
        // Auto-dismiss success after 2 seconds
        setTimeout(() => {
          resetActionStates();
        }, 2000);
        
      } catch (err) {
        console.error(`Failed to ${backupAction} backup:`, err);
        setBackupActionResult('failure');
        toast.error(err.response?.data?.detail || `Failed to ${backupAction} backup`);
        
        // Don't reset after failure - user must manually dismiss
      } finally {
        setBackupActionLoading(false);
        setIsProcessing(false);
      }
    };

    const resetActionStates = (keepSelection = false) => {
      setBackupAction(null);
      setBackupActionConfirm(false);
      setBackupActionLoading(false);
      setBackupActionResult(null);
      setBackupError(false);
      
      if (!keepSelection) {
        setSelectedBackup(null);
      }
    };

    const handleCreateBackup = async () => {
      if (isCreatingBackup || backupSuccess) return;
      
      try {
        setIsCreatingBackup(true);
        setIsProcessing(true);
        setBackupSuccess(false);
        setBackupError(false);
        
        const { createBackup } = await import('../services/api');
        await createBackup();
        
        setBackupSuccess(true);
        toast.success('Backup created successfully');
        
        if (window.refreshBackups) {
          await window.refreshBackups();
        }
        
        setTimeout(() => {
          setBackupSuccess(false);
        }, 2000);
      } catch (err) {
        console.error('Failed to create backup:', err);
        setBackupSuccess(false);
        setBackupError(true);
        toast.error(err.response?.data?.detail || 'Failed to create backup');
      } finally {
        setIsCreatingBackup(false);
        setIsProcessing(false);
      }
    };

    // Get button styles and text based on current state (copied from MigrationModal)
    const getBackupButtonStyles = () => {
      if (isCreatingBackup) {
        return "bg-blue-500 hover:bg-blue-500";
      } else if (backupSuccess) {
        return "bg-green-500 hover:bg-green-500";
      } else if (backupError) {
        return "bg-orange-500 hover:bg-orange-600";
      } else {
        return "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700";
      }
    };
    
    // Get action button styles (copied from MigrationModal)
    const getActionButtonStyles = (type) => {
      if (backupActionLoading) {
        return "bg-gray-500";
      }
      
      if (backupActionResult === 'success') {
        return "bg-green-500";
      }
      
      if (backupActionResult === 'failure') {
        return "bg-orange-500";
      }
      
      if (type === 'restore') {
        return backupActionConfirm && backupAction === 'restore'
          ? "bg-blue-600 hover:bg-blue-700" 
          : "bg-blue-500 hover:bg-blue-600";
      }
      
      if (type === 'delete') {
        return backupActionConfirm && backupAction === 'delete'
          ? "bg-red-600 hover:bg-red-700"
          : "bg-red-500 hover:bg-red-600";
      }
      
      return "bg-gray-500";
    };

    // Get text for the button based on state (copied from MigrationModal)
    const getActionButtonText = (type) => {
      if (backupActionLoading && backupAction === type) {
        return "Processing...";
      }
      
      if (backupActionResult === 'success' && backupAction === type) {
        return "Success!";
      }
      
      if (backupActionResult === 'failure' && backupAction === type) {
        return "Failed!";
      }
      
      if (backupActionConfirm && backupAction === type) {
        return "Confirm?";
      }
      
      return type === 'restore' ? "Restore" : "Delete";
    };
    
    return (
      <div className="space-y-6">
        <AdminCard title="Database Management" icon={Database}>
          <MigrationManager 
            setProcessingStatus={setIsProcessing}
            selectedBackup={selectedBackup}
            setSelectedBackup={setSelectedBackup}
          />
          
          {/* Backup Action Buttons */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-3">
              {selectedBackup ? (
                <>
                  {/* Show different layouts depending on action state */}
                  {backupActionResult ? (
                    // Success or Failure state - show only the relevant button at full width
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                        ${backupActionResult === 'success' ? 'bg-green-500' : 'bg-orange-500'} 
                        text-white rounded-lg shadow-sm transition-all duration-300`}
                      onClick={() => backupActionResult === 'success' ? resetActionStates() : resetActionStates(true)}
                    >
                      {backupActionResult === 'success' ? (
                        <>
                          <Check size={18} />
                          <span>{backupAction === 'restore' ? 'Restored Successfully!' : 'Deleted Successfully!'}</span>
                        </>
                      ) : (
                        <>
                          <TriangleAlert size={18} />
                          <span>Operation Failed - Click to dismiss</span>
                        </>
                      )}
                    </button>
                  ) : backupActionLoading ? (
                    // Loading state - show only the loading button at full width
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                        bg-blue-500 text-white rounded-lg shadow-sm"
                    >
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing {backupAction}...</span>
                    </button>
                  ) : (
                    // Normal state with both buttons
                    <>
                      {/* Restore Button */}
                      <button
                        onClick={() => handleActionClick('restore')}
                        disabled={backupActionLoading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                          ${getActionButtonStyles('restore')} 
                          text-white rounded-lg shadow-sm transition-all duration-300`}
                      >
                        <RotateCcw size={18} />
                        <span>{getActionButtonText('restore')}</span>
                      </button>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => handleActionClick('delete')}
                        disabled={backupActionLoading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                          ${getActionButtonStyles('delete')} 
                          text-white rounded-lg shadow-sm transition-all duration-300`}
                      >
                        <Trash2 size={18} />
                        <span>{getActionButtonText('delete')}</span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={handleCreateBackup}
                  disabled={isProcessing}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                    ${getBackupButtonStyles()}
                    text-white rounded-lg shadow-sm
                    transition-all duration-300
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCreatingBackup ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creating Backup...
                    </span>
                  ) : backupSuccess ? (
                    <span className="flex items-center gap-2">
                      <Check size={18} />
                      <span className="font-medium">Backup Created!</span>
                    </span>
                  ) : backupError ? (
                    <span className="flex items-center gap-2" onClick={() => setBackupError(false)}>
                      <TriangleAlert size={18} />
                      <span className="font-medium">Backup Failed - Try Again</span>
                    </span>
                  ) : (
                    <>
                      <Archive size={18} />
                      <span className="font-medium">Create Backup</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </AdminCard>
      </div>
    );
  };

  const SystemTab = () => {
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);

    const handleRefreshStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const [statusRes, versionRes] = await Promise.all([
          getSystemStatus(),
          getDatabaseVersion()
        ]);
        setSystemStatus(statusRes.data || {});
        setDatabaseVersion(versionRes.data?.current_version || 'unknown');
        toast.success('System status refreshed');
      } catch (err) {
        console.error('Failed to fetch system info:', err);
        toast.error('Failed to load system information');
      } finally {
        setIsLoadingStatus(false);
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
                className="flex items-center justify-center w-8 h-8 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                disabled={isLoadingStatus}
                title="Refresh status"
              >
                <RefreshCw className={`w-5 h-5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingStatus ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading system status...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(systemStatus)
                  .filter(([key, value]) => key !== 'debug_mode') // Remove debug mode
                  .map(([key, value]) => {
                    // Custom display for specific fields
                    let displayKey = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    let displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value.toString();
                    
                    // Custom formatting for specific fields
                    if (key === 'uptime') {
                      displayKey = 'Server Uptime';
                    } else if (key === 'database_size_kb') {
                      displayKey = 'Database Size';
                      displayValue = `${value} KB`;
                    } else if (key === 'last_backup') {
                      displayKey = 'Last Backup';
                      displayValue = value ? formatDateEST(value) : 'Never';
                    }
                    
                    return (
                      <div key={key} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                          {displayKey}
                        </h5>
                        <p className="text-gray-600 dark:text-gray-400">
                          {displayValue}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Emergency Token Management */}
        <EmergencyTokenManager />

        {/* Auth Log Viewer */}
        <AuthLogViewer />
      </div>
    );
  };

  const ItemsTab = () => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPurchaseStatus, setShowPurchaseStatus] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const response = await getAllItems();
        setItems(response.data || []);
      } catch (err) {
        console.error('Failed to fetch items:', err);
        toast.error('Failed to load items');
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      fetchItems();
    }, []);

    const handleDeleteItem = async (itemId) => {
      if (!confirm('Are you sure you want to delete this item?')) return;
      
      setIsDeleting(true);
      try {
        await deleteItemAsAdmin(itemId);
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
        toast.success('Item deleted successfully');
      } catch (err) {
        console.error('Failed to delete item:', err);
        toast.error(err.response?.data?.detail || 'Failed to delete item');
      } finally {
        setIsDeleting(false);
      }
    };

    const handleClearAllWishlists = async () => {
      if (!confirm('Are you sure you want to delete ALL wishlists for ALL users? This action cannot be undone.')) return;
      
      setIsLoading(true);
      try {
        await clearAllWishlists();
        setItems([]);
        toast.success('All wishlists cleared successfully');
        setShowClearConfirm(false);
      } catch (err) {
        console.error('Failed to clear all wishlists:', err);
        toast.error(err.response?.data?.detail || 'Failed to clear all wishlists');
      } finally {
        setIsLoading(false);
      }
    };

    // Group items by owner
    const groupedItems = items.reduce((acc, item) => {
      const ownerName = item.owner_name || 'Unknown';
      if (!acc[ownerName]) {
        acc[ownerName] = [];
      }
      acc[ownerName].push(item);
      return acc;
    }, {});

    // Get households for a specific user
    const getUserHouseholds = (ownerId) => {
      const user = users.find(u => u.id === ownerId);
      if (!user) return [];
      
      return households.filter(household => 
        household.members?.some(member => member.id === ownerId)
      );
    };

    return (
      <div className="space-y-6">
        <AdminCard title="All Wishlist Items" icon={Gift}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Items</h4>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowPurchaseStatus(!showPurchaseStatus)}
                  className="flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                  title={showPurchaseStatus ? "Hide purchase status" : "Show purchase status"}
                >
                  {showPurchaseStatus ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                <button 
                  onClick={fetchItems}
                  className="flex items-center justify-center w-8 h-8 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  disabled={isLoading}
                  title="Refresh items"
                >
                  <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center justify-center w-8 h-8 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                  disabled={isLoading}
                  title="Clear all wishlists"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            
            {isLoading && !items.length ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading items...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([ownerName, ownerItems]) => {
                  const ownerItem = ownerItems[0];
                  const ownerHouseholds = getUserHouseholds(ownerItem.owner_id);
                  
                  return (
                    <div key={ownerName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Owner Header */}
                      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900 dark:text-white">{ownerName}</h5>
                            {ownerHouseholds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ownerHouseholds.map(household => (
                                  <span key={household.id} className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded">
                                    {household.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {ownerItems.length} item{ownerItems.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      
                      {/* Items List */}
                      <div className="divide-y divide-gray-200 dark:divide-gray-600">
                        {ownerItems.map(item => (
                          <div key={item.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h6 className="font-medium text-gray-900 dark:text-white truncate">
                                    {item.title}
                                  </h6>
                                  {showPurchaseStatus && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      item.is_purchased 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                    }`}>
                                      {item.is_purchased ? 'Purchased' : 'Available'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                  {item.description || 'No description'}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  <span>Priority: {item.priority}</span>
                                  {item.price && (
                                    <span>Price: ${(item.price / 100).toFixed(2)}</span>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDeleteItem(item.id)}
                                className="ml-3 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                disabled={isDeleting}
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {!items.length && !isLoading && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No items available
                  </div>
                )}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Clear All Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <AlertOctagon className="w-6 h-6" />
                <h3 className="text-xl font-bold">Clear All Wishlists</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete ALL wishlists for ALL users? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllWishlists}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Clearing...' : 'Clear All'}
                </button>
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
        return <DatabaseTab />;
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

      {/* Navigation Tabs - Hidden on Mobile */}
      <div className="hidden md:block bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
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

      {/* Mobile Menu Button */}
      <AnimatePresence>
        {!isMobileMenuOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg flex items-center justify-center z-50"
          >
            <Menu size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-xl shadow-xl z-50 max-h-[70vh] overflow-y-auto"
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Navigation</h3>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center w-full p-3 rounded-lg transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        <span className="font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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