/**
 * Browser Resource Manager for Hot/Cold Storage Architecture
 * 
 * Manages browser resources including wake locks, visibility handling,
 * tab focus detection, and resource optimization for heavy operations.
 */

// AIDEV-NOTE: Browser resource management configuration
const RESOURCE_CONFIG = {
  // Wake lock settings
  WAKE_LOCK_TYPES: ['screen'], // Available: 'screen', 'system' (system not widely supported)
  AUTO_RELEASE_TIMEOUT: 600000, // Auto-release wake lock after 10 minutes
  
  // Visibility and focus settings
  BACKGROUND_THROTTLE_DELAY: 5000,    // Throttle background operations after 5s
  FOCUS_RESUME_DELAY: 1000,           // Resume operations 1s after focus
  
  // Resource optimization
  HEAVY_OPERATION_THRESHOLD: 10000,   // Operations > 10s are considered heavy
  BACKGROUND_OPERATION_LIMIT: 2,      // Max concurrent background operations
  
  // Connection monitoring
  CONNECTION_CHECK_INTERVAL: 30000,   // Check connection every 30s
  OFFLINE_RETRY_DELAY: 5000,          // Retry offline operations after 5s
  
  // Battery optimization
  LOW_BATTERY_THRESHOLD: 0.2,         // 20% battery is considered low
  CRITICAL_BATTERY_THRESHOLD: 0.1     // 10% battery is critical
};

class BrowserResourceManager {
  constructor() {
    this.isInitialized = false;
    
    // Wake lock management
    this.wakeLock = null;
    this.wakeLockReleaseTimeout = null;
    this.wakeLockRequests = new Set();
    
    // Visibility and focus tracking
    this.isVisible = !document.hidden;
    this.hasFocus = document.hasFocus();
    this.backgroundStartTime = null;
    
    // Resource state
    this.resourceState = {
      isOnline: navigator.onLine,
      connection: this.getConnectionInfo(),
      battery: null,
      memory: null,
      lastActivity: new Date()
    };
    
    // Operation tracking
    this.heavyOperations = new Map();
    this.backgroundOperations = new Set();
    
    // Event listeners
    this.visibilityListeners = new Set();
    this.focusListeners = new Set();
    this.connectionListeners = new Set();
    this.batteryListeners = new Set();
    
    // Throttling and optimization
    this.backgroundThrottle = null;
    this.connectionCheckInterval = null;
    
    // Auto-initialize
    this.initialize();
  }

  // AIDEV-NOTE: Initialize browser resource manager
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Setup visibility change monitoring
      this.setupVisibilityMonitoring();
      
      // Setup focus change monitoring
      this.setupFocusMonitoring();
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
      // Setup battery monitoring (if available)
      await this.setupBatteryMonitoring();
      
      // Setup activity tracking
      this.setupActivityTracking();
      
      // Start connection checking
      this.startConnectionChecking();
      
