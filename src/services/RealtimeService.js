/**
 * RealtimeService.js
 * Real-time event streaming for live dashboards and alerts
 * Handles WebSocket connections, event broadcasting, and live data updates
 */

import { EventEmitter } from 'events'

class RealtimeService extends EventEmitter {
  constructor() {
    super()
    this.connections = new Map() // userId -> Set of sockets
    this.adminConnections = new Set() // Admin user sockets
    this.tripStreams = new Map() // tripId -> Set of connected users
    this.fraudAlerts = [] // Recent fraud alerts for replay
    this.metricsCache = {} // Cached metrics for new connections
  }

  /**
   * Register a new socket connection
   */
  registerConnection(socket, userId, userType = 'admin') {
    if (!userId) {
      console.warn('Connection registered without userId')
      return
    }

    // Store connection
    if (userType === 'admin') {
      this.adminConnections.add(socket)
      console.log(`[RealTime] Admin connected. Total admins: ${this.adminConnections.size}`)
    }

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set())
    }
    this.connections.get(userId).add(socket)

    // Send cached fraud alerts to new admin
    if (userType === 'admin' && this.fraudAlerts.length > 0) {
      socket.emit('fraud:history', {
        alerts: this.fraudAlerts.slice(-50) // Last 50 alerts
      })
    }

    // Send cached metrics
    if (Object.keys(this.metricsCache).length > 0) {
      socket.emit('metrics:cached', this.metricsCache)
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      this.removeConnection(socket, userId, userType)
    })

    // Handle subscription to trip updates
    socket.on('trip:subscribe', (tripId) => {
      this.subscribeTripStream(socket, tripId)
    })

    // Handle unsubscription
    socket.on('trip:unsubscribe', (tripId) => {
      this.unsubscribeTripStream(socket, tripId)
    })
  }

  /**
   * Remove socket connection
   */
  removeConnection(socket, userId, userType = 'admin') {
    if (userType === 'admin') {
      this.adminConnections.delete(socket)
      console.log(`[RealTime] Admin disconnected. Total admins: ${this.adminConnections.size}`)
    }

    if (this.connections.has(userId)) {
      const userSockets = this.connections.get(userId)
      userSockets.delete(socket)

      if (userSockets.size === 0) {
        this.connections.delete(userId)
      }
    }

    // Remove from trip streams
    this.tripStreams.forEach((subscribers) => {
      subscribers.delete(socket)
    })
  }

  /**
   * Subscribe to trip location/status updates
   */
  subscribeTripStream(socket, tripId) {
    if (!this.tripStreams.has(tripId)) {
      this.tripStreams.set(tripId, new Set())
    }
    this.tripStreams.get(tripId).add(socket)
  }

  /**
   * Unsubscribe from trip updates
   */
  unsubscribeTripStream(socket, tripId) {
    if (this.tripStreams.has(tripId)) {
      this.tripStreams.get(tripId).delete(socket)
      
      if (this.tripStreams.get(tripId).size === 0) {
        this.tripStreams.delete(tripId)
      }
    }
  }

  /**
   * Broadcast metrics to all admin connections
   */
  broadcastMetrics(metrics) {
    this.metricsCache = metrics // Cache for new connections

    this.adminConnections.forEach((socket) => {
      socket.emit('metrics:update', {
        timestamp: new Date(),
        ...metrics
      })
    })

    this.emit('metrics:broadcasted', metrics)
  }

  /**
   * Broadcast fraud alert to all admins
   */
  broadcastFraudAlert(alert) {
    const enrichedAlert = {
      ...alert,
      timestamp: new Date(),
      id: `${alert.userId}-${Date.now()}`
    }

    // Store in history (max 100)
    this.fraudAlerts.push(enrichedAlert)
    if (this.fraudAlerts.length > 100) {
      this.fraudAlerts.shift()
    }

    this.adminConnections.forEach((socket) => {
      socket.emit('fraud:alert', enrichedAlert)
    })

    this.emit('fraud:alert:sent', enrichedAlert)
  }

  /**
   * Broadcast new high-risk user detection
   */
  broadcastHighRiskDetection(userType, user, riskScore) {
    const alert = {
      type: 'high_risk_detection',
      userType,
      user: {
        id: user._id,
        name: user.firstName || user.name,
        phone: user.phone,
        riskScore,
        pastAlerts: user.fraudAlerts?.length || 0
      },
      severity: riskScore > 80 ? 'critical' : riskScore > 60 ? 'high' : 'medium'
    }

    this.broadcastFraudAlert(alert)
  }

  /**
   * Broadcast trip status update
   */
  broadcastTripUpdate(tripId, update) {
    const enrichedUpdate = {
      tripId,
      ...update,
      timestamp: new Date(),
      broadcastTo: 'all_subscribers'
    }

    // Send to trip-specific subscribers
    if (this.tripStreams.has(tripId)) {
      this.tripStreams.get(tripId).forEach((socket) => {
        socket.emit('trip:update', enrichedUpdate)
      })
    }

    this.emit('trip:updated', enrichedUpdate)
  }

  /**
   * Broadcast live rider location
   */
  broadcastRiderLocation(tripId, riderId, location) {
    const locationData = {
      tripId,
      riderId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date(),
      accuracy: location.accuracy
    }

    // Send to trip subscribers
    if (this.tripStreams.has(tripId)) {
      this.tripStreams.get(tripId).forEach((socket) => {
        socket.emit('location:update', locationData)
      })
    }
  }

  /**
   * Broadcast user block/unblock event
   */
  broadcastUserStatusChange(userId, userType, action, reason) {
    const event = {
      userId,
      userType,
      action, // 'blocked', 'unblocked'
      reason,
      timestamp: new Date()
    }

    this.adminConnections.forEach((socket) => {
      socket.emit('user:status-changed', event)
    })

    this.emit('user:status-changed', event)
  }

  /**
   * Broadcast user online/offline status
   */
  broadcastUserOnlineStatus(userId, userType, isOnline) {
    const event = {
      userId,
      userType,
      isOnline,
      timestamp: new Date()
    }

    // Send to admins
    this.adminConnections.forEach((socket) => {
      socket.emit('user:online-status', event)
    })
  }

  /**
   * Get real-time system status
   */
  getSystemStatus() {
    return {
      adminConnections: this.adminConnections.size,
      userConnections: this.connections.size,
      activeTripStreams: this.tripStreams.size,
      recentFraudAlerts: this.fraudAlerts.length,
      uptime: process.uptime(),
      timestamp: new Date()
    }
  }

  /**
   * Broadcast dashboard refresh (when data needs reload)
   */
  broadcastDashboardRefresh(tabName = null) {
    const event = {
      action: 'refresh',
      tabs: tabName ? [tabName] : ['overview', 'analytics', 'fraud', 'users', 'pricing'],
      timestamp: new Date()
    }

    this.adminConnections.forEach((socket) => {
      socket.emit('dashboard:refresh', event)
    })
  }

  /**
   * Broadcast surge pricing event
   */
  broadcastSurgeEvent(surgeData) {
    const event = {
      type: 'surge:detected',
      multiplier: surgeData.surgeMultiplier,
      area: surgeData.area,
      demand: surgeData.demandLevel,
      affectedTrips: surgeData.affectedTrips || 0,
      timestamp: new Date()
    }

    this.adminConnections.forEach((socket) => {
      socket.emit('pricing:event', event)
    })
  }

  /**
   * Broadcast demand alert
   */
  broadcastDemandAlert(demandAlert) {
    const alert = {
      type: 'demand:alert',
      area: demandAlert.area,
      demandScore: demandAlert.demandScore,
      pendingRequests: demandAlert.pendingRequests,
      availableRiders: demandAlert.availableRiders,
      severity: demandAlert.demandScore > 80 ? 'critical' : demandAlert.demandScore > 60 ? 'high' : 'medium',
      timestamp: new Date()
    }

    this.adminConnections.forEach((socket) => {
      socket.emit('demand:alert', alert)
    })
  }

  /**
   * Get connection stats for specific user
   */
  getUserConnections(userId) {
    return this.connections.get(userId)?.size || 0
  }

  /**
   * Get all connected admin count
   */
  getAdminCount() {
    return this.adminConnections.size
  }

  /**
   * Clear old fraud alerts (cleanup)
   */
  clearOldAlerts(beforeDate) {
    this.fraudAlerts = this.fraudAlerts.filter(
      (alert) => new Date(alert.timestamp) > beforeDate
    )
  }
}

// Singleton instance
const realtimeService = new RealtimeService()

export default realtimeService
