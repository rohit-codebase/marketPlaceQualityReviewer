import api from './api';

export const listingService = {
  getAll: (params) => api.get('/listings', { params }).then((r) => r.data),
  getById: (id) => api.get(`/listings/${id}`).then((r) => r.data),
  create: (data) => api.post('/listings', data).then((r) => r.data),
  update: (id, data) => api.put(`/listings/${id}`, data).then((r) => r.data),
  getDashboard: () => api.get('/listings/dashboard').then((r) => r.data),
};

export const reviewService = {
  trigger: (listingId) => api.post('/reviews', { listingId }).then((r) => r.data),
  getById: (id, options = {}) => api.get(`/reviews/${id}`, options).then((r) => r.data),
  submitAction: (reviewId, actionData) =>
    api.post(`/reviews/${reviewId}/actions`, actionData).then((r) => r.data),
  getHistory: ({ skipCache, ...params } = {}) =>
    api.get('/reviews/history', { params, skipCache }).then((r) => r.data),
  getHistoryDetail: (id, options = {}) =>
    api.get(`/reviews/history/${id}`, options).then((r) => r.data),
};

export const batchService = {
  start: (listingIds) => api.post('/batch-reviews', { listingIds }).then((r) => r.data),
  getStatus: (batchId) => api.get(`/batch-reviews/${batchId}`).then((r) => r.data),
};

export const policyService = {
  getAll: () => api.get('/policies').then((r) => r.data),
};
