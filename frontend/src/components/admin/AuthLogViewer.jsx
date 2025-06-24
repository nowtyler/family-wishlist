import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, RefreshCw, Filter, Eye, EyeOff, 
  Search, Calendar, User, Shield, AlertTriangle,
  CheckCircle, XCircle, Clock, MapPin, Info
} from 'lucide-react';
import { getAuthLogs } from '../../services/api';
import { toast } from 'react-toastify';
import { formatDateEST } from '../../utils/dateUtils';

const AuthLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  
  // Filter states
  const [filters, setFilters] = useState({
    event_type: '',
    username: '',
    success_only: null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Event type options
  const eventTypes = [
    'LOGIN', 'LOGOUT', 'REGISTER', 'PASSWORD_RESET_REQUEST', 
    'PASSWORD_RESET_TOKEN', 'PASSWORD_RESET_CONFIRM', 'PASSWORD_RESET_COMPLETE',
    'AUTH_FAILURE', 'AUTH_RESET', 'LOCKOUT', 'LOGIN_ATTEMPT', 'REGISTER_ATTEMPT',
    'EMAIL_SEND', 'LOGIN_ERROR', 'REGISTER_ERROR', 'PASSWORD_RESET_ERROR'
  ];

  const fetchLogs = async (resetOffset = true) => {
    setIsLoading(true);
    try {
      const newOffset = resetOffset ? 0 : offset;
      const params = {
        limit,
        offset: newOffset,
        ...filters
      };

      const response = await getAuthLogs(params);
      const data = response.data;

      if (resetOffset) {
        setLogs(data.logs || []);
        setOffset(0);
      } else {
        setLogs(prev => [...prev, ...(data.logs || [])]);
        setOffset(newOffset + limit);
      }

      setTotal(data.total || 0);
      setHasMore(data.has_more || false);
    } catch (error) {
      console.error('Failed to fetch auth logs:', error);
      toast.error('Failed to load authentication logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      event_type: '',
      username: '',
      success_only: null
    });
    setSearchTerm('');
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchLogs(false);
    }
  };

  const getEventTypeColor = (eventType) => {
    const colorMap = {
      'LOGIN': 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
      'LOGOUT': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
      'REGISTER': 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20',
      'PASSWORD_RESET_REQUEST': 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20',
      'PASSWORD_RESET_TOKEN': 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20',
      'PASSWORD_RESET_CONFIRM': 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20',
      'PASSWORD_RESET_COMPLETE': 'text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/20',
      'AUTH_FAILURE': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
      'AUTH_RESET': 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20',
      'LOCKOUT': 'text-red-700 bg-red-200 dark:text-red-300 dark:bg-red-900/30',
      'LOGIN_ATTEMPT': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20',
      'REGISTER_ATTEMPT': 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20',
      'EMAIL_SEND': 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/20',
      'LOGIN_ERROR': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
      'REGISTER_ERROR': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
      'PASSWORD_RESET_ERROR': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
    };
    return colorMap[eventType] || 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
  };

  const getStatusIcon = (success) => {
    if (success === null) return <Info className="w-4 h-4 text-gray-500" />;
    return success ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.username?.toLowerCase().includes(searchLower) ||
      log.event_type?.toLowerCase().includes(searchLower) ||
      log.ip_address?.toLowerCase().includes(searchLower) ||
      log.details?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
            Authentication Logs
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            {showFilters ? <EyeOff size={16} /> : <Filter size={16} />}
            Filters
          </button>
          <button
            onClick={() => fetchLogs()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Event Type
              </label>
              <select
                value={filters.event_type}
                onChange={(e) => handleFilterChange('event_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Events</option>
                {eventTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={filters.username}
                onChange={(e) => handleFilterChange('username', e.target.value)}
                placeholder="Filter by username"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.success_only === null ? '' : filters.success_only.toString()}
                onChange={(e) => handleFilterChange('success_only', e.target.value === '' ? null : e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="true">Success Only</option>
                <option value="false">Failed Only</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </motion.div>
      )}

      {/* Logs Display */}
      <div className="space-y-3">
        {isLoading && logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No logs found</p>
          </div>
        ) : (
          <>
            {filteredLogs.map((log, index) => (
              <motion.div
                key={`${log.timestamp}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(log.success)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEventTypeColor(log.event_type)}`}>
                        {log.event_type}
                      </span>
                      {log.username && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <User size={14} />
                          <span>{log.username}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{formatDateEST(log.timestamp)}</span>
                      </div>
                      {log.ip_address && (
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          <span>{log.ip_address}</span>
                        </div>
                      )}
                    </div>
                    
                    {log.details && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredLogs.length} of {total} log entries
        </p>
      </div>
    </motion.div>
  );
};

export default AuthLogViewer; 