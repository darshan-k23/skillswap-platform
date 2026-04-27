// src/api/auth.js
// All Axios calls for Authentication endpoints
import axiosInstance from './axios'

export const authAPI = {
  register: (data)   => axiosInstance.post('/auth/register', data),
  login:    (data)   => axiosInstance.post('/auth/login', data),
  getMe:    ()       => axiosInstance.get('/auth/me'),
}
