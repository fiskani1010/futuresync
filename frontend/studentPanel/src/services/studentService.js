import axios from 'axios';

const normalizeApiBase = (rawValue) => {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    return '';
  }
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (/\/api$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }
  return `${withoutTrailingSlash}/api`;
};

const configuredApiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
const fallbackApiBase = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';
const API_BASE_URL = configuredApiBase || fallbackApiBase;
export const AUTH_TOKEN_KEY = 'teacher_auth_token';

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getStoredAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);
export const setStoredAuthToken = (token) => localStorage.setItem(AUTH_TOKEN_KEY, token);
export const clearStoredAuthToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

export const loginTeacher = (username, password) =>
  axios.post(`${API_BASE_URL}/auth/login`, { username, password });

export const registerTeacher = (username, password, fullName) =>
  axios.post(`${API_BASE_URL}/auth/register`, { username, password, fullName });

export const forgotTeacherPassword = (username, newPassword, resetKey) =>
  axios.post(`${API_BASE_URL}/auth/forgot-password`, { username, newPassword, resetKey });

export const getCurrentTeacher = () => api.get('/auth/me');
export const adminCreateLecturer = (username, password, fullName) =>
  api.post('/auth/admin/create-lecturer', { username, password, fullName });
export const adminGenerateResetKey = (username, expiresHours = 24) =>
  api.post('/auth/admin/generate-reset-key', { username, expiresHours });

export const registerStudentSelf = (name, registrationNumber, classCode) =>
  axios.post(`${API_BASE_URL}/public/register`, { name, registrationNumber, classCode });

export const getClasses = () => api.get('/classes');
export const createClass = (className, classCode) => api.post('/classes', { className, classCode });

// GET all students
export const getStudents = (classCode) => api.get('/names', { params: { classCode } });

// POST a new student
export const addStudent = (name, registrationNumber, classCode) =>
  api.post('/add-name', { name, registrationNumber, classCode });

// PUT to update a student
export const updateStudent = (id, name, registrationNumber, classCode) =>
  api.put(`/update-name/${id}`, { name, registrationNumber, classCode });

// DELETE a student
export const deleteStudent = (id, classCode) => api.delete(`/delete-name/${id}`, { params: { classCode } });

// GET gradebook rows for one class
export const getGrades = (classCode) => api.get('/grades', { params: { classCode } });

// SAVE grades for one student in a class
export const saveStudentGrades = (
  studentId,
  classCode,
  coursework1Score,
  coursework2Score,
  coursework3Score,
  finalExamScore
) =>
  api.put(`/grades/${studentId}`, {
    classCode,
    coursework1Score,
    coursework2Score,
    coursework3Score,
    finalExamScore
  });

// GET attendance for a specific date
export const getAttendanceByDate = (date, classCode) => api.get('/attendance', { params: { date, classCode } });

// SAVE attendance status for one student and date
export const saveAttendance = (studentId, date, status, classCode) =>
  api.put('/attendance', { studentId, date, status, classCode });

// CLEAR attendance status for one student and date
export const clearAttendance = (studentId, date, classCode) =>
  api.delete('/attendance', { data: { studentId, date, classCode } });

// GET final register summary for all students, optionally filtered by date range
export const getFinalRegister = (from, to, classCode) =>
  api.get('/attendance/final-register', { params: { from, to, classCode } });
