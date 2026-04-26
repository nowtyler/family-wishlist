import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Settings, Mail, Shield, Trash2, Plus,
  Edit, Eye, EyeOff, Check, X, TriangleAlert, RefreshCw,
  Home, UserPlus, UserMinus, Lock, Unlock, Send, TestTube,
  Calendar, Gift, FileText, Archive, Download, Upload, Save, ArrowUp, ChevronDown,
  CircleCheck, CircleX, Database, CircleAlert, Box, RotateCcw,
  AlertOctagon, Menu, LayoutDashboard, ShoppingCart, Share2
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
  getAllItems,
  deleteItemAsAdmin,
  updateWishlistItem,
  updateSharedWishlistItem,
  deleteSharedWishlistItem,
  getAdminCartItems,
  deleteAdminCartItem,
  clearAdminCarts,
  clearAdminCartByBuyer,
  clearAllWishlists,
  broadcastMaintenanceNotice,
  broadcastUpdateNotice,
  broadcastWishlistUpdateReminder,
  getRecoveryPassphrase,
  regenerateRecoveryPassphrase
} from '../services/api';
import FamilyMemberManager from './admin/FamilyMemberManager';
import AdminSharedWishlistManager from './admin/AdminSharedWishlistManager';
import Navbar from './Navbar';
import MigrationManager from './admin/MigrationManager';
import ApplicationLogViewer from './admin/ApplicationLogViewer';
import EnhancedUpcomingEventsBanner from './EnhancedUpcomingEventsBanner';

// Memoized Maintenance Notice Broadcaster Component
/** @type {import('react').FC<{ isBroadcasting: boolean, setIsBroadcasting: (value: boolean) => void }>} */
const MaintenanceNoticeBroadcaster = memo((props) => {
  const { isBroadcasting, setIsBroadcasting } = props;
  const [maintenanceTime, setMaintenanceTime] = useState('');
  const [expectedDowntime, setExpectedDowntime] = useState('');

  const handleBroadcastMaintenanceNotice = useCallback(async () => {
    if (isBroadcasting) return; // Prevent double-clicks
    if (!maintenanceTime.trim() || !expectedDowntime.trim()) {
      toast.error("Please fill out both the maintenance time and expected downtime.");
      return;
    }
  
    setIsBroadcasting(true);
    try {
      const response = await broadcastMaintenanceNotice(
        maintenanceTime.trim(),
        expectedDowntime.trim()
      );
      toast.success(response.data?.message || "Maintenance notice sent successfully!");
      // Only clear fields if the response is successful
      setMaintenanceTime('');
      setExpectedDowntime('');
    } catch (err) {
      console.error("Broadcast failed:", err);
      toast.error(err.response?.data?.detail || "Failed to send maintenance notice.");
      // Do NOT clear fields here - let user retry or edit
    } finally {
      setIsBroadcasting(false);
    }
  }, [maintenanceTime, expectedDowntime, isBroadcasting, setIsBroadcasting]);

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Broadcast Maintenance Notice</h4>
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          type="text"
          value={maintenanceTime}
          onChange={(e) => setMaintenanceTime(e.target.value)}
          placeholder="Maintenance Date/Time (e.g. June 10, 2:00 AM EST)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isBroadcasting}
        />
        <input
          type="text"
          value={expectedDowntime}
          onChange={(e) => setExpectedDowntime(e.target.value)}
          placeholder="Expected Downtime (e.g. 1-2 hours)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isBroadcasting}
        />
      </div>
      <button
        type="button"
        onClick={handleBroadcastMaintenanceNotice}
        className="flex items-center px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors text-sm font-medium w-fit"
        disabled={isBroadcasting}
      >
        {isBroadcasting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Sending...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-1" />
            Send Notice
          </>
        )}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        This will send the current maintenance notice template to all users. You can edit the template below.
      </p>
    </div>
  );
});

MaintenanceNoticeBroadcaster.displayName = 'MaintenanceNoticeBroadcaster';

