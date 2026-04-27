// src/api/requests.js
// All Axios calls for Exchange Request endpoints
import axiosInstance from './axios'

export const requestsAPI = {
  getAll:   (params)   => axiosInstance.get('/requests', { params }),
  create:   (data)     => axiosInstance.post('/requests', data),
  update:   (id, data) => axiosInstance.put(`/requests/${id}`, data),
  remove:   (id)       => axiosInstance.delete(`/requests/${id}`),
}
