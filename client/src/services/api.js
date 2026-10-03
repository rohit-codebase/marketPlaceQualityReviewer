import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s for AI review calls
});

// Cache structures
const inFlightRequests = new Map(); // key -> Promise
const responseCache = new Map();   // key -> { data, expiresAt }
const CACHE_TTL_MS = 10000;         // 10 seconds cache for identical read queries

function buildKey(url, params) {
  return `${url}?${new URLSearchParams(params || {}).toString()}`;
}

// Invalidate read cache when write operations occur
function invalidateCache() {
  responseCache.clear();
}

// Response interceptor — normalize errors and handle 429
axiosInstance.interceptors.response.use(
  (res) => res,
  (err) => {
    let message = 'Network error. Please check your connection.';
    let isRateLimited = false;

    if (err.response) {
      if (err.response.status === 429) {
        isRateLimited = true;
        message =
          err.response.data?.error ||
          'Too many requests. Please wait a moment before trying again.';
      } else {
        message = err.response.data?.error || `Request failed with status ${err.response.status}`;
      }
    } else if (err.code === 'ECONNABORTED') {
      message = 'Request timed out. Please try again.';
    }

    const enhancedError = new Error(message);
    enhancedError.isRateLimited = isRateLimited;
    enhancedError.statusCode = err.response?.status;
    return Promise.reject(enhancedError);
  }
);

// Wrapped API client with deduplication & caching on GET
const api = {
  get: (url, config = {}) => {
    const { params, skipCache = false, ...restConfig } = config;
    const cacheKey = buildKey(url, params);

    // 1. Check memory cache (unless skipCache is specified)
    if (!skipCache && responseCache.has(cacheKey)) {
      const cached = responseCache.get(cacheKey);
      if (Date.now() < cached.expiresAt) {
        return Promise.resolve({ data: cached.data, status: 200, fromCache: true });
      }
      responseCache.delete(cacheKey);
    }

    // 2. Check in-flight requests (deduplication)
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    // 3. Dispatch request and track in-flight promise
    const requestPromise = axiosInstance
      .get(url, { params, ...restConfig })
      .then((response) => {
        responseCache.set(cacheKey, {
          data: response.data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return response;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  post: (url, data, config) => {
    invalidateCache();
    return axiosInstance.post(url, data, config);
  },

  put: (url, data, config) => {
    invalidateCache();
    return axiosInstance.put(url, data, config);
  },

  delete: (url, config) => {
    invalidateCache();
    return axiosInstance.delete(url, config);
  },

  invalidateCache,
};

export default api;
