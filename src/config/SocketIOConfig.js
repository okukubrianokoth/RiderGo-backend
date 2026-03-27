/**
 * SocketIOConfig.js
 * Socket.IO initialization and real-time event handlers
 * Integrates with RealtimeService for live dashboard updates
 */

import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import realtimeService from '../services/RealtimeService.js'

let io = null

/**
 * Initialize Socket.IO server with authentication and event handlers
 */
export function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
    maxHttpBufferSize: 1e6
  })

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication required'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret')
      socket.userId = decoded.id
      socket.userType = decoded.userType // 'admin', 'rider', 'client'
      socket.userName = decoded.name

      next()
    } catch (error) {
      next(new Error('Invalid token'))
    }
  })

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`[SocketIO] User connected: ${socket.userId} (${socket.userType})`)

    // Register with RealtimeService
    realtimeService.registerConnection(socket, socket.userId, socket.userType)

    // Admin events
    if (socket.userType === 'admin') {
      setupAdminHandlers(socket)
    }

    // Rider events
    if (socket.userType === 'rider') {
      setupRiderHandlers(socket)
    }

    // Client events
    if (socket.userType === 'client') {
      setupClientHandlers(socket)
    }

    // Common events
    setupCommonHandlers(socket)
  })

  return io
}

/**
 * Admin-specific event handlers
 */
function setupAdminHandlers(socket) {
  // Join admin room for broadcast messages
  socket.join('admin-room')

  // Request dashboard data refresh
  socket.on('admin:request-dashboard-refresh', (data) => {
    console.log(`[Admin] Dashboard refresh requested for tabs:`, data.tabs)
    socket.emit('admin:should-refresh', data)
  })

  // Subscribe to fraud alerts
  socket.on('admin:subscribe-fraud', () => {
    socket.join('fraud-alerts')
    socket.emit('admin:fraud-subscribed', {
      message: 'Now receiving real-time fraud alerts'
    })
  })

  // Unsubscribe from fraud alerts
  socket.on('admin:unsubscribe-fraud', () => {
    socket.leave('fraud-alerts')
    socket.emit('admin:fraud-unsubscribed')
  })

  // Subscribe to metrics updates
  socket.on('admin:subscribe-metrics', () => {
    socket.join('metrics-updates')
    socket.emit('admin:metrics-subscribed', {
      message: 'Now receiving real-time metrics'
    })
  })

  // Request system status
  socket.on('admin:system-status', (callback) => {
    const status = realtimeService.getSystemStatus()
    callback(status)
  })

  // Monitor high-risk users
  socket.on('admin:subscribe-high-risk', () => {
    socket.join('high-risk-users')
    socket.emit('admin:high-risk-subscribed')
  })

  // Monitor demand alerts
  socket.on('admin:subscribe-demand', () => {
    socket.join('demand-alerts')
    socket.emit('admin:demand-subscribed')
  })

  // Monitor pricing events
  socket.on('admin:subscribe-pricing', () => {
    socket.join('pricing-events')
    socket.emit('admin:pricing-subscribed')
  })
}

/**
 * Rider-specific event handlers
 */
function setupRiderHandlers(socket) {
  socket.join(`rider-${socket.userId}`)

  // Notify when assigned to a trip
  socket.on('rider:trip-assigned', (tripData) => {
    socket.emit('rider:notification', {
      type: 'trip_assigned',
      tripId: tripData.tripId,
      message: 'You have been assigned a new delivery!',
      timestamp: new Date()
    })
  })

  // Notify of trip status updates
  socket.on('rider:trip-status', (data) => {
    socket.emit('rider:notification', {
      type: 'trip_status',
      status: data.status,
      message: `Trip status: ${data.status}`,
      timestamp: new Date()
    })
  })

  // Track rider online status
  socket.on('rider:set-online', () => {
    realtimeService.broadcastUserOnlineStatus(socket.userId, 'rider', true)
    socket.emit('rider:online-confirmed')
  })

  socket.on('rider:set-offline', () => {
    realtimeService.broadcastUserOnlineStatus(socket.userId, 'rider', false)
  })
}

/**
 * Client-specific event handlers
 */