      this.isInitialized = true;
      console.log('BrowserResourceManager initialized successfully', {
        wakeLockSupported: 'wakeLock' in navigator,
        batterySupported: 'getBattery' in navigator,
        connectionSupported: 'connection' in navigator,
        visibilitySupported: 'visibilityState' in document
      });
      
    } catch (error) {
      console.error('BrowserResourceManager initialization failed:', error);
      throw error;
    }
  }

  // AIDEV-NOTE: Setup page visibility monitoring
  setupVisibilityMonitoring() {
    const handleVisibilityChange = () => {
      const wasVisible = this.isVisible;
      this.isVisible = !document.hidden;
      
      if (wasVisible && !this.isVisible) {
        // Page became hidden
        this.backgroundStartTime = new Date();
        this.handlePageHidden();
      } else if (!wasVisible && this.isVisible) {
        // Page became visible
        this.backgroundStartTime = null;
        this.handlePageVisible();
      }
      
      this.notifyVisibilityListeners(this.isVisible);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for page unload
    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });
  }

  // AIDEV-NOTE: Setup window focus monitoring
  setupFocusMonitoring() {
    const handleFocusChange = (focused) => {
      const hadFocus = this.hasFocus;
      this.hasFocus = focused;
      
      if (hadFocus !== focused) {
        this.notifyFocusListeners(focused);
        
        if (focused) {
          this.handleFocusGained();
        } else {
          this.handleFocusLost();
        }
      }
    };
    
    window.addEventListener('focus', () => handleFocusChange(true));
    window.addEventListener('blur', () => handleFocusChange(false));
  }

  // AIDEV-NOTE: Setup connection monitoring
  setupConnectionMonitoring() {
    const handleConnectionChange = () => {
      const wasOnline = this.resourceState.isOnline;
      this.resourceState.isOnline = navigator.onLine;
      this.resourceState.connection = this.getConnectionInfo();
      
      if (wasOnline !== this.resourceState.isOnline) {
        this.notifyConnectionListeners(this.resourceState.isOnline);
        
        if (this.resourceState.isOnline) {
          this.handleConnectionRestored();
        } else {
          this.handleConnectionLost();
        }
      }
    };
    
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
  }

  // AIDEV-NOTE: Setup battery monitoring (if available)
  async setupBatteryMonitoring() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        this.resourceState.battery = {
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        };
        
        // Listen for battery changes
        const updateBattery = () => {
          this.resourceState.battery = {
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
          };
          
          this.notifyBatteryListeners(this.resourceState.battery);
          this.checkBatteryOptimization();
        };
        
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }
    } catch (error) {
      console.warn('Battery monitoring setup failed:', error);
    }
  }

  // AIDEV-NOTE: Setup user activity tracking
  setupActivityTracking() {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      this.resourceState.lastActivity = new Date();
    };
    
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, updateActivity, { passive: true });
    });
  }

  // AIDEV-NOTE: Start connection quality checking
  startConnectionChecking() {
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionQuality();
    }, RESOURCE_CONFIG.CONNECTION_CHECK_INTERVAL);
  }

  // AIDEV-NOTE: Request wake lock for heavy operations
  async requestWakeLock(operationId, reason = 'Heavy operation in progress') {
    try {
      if (!('wakeLock' in navigator)) {
        console.warn('Wake Lock API not supported');
        return false;
      }
      
      // If we already have a wake lock, just track the request
      if (this.wakeLock && !this.wakeLock.released) {
        this.wakeLockRequests.add(operationId);
        console.log(`Added wake lock request: ${operationId}`);
        return true;
      }
      
      // Request new wake lock
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLockRequests.add(operationId);
      
      // Setup auto-release timeout
      this.setupWakeLockTimeout();
      
      // Listen for wake lock release
      this.wakeLock.addEventListener('release', () => {
        console.log('Wake lock released');
        this.wakeLock = null;
        this.clearWakeLockTimeout();
      });
      
      console.log(`Wake lock acquired for: ${operationId} (${reason})`);
      return true;
      
    } catch (error) {
      console.error('Failed to acquire wake lock:', error);
      return false;
    }
  }

  // AIDEV-NOTE: Release wake lock for specific operation
  async releaseWakeLock(operationId) {
    this.wakeLockRequests.delete(operationId);
    console.log(`Removed wake lock request: ${operationId}`);
    
    // If no more requests, release the wake lock
    if (this.wakeLockRequests.size === 0 && this.wakeLock && !this.wakeLock.released) {
      try {
        await this.wakeLock.release();
        console.log('Wake lock released - no more active requests');
      } catch (error) {
        console.error('Failed to release wake lock:', error);
      }
    }
  }

  // AIDEV-NOTE: Setup automatic wake lock timeout
  setupWakeLockTimeout() {
    this.clearWakeLockTimeout();
    
    this.wakeLockReleaseTimeout = setTimeout(async () => {
      if (this.wakeLock && !this.wakeLock.released) {
        console.warn('Auto-releasing wake lock due to timeout');
        try {
          await this.wakeLock.release();
        } catch (error) {
          console.error('Failed to auto-release wake lock:', error);
        }
      }
    }, RESOURCE_CONFIG.AUTO_RELEASE_TIMEOUT);
  }

  // AIDEV-NOTE: Clear wake lock timeout
  clearWakeLockTimeout() {
    if (this.wakeLockReleaseTimeout) {
      clearTimeout(this.wakeLockReleaseTimeout);
      this.wakeLockReleaseTimeout = null;
    }
  }

  // AIDEV-NOTE: Track heavy operation
  trackHeavyOperation(operationId, description, estimatedDuration) {
    const operation = {
      id: operationId,
      description,
      estimatedDuration,
      startTime: new Date(),
      wakeLockRequested: false
    };
    
    this.heavyOperations.set(operationId, operation);
    
    // Request wake lock for heavy operations
    if (estimatedDuration >= RESOURCE_CONFIG.HEAVY_OPERATION_THRESHOLD) {
      this.requestWakeLock(operationId, description);
      operation.wakeLockRequested = true;
    }
    
    console.log(`Tracking heavy operation: ${operationId} (${description})`);
  }

  // AIDEV-NOTE: Complete heavy operation
  completeHeavyOperation(operationId) {
    const operation = this.heavyOperations.get(operationId);
    if (!operation) return;
    
    const duration = new Date() - operation.startTime;
    
    // Release wake lock if we requested it
    if (operation.wakeLockRequested) {
      this.releaseWakeLock(operationId);
    }
    
    this.heavyOperations.delete(operationId);
    console.log(`Completed heavy operation: ${operationId} (${duration}ms)`);
  }

  // AIDEV-NOTE: Handle page becoming hidden
  handlePageHidden() {
    console.log('Page hidden - optimizing background operations');
    
    // Throttle background operations
    this.backgroundThrottle = setTimeout(() => {
      this.throttleBackgroundOperations();
    }, RESOURCE_CONFIG.BACKGROUND_THROTTLE_DELAY);
  }

  // AIDEV-NOTE: Handle page becoming visible
  handlePageVisible() {
    console.log('Page visible - resuming normal operations');
    
    // Clear background throttling
    if (this.backgroundThrottle) {
      clearTimeout(this.backgroundThrottle);
      this.backgroundThrottle = null;
    }
    
    // Resume operations after brief delay
    setTimeout(() => {
      this.resumeNormalOperations();
    }, RESOURCE_CONFIG.FOCUS_RESUME_DELAY);
  }

  // AIDEV-NOTE: Handle window focus gained
  handleFocusGained() {
    console.log('Window focus gained');
    this.resumeNormalOperations();
  }

  // AIDEV-NOTE: Handle window focus lost
  handleFocusLost() {
    console.log('Window focus lost');
    // Potentially throttle operations, but less aggressively than hidden page
  }

  // AIDEV-NOTE: Handle connection lost
  handleConnectionLost() {
    console.warn('Connection lost - pausing network operations');
    
    // Pause heavy network operations
    for (const [operationId, operation] of this.heavyOperations) {
      if (operation.description.includes('network') || operation.description.includes('download')) {
        console.log(`Pausing network operation: ${operationId}`);
      }
    }
  }

  // AIDEV-NOTE: Handle connection restored
  handleConnectionRestored() {
    console.log('Connection restored - resuming network operations');
    
    // Resume paused network operations
    setTimeout(() => {
      this.resumeNetworkOperations();
    }, RESOURCE_CONFIG.OFFLINE_RETRY_DELAY);
  }

  // AIDEV-NOTE: Handle page unload
  handlePageUnload() {
    // Release all wake locks
    if (this.wakeLock && !this.wakeLock.released) {
      this.wakeLock.release().catch(console.error);
    }
    
    // Complete all tracked operations
    for (const operationId of this.heavyOperations.keys()) {
      this.completeHeavyOperation(operationId);
    }
  }

  // AIDEV-NOTE: Throttle background operations
  throttleBackgroundOperations() {
    if (!this.isVisible && this.backgroundOperations.size > RESOURCE_CONFIG.BACKGROUND_OPERATION_LIMIT) {
      console.log('Throttling background operations');
      
      // Limit concurrent background operations
      // This is where you'd implement actual throttling logic
      // For now, just log the action
    }
  }

  // AIDEV-NOTE: Resume normal operations
  resumeNormalOperations() {
    console.log('Resuming normal operations');
    
    // Clear any throttling
    this.backgroundOperations.clear();
    
    // Resume heavy operations if appropriate
    for (const [operationId, operation] of this.heavyOperations) {
      console.log(`Resuming operation: ${operationId}`);
    }
  }

  // AIDEV-NOTE: Resume network operations
  resumeNetworkOperations() {
    if (!this.resourceState.isOnline) return;
    
    console.log('Resuming network operations');
    
    // This is where you'd implement logic to resume paused network operations
    // For now, just log the action
  }

  // AIDEV-NOTE: Check connection quality
  async checkConnectionQuality() {
    if (!this.resourceState.isOnline) return;
    
    try {
      // Simple connection quality check using a small request
      const startTime = performance.now();
      const response = await fetch('/favicon.ico', { method: 'HEAD' });
      const duration = performance.now() - startTime;
      
      this.resourceState.connection.latency = duration;
      this.resourceState.connection.lastCheck = new Date();
      
      console.log(`Connection quality check: ${duration}ms`);
      
    } catch (error) {
      console.warn('Connection quality check failed:', error);
      this.resourceState.connection.lastCheck = new Date();
    }
  }

  // AIDEV-NOTE: Check battery optimization needs
  checkBatteryOptimization() {
    const battery = this.resourceState.battery;
    if (!battery) return;
    
    if (battery.level <= RESOURCE_CONFIG.CRITICAL_BATTERY_THRESHOLD && !battery.charging) {
      console.warn('Critical battery level - implementing aggressive power saving');
      this.implementPowerSaving('critical');
    } else if (battery.level <= RESOURCE_CONFIG.LOW_BATTERY_THRESHOLD && !battery.charging) {
      console.warn('Low battery level - implementing power saving');
      this.implementPowerSaving('low');
    }
  }

  // AIDEV-NOTE: Implement power saving measures
  implementPowerSaving(level) {
    console.log(`Implementing ${level} power saving measures`);
    
    if (level === 'critical') {
      // Release all wake locks
      this.wakeLockRequests.clear();
      if (this.wakeLock && !this.wakeLock.released) {
        this.wakeLock.release().catch(console.error);
      }
      
      // Pause heavy operations
      this.throttleBackgroundOperations();
    } else if (level === 'low') {
      // Reduce background activity
      this.throttleBackgroundOperations();
    }
  }

  // AIDEV-NOTE: Get connection information
  getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        type: connection.type
      };
    }
    
    return {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
      type: 'unknown'
    };
  }

  // AIDEV-NOTE: Get current resource status
  getResourceStatus() {
    return {
      visibility: {
        isVisible: this.isVisible,
        hasFocus: this.hasFocus,
        backgroundDuration: this.backgroundStartTime 
          ? new Date() - this.backgroundStartTime 
          : 0
      },
      wakeLock: {
        isActive: this.wakeLock && !this.wakeLock.released,
        activeRequests: this.wakeLockRequests.size,
        requests: Array.from(this.wakeLockRequests)
      },
      connection: {
        isOnline: this.resourceState.isOnline,
        ...this.resourceState.connection
      },
      battery: this.resourceState.battery,
      operations: {
        heavy: this.heavyOperations.size,
        background: this.backgroundOperations.size
      },
      lastActivity: this.resourceState.lastActivity
    };
  }

  // AIDEV-NOTE: Event listener registration methods
  onVisibilityChange(listener) {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  onFocusChange(listener) {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  onConnectionChange(listener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onBatteryChange(listener) {
    this.batteryListeners.add(listener);
    return () => this.batteryListeners.delete(listener);
  }

  // AIDEV-NOTE: Event notification methods
  notifyVisibilityListeners(isVisible) {
    for (const listener of this.visibilityListeners) {
      try {
        listener(isVisible);
      } catch (error) {
        console.error('Visibility listener error:', error);
      }
    }
  }

  notifyFocusListeners(hasFocus) {
    for (const listener of this.focusListeners) {
      try {
        listener(hasFocus);
      } catch (error) {
        console.error('Focus listener error:', error);
      }
    }
  }

  notifyConnectionListeners(isOnline) {
    for (const listener of this.connectionListeners) {
      try {
        listener(isOnline, this.resourceState.connection);
      } catch (error) {
        console.error('Connection listener error:', error);
      }
    }
  }

  notifyBatteryListeners(battery) {
    for (const listener of this.batteryListeners) {
      try {
        listener(battery);
      } catch (error) {
        console.error('Battery listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Cleanup and shutdown
  destroy() {
    // Stop monitoring
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Clear timeouts
    this.clearWakeLockTimeout();
    if (this.backgroundThrottle) {
      clearTimeout(this.backgroundThrottle);
      this.backgroundThrottle = null;
    }
    
    // Release wake locks
    this.wakeLockRequests.clear();
    if (this.wakeLock && !this.wakeLock.released) {
      this.wakeLock.release().catch(console.error);
    }
    
    // Complete all operations
    for (const operationId of this.heavyOperations.keys()) {
      this.completeHeavyOperation(operationId);
    }
    
    // Clear listeners
    this.visibilityListeners.clear();
    this.focusListeners.clear();
    this.connectionListeners.clear();
    this.batteryListeners.clear();
    
    this.isInitialized = false;
    console.log('BrowserResourceManager destroyed');
  }
}

// AIDEV-NOTE: Create singleton instance
export const browserResourceManager = new BrowserResourceManager();

// AIDEV-NOTE: Export class for testing
export { BrowserResourceManager, RESOURCE_CONFIG };