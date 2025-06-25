import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, RefreshCw, Filter, Eye, EyeOff, 
  Search, AlertCircle, Info, AlertTriangle, Terminal
} from 'lucide-react';
import { getApplicationLogs } from '../../services/api';
import { toast } from 'react-toastify';
import { formatDateEST } from '../../utils/dateUtils';

const ApplicationLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  
  // Filter states
  const [filters, setFilters] = useState({
    module: '',
    level: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Known modules from the logs
  const modules = [
    'app.auth',
    'app.main',
    'alembic.runtime.migration',
    'app.services.backup_service',
    'app.services.migration_service',
    'app.services.user_auth_service',
    'app.crud'
  ];

  // Log levels with their corresponding colors and icons
  const logLevels = {
    'INFO': { color: 'text-blue-500', icon: Info },
    'WARNING': { color: 'text-yellow-500', icon: AlertTriangle },
    'ERROR': { color: 'text-red-500', icon: AlertCircle },
    'DEBUG': { color: 'text-gray-500', icon: Terminal }
  };

  const fetchLogs = async (resetOffset = true) => {
    setIsLoading(true);
    try {
      const newOffset = resetOffset ? 0 : offset;
      const params = {
        limit,
        offset: newOffset,
        ...filters
      };

      const response = await getApplicationLogs(params);
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
      console.error('Failed to fetch logs:', error);
      toast.error('Failed to load application logs');
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
      module: '',
      level: '',
      search: ''
    });
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchLogs(false);
    }
  };

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
            Application Logs
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

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filters.module}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              className="block w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="">All Modules</option>
              {modules.map(module => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="block w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="">All Levels</option>
              {Object.keys(logLevels).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search logs..."
              className="block w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Log List */}
      <div className="space-y-1">
        {isLoading && logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No logs found</p>
          </div>
        ) : (
          <>
            {logs.map((log, index) => {
              const levelInfo = logLevels[log.level] || { color: 'text-gray-500', icon: Info };
              const Icon = levelInfo.icon;
              
              return (
                <div
                  key={index}
                  className="flex items-start space-x-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors text-sm"
                >
                  <Icon className={`w-4 h-4 mt-1 ${levelInfo.color} flex-shrink-0`} />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDateEST(log.timestamp)}</span>
                      <span className="font-mono">{log.module}</span>
                    </div>
                    <div className="text-gray-900 dark:text-gray-100 break-words">
                      {log.message}
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ApplicationLogViewer; 