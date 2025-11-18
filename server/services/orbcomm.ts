// Enhanced Orbcomm API integration with fallback to mock data
export {
  fetchOrbcommDeviceData,
  fetchAllDevicesData,
  detectAnomalies,
  initializeOrbcommConnection,
  populateOrbcommDevices,
  getOrbcommClient
} from './orbcomm-real';

// Export enhanced functions
export {
  initializeEnhancedOrbcommConnection,
  populateEnhancedOrbcommDevices,
  getEnhancedOrbcommClient
} from './orbcomm-enhanced';

// Export INTEG environment functions
export {
  initializeOrbcommIntegConnection,
  populateOrbcommIntegDevices,
  getOrbcommIntegClient
} from './orbcomm-integ';
