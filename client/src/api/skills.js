// src/api/skills.js
// All Axios calls for Skill endpoints
import axiosInstance from './axios'

export const skillsAPI = {
  getAll:   (params)   => axiosInstance.get('/skills', { params }),
  create:   (data)     => axiosInstance.post('/skills', data),
  update:   (id, data) => axiosInstance.put(`/skills/${id}`, data),
  remove:   (id)       => axiosInstance.delete(`/skills/${id}`),
}
