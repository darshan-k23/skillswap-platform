// src/api/users.js
// All Axios calls for User endpoints and direct S3 avatar uploads
import axios from 'axios'
import axiosInstance from './axios'

export const usersAPI = {
  getAll: (params) => axiosInstance.get('/users', { params }),
  getById: (id) => axiosInstance.get(`/users/${id}`),
  update: (id, data) => axiosInstance.put(`/users/${id}`, data),

  // S3 Avatar Upload Workflow
  requestAvatarUpload: (id, { fileType, fileSize }) =>
    axiosInstance.post(`/users/${id}/avatar/upload-request`, { fileType, fileSize }),

  confirmAvatarUpload: (id, { key }) =>
    axiosInstance.post(`/users/${id}/avatar/confirm`, { key }),

  deleteAvatar: (id) =>
    axiosInstance.delete(`/users/${id}/avatar`),

  /**
   * Directly uploads the avatar image file to S3 via presigned POST fields.
   * NOTE: Uses raw axios rather than axiosInstance so the Authorization Bearer header is not included,
   * as S3 presigned POST forms will reject unexpected Authorization headers.
   *
   * @param {string} uploadUrl - S3 bucket endpoint URL from presigned POST
   * @param {object} fields - Presigned POST form fields
   * @param {File} file - User selected image file
   * @param {function} [onProgress] - Optional upload progress callback (percent: number)
   */
  uploadToS3: async (uploadUrl, fields, file, onProgress) => {
    const formData = new FormData()

    // Append S3 presigned policy fields first
    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      formData.append(fieldName, fieldValue)
    })

    // S3 expects the file field last in the multipart payload
    formData.append('file', file)

    return axios.post(uploadUrl, formData, {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
  },
}
