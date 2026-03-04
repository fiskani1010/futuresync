import axios from 'axios';

// Base API URLs for your backend
const GET_URL = 'http://localhost:3000/api/names';
const ADD_URL = 'http://localhost:3000/api/add-name';
const UPDATE_URL = 'http://localhost:3000/api/update-name';
const DELETE_URL = 'http://localhost:3000/api/delete-name';

// GET all students
export const getStudents = () => axios.get(GET_URL);

// POST a new student
export const addStudent = (name) => axios.post(ADD_URL, { name });

// PUT to update a student
export const updateStudent = (id, name) => axios.put(`${UPDATE_URL}/${id}`, { name });

// DELETE a student
export const deleteStudent = (id) => axios.delete(`${DELETE_URL}/${id}`);
