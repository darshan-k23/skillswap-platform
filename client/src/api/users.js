// src/api/users.js
// All Axios calls for User endpoints
import axiosInstance from './axios'

export const usersAPI = {
  getAll:   (params) => axiosInstance.get('/users', { params }),
  getById:  (id)     => axiosInstance.get(`/users/${id}`),
  update:   (id, data) => axiosInstance.put(`/users/${id}`, data),
}