// Memoized Update Notice Broadcaster Component
const UpdateNoticeBroadcaster = memo((props) => {
  const { isBroadcasting, setIsBroadcasting } = props;
  const [version, setVersion] = useState('');
  const [headline, setHeadline] = useState('');
  const [intro, setIntro] = useState('');
  const [highlights, setHighlights] = useState('');
  const [closing, setClosing] = useState('');

  const handleBroadcastUpdateNotice = useCallback(async (sendTestToAdmin = false) => {
    if (isBroadcasting) return;
    if (!version.trim() || !headline.trim() || !intro.trim() || !highlights.trim()) {
      toast.error("Please fill out the version, headline, intro, and highlights.");
      return;
    }

    const parsedHighlights = highlights
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    setIsBroadcasting(true);
    try {
      const response = await broadcastUpdateNotice({
        version: version.trim(),
        headline: headline.trim(),
        intro: intro.trim(),
        highlights: parsedHighlights,
        closing: closing.trim() || undefined,
        changes: parsedHighlights.join('\n'),
        send_test_to_admin: sendTestToAdmin
      });
      toast.success(response.data?.message || "Update notice sent successfully!");
      if (!sendTestToAdmin) {
        setVersion('');
        setHeadline('');
        setIntro('');
        setHighlights('');
        setClosing('');
      }
    } catch (err) {
      console.error("Broadcast failed:", err);
      toast.error(err.response?.data?.detail || "Failed to send update notice.");
    } finally {
      setIsBroadcasting(false);
    }
  }, [version, headline, intro, highlights, closing, isBroadcasting, setIsBroadcasting]);

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Broadcast Update Notice</h4>
      <div className="flex flex-col gap-2 mb-2">
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="Version (e.g. v2.5.0)"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isBroadcasting}
        />
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline (e.g. A big Family Wishlist update is here)"
          rows={2}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical"
          disabled={isBroadcasting}
        />
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="Intro paragraph for the email hero section"
          rows={3}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical"
          disabled={isBroadcasting}
        />
        <textarea
          value={highlights}
          onChange={(e) => setHighlights(e.target.value)}
          placeholder={"Highlights, one per line\n- New bottom navigation for easier mobile use\n- Shared wishlists with co-owner tools\n- Shopping cart and reminders"}
          rows={3}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical"
          disabled={isBroadcasting}
        />
        <textarea
          value={closing}
          onChange={(e) => setClosing(e.target.value)}
          placeholder="Optional closing note about what users will notice right away"
          rows={2}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical"
          disabled={isBroadcasting}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleBroadcastUpdateNotice(true)}
          className="flex items-center px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors text-sm font-medium"
          disabled={isBroadcasting}
        >
          {isBroadcasting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4 mr-1" />
              Send Test To Admin
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleBroadcastUpdateNotice(false)}
          className="flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors text-sm font-medium"
          disabled={isBroadcasting}
        >
          {isBroadcasting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" />
              Send Update Notice
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Send a test to the current admin email first to verify formatting, then send the polished release-update template to everyone.
      </p>
    </div>
  );
});

UpdateNoticeBroadcaster.displayName = 'UpdateNoticeBroadcaster';

