import { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  CheckIcon, 
  ClockIcon,
  CalendarIcon,
  FlagIcon,
  StarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { SuiRewardManager, getTaskReward, formatSuiAmount } from './utils/suiRewards.js';

// Predefined pool of 20 tasks
const TASK_POOL = [
  { id: 1, title: "Connect IoT device to network", description: "Establish connection between IoT device and main network", category: "connectivity", difficulty: "easy" },
  { id: 2, title: "Calibrate temperature sensor", description: "Ensure temperature readings are accurate within ±0.5°C", category: "calibration", difficulty: "medium" },
  { id: 3, title: "Set up data logging system", description: "Configure automatic data collection and storage", category: "data", difficulty: "medium" },
  { id: 4, title: "Test Bluetooth connectivity", description: "Verify BLE connection stability and data transfer", category: "connectivity", difficulty: "easy" },
  { id: 5, title: "Monitor air quality for 24 hours", description: "Collect continuous air quality data for one full day", category: "monitoring", difficulty: "hard" },
  { id: 6, title: "Optimize power consumption", description: "Reduce device power usage by 20%", category: "optimization", difficulty: "hard" },
  { id: 7, title: "Create data visualization dashboard", description: "Build charts and graphs for sensor data display", category: "ui", difficulty: "medium" },
  { id: 8, title: "Implement error handling", description: "Add robust error handling for device failures", category: "development", difficulty: "medium" },
  { id: 9, title: "Test device in extreme conditions", description: "Verify operation in high/low temperature environments", category: "testing", difficulty: "hard" },
  { id: 10, title: "Set up automated alerts", description: "Configure notifications for critical sensor readings", category: "automation", difficulty: "medium" },
  { id: 11, title: "Backup configuration data", description: "Create backup of all device settings and parameters", category: "maintenance", difficulty: "easy" },
  { id: 12, title: "Update firmware to latest version", description: "Install most recent device firmware update", category: "maintenance", difficulty: "medium" },
  { id: 13, title: "Test data encryption", description: "Verify that all data transmission is properly encrypted", category: "security", difficulty: "hard" },
  { id: 14, title: "Create user documentation", description: "Write clear instructions for device operation", category: "documentation", difficulty: "medium" },
  { id: 15, title: "Implement data backup system", description: "Set up automatic data backup to cloud storage", category: "data", difficulty: "medium" },
  { id: 16, title: "Test device range limits", description: "Determine maximum reliable communication distance", category: "testing", difficulty: "hard" },
  { id: 17, title: "Optimize sensor placement", description: "Find optimal location for maximum sensor accuracy", category: "optimization", difficulty: "medium" },
  { id: 18, title: "Set up remote monitoring", description: "Enable device monitoring from external locations", category: "connectivity", difficulty: "hard" },
  { id: 19, title: "Test device recovery procedures", description: "Verify device can recover from various failure modes", category: "testing", difficulty: "medium" },
  { id: 20, title: "Create maintenance schedule", description: "Develop routine maintenance checklist and timeline", category: "maintenance", difficulty: "easy" }
];

function Tasks({ suiClient, connectedWallet }) {
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [filter, setFilter] = useState('assigned'); // assigned, completed, available
  const [showRewards, setShowRewards] = useState(false);
  const [totalRewards, setTotalRewards] = useState(0);
  const [rewardManager, setRewardManager] = useState(null);

  // Load user's tasks from localStorage on component mount
  useEffect(() => {
    const savedAssigned = localStorage.getItem('aeroband-assigned-tasks');
    const savedCompleted = localStorage.getItem('aeroband-completed-tasks');
    const savedRewards = localStorage.getItem('aeroband-total-rewards');
    
    if (savedAssigned) {
      setAssignedTasks(JSON.parse(savedAssigned));
    }
    if (savedCompleted) {
      setCompletedTasks(JSON.parse(savedCompleted));
    }
    if (savedRewards) {
      setTotalRewards(parseFloat(savedRewards));
    }
    
    // Generate available tasks (excluding already assigned/completed)
    generateAvailableTasks();
    
    // Initialize reward manager if wallet is connected
    if (suiClient && connectedWallet) {
      const manager = new SuiRewardManager(suiClient, connectedWallet);
      setRewardManager(manager);
    }
  }, [suiClient, connectedWallet]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aeroband-assigned-tasks', JSON.stringify(assignedTasks));
  }, [assignedTasks]);

  useEffect(() => {
    localStorage.setItem('aeroband-completed-tasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  useEffect(() => {
    localStorage.setItem('aeroband-total-rewards', totalRewards.toString());
  }, [totalRewards]);

  // Generate available tasks (excluding already assigned/completed)
  const generateAvailableTasks = () => {
    const assignedIds = assignedTasks.map(t => t.id);
    const completedIds = completedTasks.map(t => t.id);
    const excludedIds = [...assignedIds, ...completedIds];
    
    const available = TASK_POOL.filter(task => !excludedIds.includes(task.id));
    setAvailableTasks(available);
  };

  // Assign a random task to user (max 5)
  const assignRandomTask = () => {
    if (assignedTasks.length >= 5) {
      alert('You can only have 5 active tasks at a time. Complete some tasks first!');
      return;
    }

    if (availableTasks.length === 0) {
      alert('No more tasks available! Complete some tasks to get new ones.');
      return;
    }

    // Select random task from available pool
    const randomIndex = Math.floor(Math.random() * availableTasks.length);
    const selectedTask = availableTasks[randomIndex];
    
    // Add assigned date and status
    const assignedTask = {
      ...selectedTask,
      assignedAt: new Date().toISOString(),
      status: 'in-progress'
    };

    setAssignedTasks([...assignedTasks, assignedTask]);
    generateAvailableTasks(); // Regenerate available tasks
  };

  // Complete a task and award SUI coins
  const completeTask = async (taskId) => {
    const task = assignedTasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const reward = getTaskReward(task.difficulty);
      
      // Try to award SUI coins if wallet is connected
      if (rewardManager && connectedWallet?.accounts?.[0]?.address) {
        try {
          await rewardManager.awardCoins(connectedWallet.accounts[0].address, reward);
        } catch (rewardError) {
          console.warn('Could not award real SUI coins, using simulation:', rewardError);
          // Fall back to simulation if real reward fails
          rewardManager.simulateReward(reward);
        }
      } else {
        // Simulate reward if no wallet connected
        if (rewardManager) {
          rewardManager.simulateReward(reward);
        }
      }
      
      // Move task from assigned to completed
      setAssignedTasks(assignedTasks.filter(t => t.id !== taskId));
      setCompletedTasks([...completedTasks, { ...task, completedAt: new Date().toISOString() }]);
      
      // Update total rewards
      setTotalRewards(prev => prev + reward);
      
      // Show success message
      const message = rewardManager && connectedWallet?.accounts?.[0]?.address 
        ? `🎉 Task completed! You earned ${formatSuiAmount(reward)}!`
        : `🎉 Task completed! You earned ${formatSuiAmount(reward)} (Simulated)!`;
      alert(message);
      
      // Regenerate available tasks
      generateAvailableTasks();
      
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Error completing task. Please try again.');
    }
  };

  // Abandon a task (return to available pool)
  const abandonTask = (taskId) => {
    const task = assignedTasks.find(t => t.id === taskId);
    if (!task) return;

    setAssignedTasks(assignedTasks.filter(t => t.id !== taskId));
    generateAvailableTasks(); // Regenerate available tasks
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'hard': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Get difficulty icon
  const getDifficultyIcon = (difficulty) => {
    switch (difficulty) {
      case 'easy': return <StarIcon className="w-4 h-4" />;
      case 'medium': return <FlagIcon className="w-4 h-4" />;
      case 'hard': return <ExclamationTriangleIcon className="w-4 h-4" />;
      default: return <StarIcon className="w-4 h-4" />;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get task statistics
  const stats = {
    assigned: assignedTasks.length,
    completed: completedTasks.length,
    available: availableTasks.length,
    totalRewards: totalRewards.toFixed(6)
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">IoT Task Challenge</h1>
        <p className="text-gray-600 dark:text-gray-400">Complete tasks to earn SUI coins and improve your IoT project</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600">{stats.assigned}/5</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Tasks</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-purple-600">{stats.available}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Available</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-yellow-600">{stats.totalRewards}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">SUI Earned</div>
        </div>
      </div>

      {/* Task Assignment */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Get New Tasks</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You can have up to 5 active tasks. Complete tasks to earn SUI coins and unlock new challenges!
            </p>
          </div>
          <button
            onClick={assignRandomTask}
            disabled={assignedTasks.length >= 5 || availableTasks.length === 0}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              assignedTasks.length >= 5 || availableTasks.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <SparklesIcon className="w-5 h-5" />
            Get Random Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setFilter('assigned')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'assigned' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Active Tasks ({assignedTasks.length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'completed' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Completed ({completedTasks.length})
        </button>
        <button
          onClick={() => setFilter('available')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'available' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Available ({availableTasks.length})
        </button>
      </div>

      {/* Task Lists */}
      {filter === 'assigned' && (
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Your Active Tasks</h3>
          {assignedTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No active tasks. Click "Get Random Task" to start earning SUI coins!
            </div>
          ) : (
            assignedTasks.map(task => (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100">{task.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getDifficultyColor(task.difficulty)}`}>
                        {getDifficultyIcon(task.difficulty)}
                        {task.difficulty}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 flex items-center gap-1">
                        <CurrencyDollarIcon className="w-3 h-3" />
                        {getTaskReward(task.difficulty)} SUI
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{task.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        Assigned: {formatDate(task.assignedAt)}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 text-xs">
                        {task.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => completeTask(task.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Complete
                    </button>
                    <button
                      onClick={() => abandonTask(task.id)}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Abandon
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {filter === 'completed' && (
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Completed Tasks</h3>
          {completedTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No completed tasks yet. Start working on your first task!
            </div>
          ) : (
            completedTasks.map(task => (
              <div
                key={task.id}
                className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 line-through">{task.title}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        Completed
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 flex items-center gap-1">
                        <CurrencyDollarIcon className="w-3 h-3" />
                        {getTaskReward(task.difficulty)} SUI earned
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{task.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                      <span>Completed: {formatDate(task.completedAt)}</span>
                      <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 text-xs">
                        {task.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {filter === 'available' && (
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Available Tasks</h3>
          {availableTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No more tasks available! Complete some active tasks to unlock new challenges.
            </div>
          ) : (
            availableTasks.map(task => (
              <div
                key={task.id}
                className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100">{task.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getDifficultyColor(task.difficulty)}`}>
                        {getDifficultyIcon(task.difficulty)}
                        {task.difficulty}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 flex items-center gap-1">
                        <CurrencyDollarIcon className="w-3 h-3" />
                        {getTaskReward(task.difficulty)} SUI
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{task.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                      <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 text-xs">
                        {task.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => assignRandomTask()}
                    disabled={assignedTasks.length >= 5}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      assignedTasks.length >= 5
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    Assign Task
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Tasks;