function setupClientHandlers(socket) {
  socket.join(`client-${socket.userId}`)

  // Notify when a rider accepts their trip
  socket.on('client:trip-accepted', (tripData) => {
    socket.emit('client:notification', {
      type: 'trip_accepted',
      riderId: tripData.riderId,
      riderName: tripData.riderName,
      riderRating: tripData.riderRating,
      message: `${tripData.riderName} has accepted your delivery!`,
      timestamp: new Date()
    })
  })

  // Real-time rider location tracking
  socket.on('client:subscribe-trip-location', (tripId) => {
    socket.join(`trip-location-${tripId}`)
    socket.emit('client:location-subscribed', {
      tripId,
      message: 'You are now tracking your delivery in real-time'
    })
  })

  // Notify of trip status changes
  socket.on('client:trip-status', (data) => {
    socket.emit('client:notification', {
      type: 'trip_status',
      status: data.status,
      message: `Your delivery is ${data.status.replace(/_/g, ' ')}`,
      timestamp: new Date()
    })
  })
}

/**
 * Common event handlers for all users
 */
function setupCommonHandlers(socket) {
  // Ping/pong for connection health
  socket.on('ping', (callback) => {
    callback('pong')
  })

  // Request personal data update
  socket.on('request:profile-update', (callback) => {
    callback({
      status: 'refresh_required',
      message: 'Please refresh your profile data'
    })
  })

  // User activity tracking
  socket.on('user:activity', (activity) => {
    // Could be used for analytics
  })

  // Error handler
  socket.on('error', (error) => {
    console.error(`[SocketIO] Error from ${socket.userId}:`, error)
  })
}

/**
 * Broadcast functions for services to use
 */
export function broadcastToAdmins(event, data) {
  if (io) {
    io.to('admin-room').emit(event, data)
  }
}

export function broadcastFraudAlert(alert) {
  if (io) {
    realtimeService.broadcastFraudAlert(alert)
    io.to('fraud-alerts').emit('fraud:alert', alert)
  }
}

export function broadcastMetricsUpdate(metrics) {
  if (io) {
    realtimeService.broadcastMetrics(metrics)
    io.to('metrics-updates').emit('metrics:update', metrics)
  }
}

export function broadcastTripsUpdate(tripId, update) {
  if (io) {
    realtimeService.broadcastTripUpdate(tripId, update)
    io.to(`trip-${tripId}`).emit('trip:update', update)
  }
}

export function broadcastRiderLocation(tripId, riderId, location) {
  if (io) {
    realtimeService.broadcastRiderLocation(tripId, riderId, location)
    io.to(`trip-location-${tripId}`).emit('location:update', {
      riderId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date()
    })
  }
}

export function broadcastHighRiskUser(userType, user, riskScore) {
  if (io) {
    realtimeService.broadcastHighRiskDetection(userType, user, riskScore)
    io.to('high-risk-users').emit('high-risk:detected', {
      userType,
      userId: user._id,
      riskScore,
      timestamp: new Date()
    })
  }
}

export function broadcastDemandAlert(demandAlert) {
  if (io) {
    realtimeService.broadcastDemandAlert(demandAlert)
    io.to('demand-alerts').emit('demand:alert', demandAlert)
  }
}

export function broadcastSurgeEvent(surgeData) {
  if (io) {
    realtimeService.broadcastSurgeEvent(surgeData)
    io.to('pricing-events').emit('pricing:surge', surgeData)
  }
}

export function broadcastUserBlocked(userId, userType, reason) {
  if (io) {
    realtimeService.broadcastUserStatusChange(userId, userType, 'blocked', reason)
    io.to('admin-room').emit('user:blocked', {
      userId,
      userType,
      reason,
      timestamp: new Date()
    })
    // Notify the blocked user
    io.to(`${userType}-${userId}`).emit('user:blocked-notification', {
      message: `Your account has been blocked. Reason: ${reason}`
    })
  }
}

export function broadcastUserUnblocked(userId, userType) {
  if (io) {
    realtimeService.broadcastUserStatusChange(userId, userType, 'unblocked', 'Account restored')
    io.to(`${userType}-${userId}`).emit('user:unblocked-notification', {
      message: 'Your account has been restored'
    })
  }
}

export function getSocketIOInstance() {
  return io
}

export default {
  initializeSocketIO,
  broadcastToAdmins,
  broadcastFraudAlert,
  broadcastMetricsUpdate,
  broadcastTripsUpdate,
  broadcastRiderLocation,
  broadcastHighRiskUser,
  broadcastDemandAlert,
  broadcastSurgeEvent,
  broadcastUserBlocked,
  broadcastUserUnblocked,
  getSocketIOInstance
}