const AdminPage = () => {
  const { selectedUser } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSendingWishlistReminder, setIsSendingWishlistReminder] = useState(false);

  // Data states
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeHouseholds: 0,
    totalItems: 0,
    systemStatus: 'Loading...'
  });
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    status: '',
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

      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        toast.error('Failed to load admin dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleBroadcastWishlistReminder = useCallback(async () => {
    if (isSendingWishlistReminder) return;
    setIsSendingWishlistReminder(true);
    try {
      const response = await broadcastWishlistUpdateReminder();
      const sent = response?.data?.sent_count ?? 0;
      const skipped = response?.data?.skipped_count ?? 0;
      toast.success(`Wishlist reminder sent to ${sent} owner(s).${skipped ? ` ${skipped} already had an unread reminder.` : ''}`);
    } catch (error) {
      console.error('Failed to broadcast wishlist reminder:', error);
      toast.error(error?.response?.data?.detail || 'Failed to send wishlist reminder.');
    } finally {
      setIsSendingWishlistReminder(false);
    }
  }, [isSendingWishlistReminder]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'households', label: 'Households', icon: Home },
    { id: 'shared-wishlists', label: 'Shared', icon: Users },
    { id: 'items', label: 'Items', icon: Gift },
    { id: 'carts', label: 'Carts', icon: ShoppingCart },
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

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color = 'blue',
    iconContainerClassName = '',
    iconContainerDarkClassName = ''
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-md">
      <div className="flex items-center">
        <div
          className={`p-1.5 sm:p-2 bg-${color}-100 dark:bg-${color}-900/30 rounded-lg ${iconContainerClassName} ${iconContainerDarkClassName}`}
        >
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${color}-600 dark:text-${color}-400`} />
        </div>
        <div className="ml-2 sm:ml-3 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
        </div>
      </div>
    </div>
  );

  const WishlistReminderCard = ({ compact = false }) => (
    <AdminCard
      title="Wishlist Reminder"
      icon={Calendar}
      className={compact ? 'p-4 sm:p-5' : ''}
    >
      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Send an in-app prompt to all wishlist owners asking them to review and update their wishlist.
        </p>
        <button
          type="button"
          onClick={handleBroadcastWishlistReminder}
          disabled={isSendingWishlistReminder}
          className={`inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 text-white text-sm font-medium transition-colors hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed ${
            compact ? 'w-full sm:w-auto px-3 py-2' : 'px-4 py-2'
          }`}
        >
          {isSendingWishlistReminder ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Wishlist Reminder
            </>
          )}
        </button>
      </div>
    </AdminCard>
  );

  const DashboardTab = () => (
    <div className="space-y-3 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
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
        <StatCard
          title="Total Users"
          value={stats.total_users || 0}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Households"
          value={stats.total_households || 0}
          icon={Home}
          color="green"
        />
        <StatCard
          title="Emails Sent"
          value={stats.total_emails_sent || 0}
          icon={Mail}
          color="blue"
        />
        <StatCard
          title="Wishlist Items"
          value={stats.total_wishlists || 0}
          icon={Gift}
          color="purple"
          iconContainerDarkClassName="dark:bg-purple-800/50"
        />
        <StatCard
          title="Cart Items"
          value={stats.total_cart_items || 0}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title="Shared Wishlists"
          value={stats.total_shared_wishlists || 0}
          icon={Share2}
          color="indigo"
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

    const refreshUsersAndHouseholds = async () => {
      try {
        const [usersRes, householdsRes] = await Promise.all([
          getFamilyMembers(),
          getHouseholdsWithMembers()
        ]);
        setUsers(usersRes.data || []);
        setHouseholds(householdsRes.data || []);
        await refreshFamilyMembers();
      } catch (err) {
        console.error('Failed to fetch users:', err);
        toast.error('Failed to load users');
      }
    };

    const handleCloseModal = () => {
      setIsModalOpen(false);
      refreshUsersAndHouseholds();
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
          onMutate={refreshUsersAndHouseholds}
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
    const defaultEmailSettings = {
      smtp_server: '',
      smtp_port: 465,
      smtp_username: '',
      smtp_password: '',
      use_ssl: false,
      use_tls: true,
      from_email: '',
      from_name: ''
    };
    const [emailSettings, setEmailSettings] = useState(defaultEmailSettings);
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
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const fetchEmailData = async () => {
      setIsLoadingSettings(true);
      setIsLoadingTemplates(true);
      try {
        const settingsRes = await getEmailSettings();
        const settingsData = settingsRes.data || {};
        setEmailSettings({
          ...defaultEmailSettings,
          ...settingsData,
          use_ssl: Boolean(settingsData.use_ssl),
          use_tls: settingsData.use_tls !== undefined ? Boolean(settingsData.use_tls) : defaultEmailSettings.use_tls,
          smtp_port: Number(settingsData.smtp_port || defaultEmailSettings.smtp_port)
        });
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
        // Create default settings if none exist
        setEmailSettings(defaultEmailSettings);
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
                          onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: Number(e.target.value) || 0 })}
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

                {/* Broadcast Maintenance Notice */}
                <MaintenanceNoticeBroadcaster isBroadcasting={isBroadcasting} setIsBroadcasting={setIsBroadcasting} />

                {/* Broadcast Update Notice */}
                <UpdateNoticeBroadcaster isBroadcasting={isBroadcasting} setIsBroadcasting={setIsBroadcasting} />
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
    // Recovery passphrase management state
    const [passphraseVisible, setPassphraseVisible] = useState(false);
    const [currentPassphrase, setCurrentPassphrase] = useState('');
    const [isLoadingPassphrase, setIsLoadingPassphrase] = useState(false);
    const [showRegenConfirm, setShowRegenConfirm] = useState(false);
    const [regenPassword, setRegenPassword] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);

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

    const handleViewPassphrase = async () => {
      if (passphraseVisible) {
        setPassphraseVisible(false);
        setCurrentPassphrase('');
        return;
      }
      setIsLoadingPassphrase(true);
      try {
        const res = await getRecoveryPassphrase();
        setCurrentPassphrase(res.data.passphrase);
        setPassphraseVisible(true);
      } catch (err) {
        console.error('Failed to fetch passphrase:', err);
        const detail = err.response?.data?.detail;
        if (detail === 'No recovery passphrase has been set') {
          toast.warning('No recovery passphrase has been set. Click Regenerate to create one.');
        } else {
          toast.error(detail || 'Failed to retrieve recovery passphrase');
        }
      } finally {
        setIsLoadingPassphrase(false);
      }
    };

    const handleRegeneratePassphrase = async () => {
      if (!regenPassword) {
        toast.error('Please enter your current password');
        return;
      }
      setIsRegenerating(true);
      try {
        const res = await regenerateRecoveryPassphrase(regenPassword);
        setCurrentPassphrase(res.data.passphrase);
        setPassphraseVisible(true);
        setShowRegenConfirm(false);
        setRegenPassword('');
        toast.success('Recovery passphrase regenerated. Save it now!');
      } catch (err) {
        console.error('Failed to regenerate passphrase:', err);
        const detail = err.response?.data?.detail;
        toast.error(detail || 'Failed to regenerate passphrase');
      } finally {
        setIsRegenerating(false);
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
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
                      if (value) {
                        const lastBackupValue = typeof value === 'string' ? value : String(value);
                        displayValue = formatDateEST(lastBackupValue);
                      } else {
                        displayValue = 'Never';
                      }
                    }

                    return (
                      <div key={key} className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h5 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-1 sm:mb-2">
                          {displayKey}
                        </h5>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 truncate">
                          {displayValue}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </AdminCard>

        <WishlistReminderCard compact />

        {/* Recovery Passphrase Management */}
        <AdminCard title="Recovery Passphrase" icon={Shield}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your recovery passphrase is used to reset the admin password if you forget it.
              It is stored encrypted and cannot be read from the database alone.
            </p>

            {/* View Passphrase */}
            <div className="space-y-3">
              <button
                onClick={handleViewPassphrase}
                disabled={isLoadingPassphrase}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {isLoadingPassphrase ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : passphraseVisible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {passphraseVisible ? 'Hide Passphrase' : 'View Passphrase'}
              </button>

              <AnimatePresence>
                {passphraseVisible && currentPassphrase && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        Keep this passphrase secret. Do not share it.
                      </p>
                      <p className="font-mono text-lg text-gray-900 dark:text-white tracking-wide select-all text-center py-2 bg-white dark:bg-gray-900 rounded-md border border-amber-200 dark:border-amber-800">
                        {currentPassphrase}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Regenerate Passphrase */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              {!showRegenConfirm ? (
                <button
                  onClick={() => setShowRegenConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate Passphrase
                </button>
              ) : (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    This will replace your current recovery passphrase. The old passphrase will no longer work.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Enter your current password to confirm
                    </label>
                    <input
                      type="password"
                      value={regenPassword}
                      onChange={(e) => setRegenPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Current password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegeneratePassphrase}
                      disabled={isRegenerating || !regenPassword}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isRegenerating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {isRegenerating ? 'Regenerating...' : 'Confirm Regenerate'}
                    </button>
                    <button
                      onClick={() => { setShowRegenConfirm(false); setRegenPassword(''); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        {/* Application Logs */}
        <ApplicationLogViewer />
      </div>
    );
  };

  const CartsTab = () => {
    const [cartItems, setCartItems] = useState([]);
    const [isLoadingCarts, setIsLoadingCarts] = useState(false);
    const [showCartStatus, setShowCartStatus] = useState(false);
    const [expandedCarts, setExpandedCarts] = useState({});
    const [showClearCartsConfirm, setShowClearCartsConfirm] = useState(false);
    const [isClearingCarts, setIsClearingCarts] = useState(false);

    const fetchCartItems = async () => {
      setIsLoadingCarts(true);
      try {
        const response = await getAdminCartItems();
        setCartItems(response.data || []);
      } catch (err) {
        console.error('Failed to fetch cart items:', err);
        toast.error('Failed to load cart items');
      } finally {
        setIsLoadingCarts(false);
      }
    };

    useEffect(() => {
      fetchCartItems();
    }, []);

    const handleRemoveCartItem = async (cartItemId) => {
      if (!confirm('Remove this item from the cart?')) return;
      try {
        await deleteAdminCartItem(cartItemId);
        setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));
        toast.success('Removed item from cart.');
      } catch (err) {
        console.error('Failed to remove cart item:', err);
        toast.error(err.response?.data?.detail || 'Failed to remove cart item');
      }
    };

    const handleClearBuyerCart = async (buyerId, buyerName) => {
      if (!buyerId) {
        toast.error('Unable to clear cart without a buyer.');
        return;
      }
      if (!confirm(`Clear the entire cart for ${buyerName}?`)) return;
      try {
        const response = await clearAdminCartByBuyer(buyerId);
        setCartItems((prev) => prev.filter((item) => item.buyer_id !== buyerId));
        toast.success(response?.data?.message || 'Cart cleared.');
      } catch (err) {
        console.error('Failed to clear buyer cart:', err);
        toast.error(err.response?.data?.detail || 'Failed to clear cart');
      }
    };

    const handleClearAllCarts = async () => {
      setIsClearingCarts(true);
      try {
        const response = await clearAdminCarts();
        setCartItems([]);
        toast.success(response?.data?.message || 'All carts cleared.');
        setShowClearCartsConfirm(false);
      } catch (err) {
        console.error('Failed to clear all carts:', err);
        toast.error(err.response?.data?.detail || 'Failed to clear all carts');
      } finally {
        setIsClearingCarts(false);
      }
    };

    const formatPrice = (price) => {
      if (price === null || price === undefined || Number.isNaN(Number(price))) {
        return '—';
      }
      return `$${(Number(price) / 100).toFixed(2)}`;
    };

    const groupedCartItems = cartItems.reduce((acc, item) => {
      const buyerName = item.buyer_name || 'Unknown';
      if (!acc[buyerName]) {
        acc[buyerName] = [];
      }
      acc[buyerName].push(item);
      return acc;
    }, {});

    const getStatusStyle = (status) => {
      if (String(status).toLowerCase() === 'purchased') {
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      }
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    };

    return (
      <div className="space-y-6">
        <AdminCard title="Shopping Carts" icon={ShoppingCart}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Cart Items</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCartStatus(!showCartStatus)}
                  className="flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                  title={showCartStatus ? "Hide status" : "Show status"}
                >
                  {showCartStatus ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                <button
                  onClick={fetchCartItems}
                  className="flex items-center justify-center w-8 h-8 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  disabled={isLoadingCarts}
                  title="Refresh carts"
                >
                  <RefreshCw size={20} className={isLoadingCarts ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowClearCartsConfirm(true)}
                  className="flex items-center justify-center w-8 h-8 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                  disabled={isLoadingCarts}
                  title="Clear all carts"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {isLoadingCarts && !cartItems.length ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading cart items...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedCartItems).map(([buyerName, buyerItems]) => {
                  const purchasedCount = buyerItems.filter((item) => item.status === 'purchased').length;
                  const buyerId = buyerItems[0]?.buyer_id;
                  const cartKey = `${buyerId ?? 'unknown'}:${buyerName}`;
                  const isExpanded = Boolean(expandedCarts[cartKey]);
                  return (
                    <div key={buyerName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900 dark:text-white">{buyerName}</h5>
                            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                              {purchasedCount} purchased • {buyerItems.length - purchasedCount} pending
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {buyerItems.length} item{buyerItems.length !== 1 ? 's' : ''}
                            </span>
                            <button
                              onClick={() => setExpandedCarts((prev) => ({ ...prev, [cartKey]: !isExpanded }))}
                              className="flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              title={isExpanded ? "Hide cart items" : "Show cart items"}
                              aria-label={isExpanded ? "Hide cart items" : "Show cart items"}
                            >
                              <ChevronDown size={18} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            </button>
                            <button
                              onClick={() => handleClearBuyerCart(buyerId, buyerName)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                              title="Clear this cart"
                              disabled={!buyerId}
                            >
                              <Trash2 size={14} />
                              Clear cart
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="divide-y divide-gray-200 dark:divide-gray-600">
                          {buyerItems.map((item) => (
                            <div key={item.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h6 className="font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
                                      {item.title}
                                    </h6>
                                  {showCartStatus && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusStyle(item.status)}`}>
                                      {item.status || 'pending'}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-3">
                                  <span>Recipient: {item.recipient_name || 'Unknown'}</span>
                                  <span>Price: {formatPrice(item.price)}</span>
                                  <span>Added: {formatDateEST(item.created_at)}</span>
                                </div>
                                {showCartStatus && item.notes && (
                                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                    {item.notes}
                                  </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {item.link && (
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                                    >
                                      View
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleRemoveCartItem(item.id)}
                                    className="inline-flex items-center text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                    title="Remove item from cart"
                                    aria-label="Remove item from cart"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!cartItems.length && !isLoadingCarts && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No cart items available
                  </div>
                )}
              </div>
            )}
          </div>
        </AdminCard>

        {showClearCartsConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <AlertOctagon className="w-6 h-6" />
                <h3 className="text-xl font-bold">Clear All Carts</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to remove every item from all carts? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearCartsConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  disabled={isClearingCarts}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllCarts}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  disabled={isClearingCarts}
                >
                  {isClearingCarts ? 'Clearing...' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SharedWishlistsTab = () => (
    <div className="space-y-6">
      <AdminSharedWishlistManager familyMembers={users} />
    </div>
  );

  const ItemsTab = () => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editForm, setEditForm] = useState({
      title: '',
      description: '',
      link: '',
      image_url: '',
      price: '',
      priority: 0
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPurchaseStatus, setShowPurchaseStatus] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [expandedOwners, setExpandedOwners] = useState({});

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

    const handleDeleteItem = async (item) => {
      if (!confirm('Are you sure you want to delete this item?')) return;
      
      setIsDeleting(true);
      try {
        if (item.item_type === 'shared') {
          await deleteSharedWishlistItem(item.id);
        } else {
          await deleteItemAsAdmin(item.id);
        }
        setItems(prevItems => prevItems.filter(existing => existing.id !== item.id || existing.item_type !== item.item_type));
        toast.success('Item deleted successfully');
      } catch (err) {
        console.error('Failed to delete item:', err);
        toast.error(err.response?.data?.detail || 'Failed to delete item');
      } finally {
        setIsDeleting(false);
      }
    };

    const handleOpenEditItem = (item) => {
      setSelectedItem(item);
      setEditForm({
        title: item.title || '',
        description: item.description || '',
        link: item.link || '',
        image_url: item.image_url || '',
        price: item.price !== null && item.price !== undefined ? (item.price / 100).toFixed(2) : '',
        priority: item.priority ?? 0
      });
    };

    const handleCloseEditItem = () => {
      setSelectedItem(null);
      setEditForm({
        title: '',
        description: '',
        link: '',
        image_url: '',
        price: '',
        priority: 0
      });
    };

    const handleSaveItem = async () => {
      if (!selectedItem) return;

      const trimmedTitle = editForm.title.trim();
      if (!trimmedTitle) {
        toast.error('Title is required');
        return;
      }

      let parsedPrice = null;
      if (editForm.price !== '' && editForm.price !== null && editForm.price !== undefined) {
        const numericPrice = parseFloat(String(editForm.price));
        if (Number.isNaN(numericPrice) || numericPrice < 0) {
          toast.error('Price must be a valid positive number');
          return;
        }
        parsedPrice = numericPrice;
      }

      const normalizedPriority = Number(editForm.priority) >= 1 ? 1 : 0;

      const payload = {
        title: trimmedTitle,
        description: editForm.description?.trim() || null,
        link: editForm.link?.trim() || null,
        image_url: editForm.image_url?.trim() || null,
        price: parsedPrice,
        priority: normalizedPriority
      };

      setIsSaving(true);
      try {
        if (selectedItem.item_type === 'shared') {
          await updateSharedWishlistItem(selectedItem.id, payload);
        } else {
          await updateWishlistItem(selectedItem.id, payload);
        }

        setItems((prevItems) => prevItems.map((item) => {
          if (item.id !== selectedItem.id || item.item_type !== selectedItem.item_type) {
            return item;
          }
          return {
            ...item,
            title: payload.title,
            description: payload.description,
            link: payload.link,
            image_url: payload.image_url,
            priority: payload.priority,
            price: payload.price !== null ? Math.round(payload.price * 100) : null
          };
        }));

        toast.success('Item updated successfully');
        handleCloseEditItem();
      } catch (err) {
        console.error('Failed to update item:', err);
        toast.error(err.response?.data?.detail || 'Failed to update item');
      } finally {
        setIsSaving(false);
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
      const groupLabel = item.group_label || item.owner_name || 'Unknown';
      if (!acc[groupLabel]) {
        acc[groupLabel] = [];
      }
      acc[groupLabel].push(item);
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
                {Object.entries(groupedItems).map(([groupLabel, ownerItems]) => {
                  const ownerItem = ownerItems[0];
                  const ownerHouseholds = ownerItem.households?.length
                    ? ownerItem.households
                    : getUserHouseholds(ownerItem.owner_id).map(household => household.name);
                  const ownerKey = `${ownerItem.group_type || 'user'}:${ownerItem.owner_id ?? 'unknown'}:${groupLabel}`;
                  const isExpanded = Boolean(expandedOwners[ownerKey]);
                  
                  return (
                    <div key={ownerKey} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Owner Header */}
                      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium text-gray-900 dark:text-white">{groupLabel}</h5>
                              {ownerItem.group_type === 'shared' && (
                                <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-0.5 rounded">
                                  Shared
                                </span>
                              )}
                            </div>
                            {ownerHouseholds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ownerHouseholds.map((householdName, index) => (
                                  <span key={`${ownerKey}-household-${index}`} className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded">
                                    {householdName}
                                  </span>
                                ))}
                              </div>
                            )}
                            {ownerItem.group_type === 'shared' && ownerItem.shared_owner_names?.length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Owners: {ownerItem.shared_owner_names.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {ownerItems.length} item{ownerItems.length !== 1 ? 's' : ''}
                            </span>
                            <button
                              onClick={() => setExpandedOwners((prev) => ({ ...prev, [ownerKey]: !isExpanded }))}
                              className="flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              title={isExpanded ? "Hide items" : "Show items"}
                              aria-label={isExpanded ? "Hide items" : "Show items"}
                            >
                              <ChevronDown size={18} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Items List */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-200 dark:divide-gray-600">
                          {ownerItems.map(item => (
                            <div key={item.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h6 className="font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
                                      {item.title}
                                    </h6>
                                    {item.item_type === 'shared' && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                                        Shared
                                      </span>
                                    )}
                                    {showPurchaseStatus && (
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        item.is_purchased 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                      }`}>
                                        {item.is_purchased
                                          ? (item.purchased_by ? `In cart: ${item.purchased_by}` : 'In a cart')
                                          : 'Available'}
                                      </span>
                                    )}
                                    {showPurchaseStatus && item.thinking_about_by_list?.length > 0 && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200">
                                        {item.thinking_about_by_list.length === 1
                                          ? `${item.thinking_about_by_list[0]} is interested`
                                          : `Interested: ${item.thinking_about_by_list.join(', ')}`}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                    {item.description || 'No description'}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {item.priority >= 1 && <span>⭐ Most Wanted</span>}
                                    {item.price && (
                                      <span>Price: ${(item.price / 100).toFixed(2)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-3 flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenEditItem(item)}
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                    title="Edit item"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                    disabled={isDeleting}
                                    title="Delete item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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

        {selectedItem && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={handleCloseEditItem}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Edit Wishlist Item
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedItem.item_type === 'shared' ? 'Shared wishlist item' : 'Personal wishlist item'}
                  </p>
                </div>
                <button
                  onClick={handleCloseEditItem}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Close edit modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Price (USD)</label>
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer select-none mt-2">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={(editForm.priority ?? 0) >= 1}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, priority: e.target.checked ? 1 : 0 }))}
                      />
                      <div className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-rose-500 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Most Wanted</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Product URL</label>
                  <input
                    type="url"
                    value={editForm.link}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, link: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://example.com/item"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={editForm.image_url}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, image_url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://example.com/image.jpg"
                  />
                  {editForm.image_url && (
                    <img
                      src={editForm.image_url}
                      alt="Wishlist item preview"
                      className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleCloseEditItem}
                    className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveItem}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
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
      case 'shared-wishlists':
        return <SharedWishlistsTab />;
      case 'items':
        return <ItemsTab />;
      case 'carts':
        return <CartsTab />;
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
