import { useState, useEffect, useMemo } from 'react';
import {
  getStudents,
  getGrades,
  getClasses,
  createClass,
  addStudent,
  updateStudent,
  deleteStudent,
  saveStudentGrades,
  getAttendanceByDate,
  saveAttendance,
  clearAttendance,
  getFinalRegister,
  loginTeacher,
  registerTeacher,
  forgotTeacherPassword,
  getCurrentTeacher,
  adminCreateLecturer,
  adminGenerateResetKey,
  getAdminTeachers,
  updateAdminTeacherRole,
  getStoredAuthToken,
  setStoredAuthToken,
  clearStoredAuthToken,
  registerStudentSelf
} from './services/studentService';
import mubasLogo from './assets/MUBAS.png';
import './App.css';

const ATTENDANCE_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' }
];

const getTodayString = () => new Date().toISOString().slice(0, 10);
const getNextDateString = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};
const getMonthStartString = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};

const formatPrintDate = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toScoreNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatScore = (value) => {
  const parsed = toScoreNumber(value);
  if (parsed === null) {
    return '-';
  }
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
};

const computeGradeMetrics = (coursework1Score, coursework2Score, coursework3Score, finalExamScore) => {
  const cw1 = toScoreNumber(coursework1Score);
  const cw2 = toScoreNumber(coursework2Score);
  const cw3 = toScoreNumber(coursework3Score);
  const finalExam = toScoreNumber(finalExamScore);

  const hasAllScores = [cw1, cw2, cw3, finalExam].every((score) => score !== null);
  if (!hasAllScores) {
    return { overall: null, letter: '-' };
  }

  const overall = Number(((cw1 + cw2 + cw3 + finalExam) / 4).toFixed(2));
  if (overall >= 80) return { overall, letter: 'A' };
  if (overall >= 70) return { overall, letter: 'B' };
  if (overall >= 60) return { overall, letter: 'C' };
  if (overall >= 50) return { overall, letter: 'D' };
  return { overall, letter: 'F' };
};

function App() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [desksPerRow, setDesksPerRow] = useState(4);
  const [selectedDate, setSelectedDate] = useState(getTodayString);
  const [attendanceByStudent, setAttendanceByStudent] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSavingId, setAttendanceSavingId] = useState(null);
  const [attendanceError, setAttendanceError] = useState('');
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [gradeSavingId, setGradeSavingId] = useState(null);
  const [gradeError, setGradeError] = useState('');
  const [autoAdvanceDay, setAutoAdvanceDay] = useState(true);
  const [registerFromDate, setRegisterFromDate] = useState(getMonthStartString);
  const [registerToDate, setRegisterToDate] = useState(getTodayString);
  const [printingRegister, setPrintingRegister] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredAuthToken()));
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authView, setAuthView] = useState('login');
  const [showGetStarted, setShowGetStarted] = useState(true);
  const [activePage, setActivePage] = useState('register');
  const [teacherRegisterName, setTeacherRegisterName] = useState('');
  const [teacherRegisterEmail, setTeacherRegisterEmail] = useState('');
  const [teacherRegisterPassword, setTeacherRegisterPassword] = useState('');
  const [teacherRegisterInviteCode, setTeacherRegisterInviteCode] = useState('');
  const [teacherRegisterLoading, setTeacherRegisterLoading] = useState(false);
  const [teacherRegisterError, setTeacherRegisterError] = useState('');
  const [teacherRegisterSuccess, setTeacherRegisterSuccess] = useState('');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotResetKey, setForgotResetKey] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [studentRegisterName, setStudentRegisterName] = useState('');
  const [studentRegisterNumber, setStudentRegisterNumber] = useState('');
  const [studentRegisterClassCode, setStudentRegisterClassCode] = useState('');
  const [studentRegisterLoading, setStudentRegisterLoading] = useState(false);
  const [studentRegisterError, setStudentRegisterError] = useState('');
  const [studentRegisterSuccess, setStudentRegisterSuccess] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassCode, setSelectedClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [classCodeInput, setClassCodeInput] = useState('');
  const [classActionLoading, setClassActionLoading] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [adminLecturerUsername, setAdminLecturerUsername] = useState('');
  const [adminLecturerFullName, setAdminLecturerFullName] = useState('');
  const [adminLecturerPassword, setAdminLecturerPassword] = useState('');
  const [adminTargetUsername, setAdminTargetUsername] = useState('');
  const [adminResetHours, setAdminResetHours] = useState('24');
  const [adminResetKeyOutput, setAdminResetKeyOutput] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminActionError, setAdminActionError] = useState('');
  const [adminActionSuccess, setAdminActionSuccess] = useState('');
  const [adminTeachers, setAdminTeachers] = useState([]);
  const [adminTeachersLoading, setAdminTeachersLoading] = useState(false);
  const [adminTeachersError, setAdminTeachersError] = useState('');
  const [adminRoleSavingId, setAdminRoleSavingId] = useState(null);

  const bootstrapAuthenticatedSession = async () => {
    try {
      const meRes = await getCurrentTeacher();
      const teacher = meRes?.data?.teacher || null;
      setCurrentTeacher(teacher);
      if (teacher?.role === 'admin') {
        await fetchAdminTeachers();
      } else {
        setAdminTeachers([]);
      }
      await fetchClasses();
    } catch {
      clearStoredAuthToken();
      setIsAuthenticated(false);
      setLoginError('Session expired. Please log in again.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void bootstrapAuthenticatedSession();
    }
    // bootstrapAuthenticatedSession intentionally not in deps to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (activePage !== 'register' || students.length === 0 || !selectedClassCode) {
      setAttendanceByStudent({});
      return;
    }
    void fetchAttendance(selectedDate);
    // fetchAttendance intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, selectedDate, students.length, selectedClassCode]);

  useEffect(() => {
    if (isAuthenticated && selectedClassCode) {
      if (activePage === 'grades') {
        void fetchGrades();
      } else {
        void fetchStudents();
      }
    }
    // fetchStudents/fetchGrades intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedClassCode, activePage]);

  useEffect(() => {
    setSearch('');
  }, [activePage]);

  useEffect(() => {
    const nextDrafts = {};
    students.forEach((student) => {
      nextDrafts[student.id] = {
        coursework1: student.coursework_1_score === null || student.coursework_1_score === undefined
          ? ''
          : String(student.coursework_1_score),
        coursework2: student.coursework_2_score === null || student.coursework_2_score === undefined
          ? ''
          : String(student.coursework_2_score),
        coursework3: student.coursework_3_score === null || student.coursework_3_score === undefined
          ? ''
          : String(student.coursework_3_score),
        finalExam: student.final_exam_score === null || student.final_exam_score === undefined
          ? ''
          : String(student.final_exam_score)
      };
    });
    setGradeDrafts(nextDrafts);
  }, [students]);

  const fetchStudents = async () => {
    if (!selectedClassCode) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setGradeError('');
    try {
      const res = await getStudents(selectedClassCode);
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error("Error fetching students:", err);
      setError('Could not load students. Check if backend is running on port 3000.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async () => {
    if (!selectedClassCode) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setGradeError('');
    try {
      const res = await getGrades(selectedClassCode);
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error fetching grades:', err);
      setGradeError(err?.response?.data?.error || 'Could not load grades for this class.');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    setClassActionLoading(true);
    setError('');
    try {
      const res = await getClasses();
      const rows = Array.isArray(res.data) ? res.data : [];
      setClasses(rows);
      if (!selectedClassCode && rows.length > 0) {
        setSelectedClassCode(rows[0].class_code);
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error fetching classes:', err);
      setError('Could not load classes.');
    } finally {
      setClassActionLoading(false);
    }
  };

  const fetchAdminTeachers = async () => {
    setAdminTeachersLoading(true);
    setAdminTeachersError('');
    try {
      const res = await getAdminTeachers();
      setAdminTeachers(Array.isArray(res?.data?.teachers) ? res.data.teachers : []);
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      setAdminTeachersError(err?.response?.data?.error || 'Could not load teachers.');
    } finally {
      setAdminTeachersLoading(false);
    }
  };

  const fetchAttendance = async (date) => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const res = await getAttendanceByDate(date, selectedClassCode);
      const map = {};
      const rows = Array.isArray(res.data) ? res.data : [];
      rows.forEach((row) => {
        if (row.status) {
          map[row.id] = row.status;
        }
      });
      setAttendanceByStudent(map);
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error fetching attendance:', err);
      setAttendanceError('Could not load attendance for this date.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleAddOrUpdate = async () => {
    const cleanedName = name.trim();
    const cleanedRegistrationNumber = registrationNumber.trim();
    if (!cleanedName) return;
    if (!selectedClassCode) {
      setError('Select a class first.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editId !== null) {
        await updateStudent(editId, cleanedName, cleanedRegistrationNumber, selectedClassCode);
        setEditId(null);
      } else {
        await addStudent(cleanedName, cleanedRegistrationNumber, selectedClassCode);
      }
      setName('');
      setRegistrationNumber('');
      await fetchStudents();
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error("Error adding/updating student:", err);
      setError(err?.response?.data?.error || 'Could not save student. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (student) => {
    setEditId(student.id);
    setName(student.name);
    setRegistrationNumber(student.registration_number || '');
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteStudent(id, selectedClassCode);
      setStudents((prev) => prev.filter((student) => student.id !== id));
      setAttendanceByStudent((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setGradeDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (editId === id) {
        setEditId(null);
        setName('');
        setRegistrationNumber('');
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error("Error deleting student:", err);
      setError('Could not delete student. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setName('');
    setRegistrationNumber('');
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      void handleAddOrUpdate();
    }
  };

  const handleSetAttendance = async (studentId, status) => {
    if (!selectedClassCode) {
      setAttendanceError('Select a class first.');
      return;
    }
    setAttendanceSavingId(studentId);
    setAttendanceError('');
    try {
      await saveAttendance(studentId, selectedDate, status, selectedClassCode);
      setAttendanceByStudent((prev) => {
        const next = { ...prev, [studentId]: status };
        const allMarked =
          autoAdvanceDay &&
          sortedStudents.length > 0 &&
          sortedStudents.every((student) => Boolean(next[student.id]));

        if (allMarked) {
          setTimeout(() => {
            setSelectedDate((currentDate) => getNextDateString(currentDate));
          }, 150);
        }

        return next;
      });
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error saving attendance:', err);
      setAttendanceError('Could not save attendance. Please try again.');
    } finally {
      setAttendanceSavingId(null);
    }
  };

  const handleClearAttendance = async (studentId) => {
    if (!selectedClassCode) {
      setAttendanceError('Select a class first.');
      return;
    }
    setAttendanceSavingId(studentId);
    setAttendanceError('');
    try {
      await clearAttendance(studentId, selectedDate, selectedClassCode);
      setAttendanceByStudent((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error clearing attendance:', err);
      setAttendanceError('Could not clear attendance. Please try again.');
    } finally {
      setAttendanceSavingId(null);
    }
  };

  const handleGradeDraftChange = (studentId, field, value) => {
    setGradeError('');
    setGradeDrafts((prev) => ({
      ...prev,
      [studentId]: {
        coursework1: prev[studentId]?.coursework1 ?? '',
        coursework2: prev[studentId]?.coursework2 ?? '',
        coursework3: prev[studentId]?.coursework3 ?? '',
        finalExam: prev[studentId]?.finalExam ?? '',
        [field]: value
      }
    }));
  };

  const handleSaveGrades = async (studentId) => {
    if (!selectedClassCode) {
      setGradeError('Select a class first.');
      return;
    }

    const draft = gradeDrafts[studentId] || {
      coursework1: '',
      coursework2: '',
      coursework3: '',
      finalExam: ''
    };
    const parseBoundedScore = (rawValue, min, max, label) => {
      if (String(rawValue ?? '').trim() === '') {
        return { ok: true, value: null };
      }
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: `${label} must be a number` };
      }
      if (parsed < min || parsed > max) {
        return { ok: false, error: `${label} must be between ${min} and ${max}` };
      }
      return { ok: true, value: Number(parsed.toFixed(2)) };
    };

    const courseworkOneResult = parseBoundedScore(draft.coursework1, 0, 100, 'Coursework 1');
    if (!courseworkOneResult.ok) {
      setGradeError(courseworkOneResult.error);
      return;
    }
    const courseworkTwoResult = parseBoundedScore(draft.coursework2, 0, 100, 'Coursework 2');
    if (!courseworkTwoResult.ok) {
      setGradeError(courseworkTwoResult.error);
      return;
    }
    const courseworkThreeResult = parseBoundedScore(draft.coursework3, 0, 100, 'Coursework 3');
    if (!courseworkThreeResult.ok) {
      setGradeError(courseworkThreeResult.error);
      return;
    }
    const finalExamResult = parseBoundedScore(draft.finalExam, 0, 100, 'Final Exam');
    if (!finalExamResult.ok) {
      setGradeError(finalExamResult.error);
      return;
    }

    setGradeSavingId(studentId);
    setGradeError('');
    try {
      const res = await saveStudentGrades(
        studentId,
        selectedClassCode,
        courseworkOneResult.value,
        courseworkTwoResult.value,
        courseworkThreeResult.value,
        finalExamResult.value
      );
      const updatedStudent = res?.data?.student;
      if (!updatedStudent) {
        setGradeError('Could not read updated grades from server response.');
        return;
      }

      setStudents((prev) =>
        prev.map((student) =>
          String(student.id) === String(studentId)
            ? {
                ...student,
                coursework_1_score: updatedStudent.coursework_1_score,
                coursework_2_score: updatedStudent.coursework_2_score,
                coursework_3_score: updatedStudent.coursework_3_score,
                final_exam_score: updatedStudent.final_exam_score
              }
            : student
        )
      );

      setGradeDrafts((prev) => ({
        ...prev,
        [studentId]: {
          coursework1:
            updatedStudent.coursework_1_score === null || updatedStudent.coursework_1_score === undefined
              ? ''
              : String(updatedStudent.coursework_1_score),
          coursework2:
            updatedStudent.coursework_2_score === null || updatedStudent.coursework_2_score === undefined
              ? ''
              : String(updatedStudent.coursework_2_score),
          coursework3:
            updatedStudent.coursework_3_score === null || updatedStudent.coursework_3_score === undefined
              ? ''
              : String(updatedStudent.coursework_3_score),
          finalExam:
            updatedStudent.final_exam_score === null || updatedStudent.final_exam_score === undefined
              ? ''
              : String(updatedStudent.final_exam_score)
        }
      }));

      await fetchGrades();
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error saving grades:', err);
      setGradeError(err?.response?.data?.error || 'Could not save grades. Please try again.');
    } finally {
      setGradeSavingId(null);
    }
  };

  const printAttendanceForDay = () => {
    if (!selectedClassCode) {
      setAttendanceError('Select a class first.');
      return;
    }
    const rowsHtml = sortedStudents
      .map((student, index) => {
        const status = attendanceByStudent[student.id] || 'unmarked';
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(student.name)}</td>
            <td>${escapeHtml(student.registration_number || '-')}</td>
            <td>${student.id}</td>
            <td>${escapeHtml(statusLabel)}</td>
          </tr>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setAttendanceError('Pop-up blocked. Please allow pop-ups to print attendance.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Attendance ${escapeHtml(selectedDate)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
            th { background: #eff6ff; }
          </style>
        </head>
        <body>
          <h1>Daily Attendance Report</h1>
          <p>Class Code: ${escapeHtml(selectedClassCode || '-')}</p>
          <p>Date: ${escapeHtml(formatPrintDate(selectedDate))}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Reg Number</th>
                <th>ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const printFinalRegister = async () => {
    if (!selectedClassCode) {
      setAttendanceError('Select a class first.');
      return;
    }
    setPrintingRegister(true);
    setAttendanceError('');

    try {
      const res = await getFinalRegister(registerFromDate || undefined, registerToDate || undefined, selectedClassCode);
      const { rows = [], total_days: totalDays = 0 } = res.data || {};
      const rangeLabel = `${registerFromDate || 'Beginning'} to ${registerToDate || 'Today'}`;
      const rowsHtml = rows
        .map((row, index) => {
          const markedDays = Number(row.marked_days || 0);
          const courseworkOneScore = formatScore(row.coursework_1_score);
          const courseworkTwoScore = formatScore(row.coursework_2_score);
          const courseworkThreeScore = formatScore(row.coursework_3_score);
          const finalExamScore = formatScore(row.final_exam_score);
          const overallScore = formatScore(row.overall_score);
          const letterGrade = row.letter_grade || '-';
          const attendanceRate =
            totalDays > 0 ? `${Math.round(((Number(row.present_days || 0) + Number(row.late_days || 0)) / totalDays) * 100)}%` : 'N/A';
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${escapeHtml(row.registration_number || '-')}</td>
              <td>${row.id}</td>
              <td>${escapeHtml(courseworkOneScore)}</td>
              <td>${escapeHtml(courseworkTwoScore)}</td>
              <td>${escapeHtml(courseworkThreeScore)}</td>
              <td>${escapeHtml(finalExamScore)}</td>
              <td>${escapeHtml(overallScore)}</td>
              <td>${escapeHtml(letterGrade)}</td>
              <td>${row.present_days}</td>
              <td>${row.late_days}</td>
              <td>${row.absent_days}</td>
              <td>${markedDays}</td>
              <td>${attendanceRate}</td>
            </tr>
          `;
        })
        .join('');

      const printWindow = window.open('', '_blank', 'width=1000,height=760');
      if (!printWindow) {
        setAttendanceError('Pop-up blocked. Please allow pop-ups to print the final register.');
        return;
      }

      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Final Class Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
              h1 { margin: 0 0 8px; font-size: 24px; }
              p { margin: 0 0 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 13px; }
              th, td { border: 1px solid #d1d5db; padding: 7px 9px; text-align: left; }
              th { background: #eff6ff; }
            </style>
          </head>
          <body>
            <h1>Final Class Report</h1>
            <p>This report combines attendance register and gradebook scores.</p>
            <p>Class Code: ${escapeHtml(selectedClassCode || '-')}</p>
            <p>Range: ${escapeHtml(rangeLabel)}</p>
            <p>Total Attendance Days Recorded In Range: ${totalDays}</p>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Reg Number</th>
                  <th>ID</th>
                  <th>CW 1 /100</th>
                  <th>CW 2 /100</th>
                  <th>CW 3 /100</th>
                  <th>Final /100</th>
                  <th>Overall /100</th>
                  <th>Grade</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Marked Days</th>
                  <th>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error printing final register:', err);
      setAttendanceError('Could not build final register. Please try again.');
    } finally {
      setPrintingRegister(false);
    }
  };

  const handleTeacherLogin = async (event) => {
    event.preventDefault();
    const identifier = loginUsername.trim();
    if (!identifier || !loginPassword) {
      setLoginError('Email/username and password are required.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await loginTeacher(identifier, loginPassword);
      if (!res?.data?.token) {
        setLoginError('Login response missing token.');
        return;
      }

      setStoredAuthToken(res.data.token);
      setCurrentTeacher(res.data.teacher || null);
      setIsAuthenticated(true);
      setLoginPassword('');
    } catch (err) {
      console.error('Error during login:', err);
      setLoginError(err?.response?.data?.error || 'Could not log in.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleTeacherLogout = () => {
    clearStoredAuthToken();
    setIsAuthenticated(false);
    setActivePage('register');
    setStudents([]);
    setAttendanceByStudent({});
    setGradeDrafts({});
    setGradeError('');
    setGradeSavingId(null);
    setEditId(null);
    setName('');
    setRegistrationNumber('');
    setSelectedClassCode('');
    setClasses([]);
    setCurrentTeacher(null);
    setAdminTeachers([]);
    setAdminTeachersError('');
    setAdminRoleSavingId(null);
    setAdminTeachersLoading(false);
  };

  const handleTeacherRegister = async (event) => {
    event.preventDefault();
    const fullName = teacherRegisterName.trim();
    const email = teacherRegisterEmail.trim().toLowerCase();
    const password = teacherRegisterPassword;
    const inviteCode = teacherRegisterInviteCode.trim();

    if (!fullName || !email || !password) {
      setTeacherRegisterError('Name, email, and password are required.');
      return;
    }
    const simpleEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailPattern.test(email)) {
      setTeacherRegisterError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setTeacherRegisterError('Password must be at least 8 characters.');
      return;
    }

    setTeacherRegisterLoading(true);
    setTeacherRegisterError('');
    setTeacherRegisterSuccess('');
    try {
      await registerTeacher(fullName, email, password, inviteCode);
      setTeacherRegisterSuccess('Teacher account created. You can now log in.');
      setTeacherRegisterName('');
      setTeacherRegisterEmail('');
      setTeacherRegisterPassword('');
      setTeacherRegisterInviteCode('');
      setAuthView('login');
    } catch (err) {
      console.error('Error registering teacher:', err);
      setTeacherRegisterError(err?.response?.data?.error || 'Could not register teacher.');
    } finally {
      setTeacherRegisterLoading(false);
    }
  };

  const handleCreateClass = async (event) => {
    event.preventDefault();
    const normalizedName = className.trim();
    const normalizedCode = classCodeInput.trim().toUpperCase();

    if (!normalizedName || !normalizedCode) {
      setError('Class name and class code are required.');
      return;
    }

    setClassActionLoading(true);
    setError('');
    try {
      await createClass(normalizedName, normalizedCode);
      setClassName('');
      setClassCodeInput('');
      await fetchClasses();
      setSelectedClassCode(normalizedCode);
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      console.error('Error creating class:', err);
      setError(err?.response?.data?.error || 'Could not create class.');
    } finally {
      setClassActionLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    const identifier = forgotUsername.trim();
    if (!identifier || !forgotNewPassword || !forgotResetKey) {
      setForgotError('Email/username, new password, and reset key are required.');
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError('New password must be at least 8 characters.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      await forgotTeacherPassword(identifier, forgotNewPassword, forgotResetKey);
      setForgotSuccess('Password reset successful. You can now sign in.');
      setForgotUsername('');
      setForgotNewPassword('');
      setForgotResetKey('');
      setAuthView('login');
    } catch (err) {
      console.error('Error resetting password:', err);
      setForgotError(err?.response?.data?.error || 'Could not reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleAdminCreateLecturer = async (event) => {
    event.preventDefault();
    const username = adminLecturerUsername.trim();
    const password = adminLecturerPassword;
    const fullName = adminLecturerFullName.trim();

    if (!username || !password) {
      setAdminActionError('Lecturer username and password are required.');
      return;
    }
    if (password.length < 8) {
      setAdminActionError('Lecturer password must be at least 8 characters.');
      return;
    }

    setAdminActionLoading(true);
    setAdminActionError('');
    setAdminActionSuccess('');
    try {
      await adminCreateLecturer(username, password, fullName);
      await fetchAdminTeachers();
      setAdminActionSuccess(`Lecturer "${username}" created successfully.`);
      setAdminLecturerUsername('');
      setAdminLecturerFullName('');
      setAdminLecturerPassword('');
    } catch (err) {
      setAdminActionError(err?.response?.data?.error || 'Could not create lecturer.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminGenerateResetKey = async (event) => {
    event.preventDefault();
    const username = adminTargetUsername.trim();
    const hours = Number(adminResetHours || '24');
    if (!username) {
      setAdminActionError('Target lecturer username is required.');
      return;
    }

    setAdminActionLoading(true);
    setAdminActionError('');
    setAdminActionSuccess('');
    setAdminResetKeyOutput('');
    try {
      const res = await adminGenerateResetKey(username, hours);
      const key = res?.data?.resetKey || '';
      setAdminResetKeyOutput(key);
      setAdminActionSuccess(`Reset key generated for "${username}". Share it securely.`);
    } catch (err) {
      setAdminActionError(err?.response?.data?.error || 'Could not generate reset key.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminRoleUpdate = async (teacherId, role) => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!['admin', 'lecturer'].includes(normalizedRole)) {
      return;
    }

    setAdminRoleSavingId(teacherId);
    setAdminActionError('');
    setAdminActionSuccess('');
    try {
      const res = await updateAdminTeacherRole(teacherId, normalizedRole);
      const updatedTeacher = res?.data?.teacher;

      if (updatedTeacher) {
        setAdminTeachers((prev) =>
          prev.map((teacher) =>
            String(teacher.id) === String(updatedTeacher.id) ? updatedTeacher : teacher
          )
        );
        if (currentTeacher?.username && updatedTeacher.username === currentTeacher.username) {
          setCurrentTeacher((prev) =>
            prev
              ? {
                  ...prev,
                  role: updatedTeacher.role
                }
              : prev
          );
        }
      } else {
        await fetchAdminTeachers();
      }

      setAdminActionSuccess(res?.data?.message || 'Role updated.');
    } catch (err) {
      if (err?.response?.status === 401) {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setLoginError('Session expired. Please log in again.');
        return;
      }
      setAdminActionError(err?.response?.data?.error || 'Could not update teacher role.');
    } finally {
      setAdminRoleSavingId(null);
    }
  };

  const handleStudentSelfRegister = async (event) => {
    event.preventDefault();
    const nameValue = studentRegisterName.trim();
    const regValue = studentRegisterNumber.trim();

    if (!nameValue || !regValue) {
      setStudentRegisterError('Name and registration number are required.');
      return;
    }

    setStudentRegisterLoading(true);
    setStudentRegisterError('');
    setStudentRegisterSuccess('');
    try {
      const classCodeValue = studentRegisterClassCode.trim().toUpperCase();
      if (!classCodeValue) {
        setStudentRegisterError('Class code is required.');
        return;
      }

      await registerStudentSelf(nameValue, regValue, classCodeValue);
      setStudentRegisterSuccess('Registration submitted. Teacher will see your name in class list.');
      setStudentRegisterName('');
      setStudentRegisterNumber('');
      setStudentRegisterClassCode('');
    } catch (err) {
      console.error('Error registering student:', err);
      setStudentRegisterError(err?.response?.data?.error || 'Could not submit registration.');
    } finally {
      setStudentRegisterLoading(false);
    }
  };

  const sortedStudents = useMemo(() => {
    const sorted = [...students];
    sorted.sort((a, b) => {
      if (sortBy === 'id-asc') return Number(a.id) - Number(b.id);
      if (sortBy === 'id-desc') return Number(b.id) - Number(a.id);
      if (sortBy === 'name-desc') return String(b.name).localeCompare(String(a.name));
      return String(a.name).localeCompare(String(b.name));
    });
    return sorted;
  }, [students, sortBy]);

  const canSubmit = name.trim().length > 0 && !saving && Boolean(selectedClassCode);
  const normalizedSearch = search.trim().toLowerCase();

  const visibleStudents = useMemo(() => {
    return sortedStudents.filter((student) => {
      if (!normalizedSearch) return true;
      const byName = String(student.name ?? '').toLowerCase().includes(normalizedSearch);
      const byId = String(student.id ?? '').includes(normalizedSearch);
      const byReg = String(student.registration_number ?? '').toLowerCase().includes(normalizedSearch);
      return byName || byId || byReg;
    });
  }, [sortedStudents, normalizedSearch]);

  const attendanceSummary = useMemo(() => {
    return sortedStudents.reduce(
      (summary, student) => {
        const status = attendanceByStudent[student.id] || 'unmarked';
        summary[status] += 1;
        return summary;
      },
      { present: 0, late: 0, absent: 0, unmarked: 0 }
    );
  }, [sortedStudents, attendanceByStudent]);

  if (!isAuthenticated) {
    if (showGetStarted) {
      return (
        <main className="app-shell">
          <section className="panel get-started-panel">
            <header className="get-started-header">
              <img src={mubasLogo} alt="MUBAS logo" className="get-started-logo" />
              <p className="eyebrow">FutureSync</p>
              <h1>FutureSync - syncing attendance and grades</h1>
              <p className="get-started-copy">
                This platform helps lecturers and class administrators manage class lists, track attendance, and keep
                grade records organized from one secure portal.
              </p>
            </header>

            <section className="get-started-grid" aria-label="System overview">
              <article className="feature-card">
                <h3>Secure Lecturer Access</h3>
                <p>Lecturer and admin accounts protect class data and attendance history.</p>
              </article>
              <article className="feature-card">
                <h3>Class Setup</h3>
                <p>Create classes with unique codes and organize students per class.</p>
              </article>
              <article className="feature-card">
                <h3>Student Registration</h3>
                <p>Students can self-submit name and registration number using class codes.</p>
              </article>
              <article className="feature-card">
                <h3>Attendance Reporting</h3>
                <p>Record daily status and print both day attendance and final register summaries.</p>
              </article>
            </section>

            <div className="get-started-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowGetStarted(false)}>
                Continue To Portal
              </button>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="app-shell">
        <section className="panel login-panel">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${authView === 'login' ? 'active' : ''}`}
              onClick={() => setAuthView('login')}
              type="button"
            >
              Teacher Login
            </button>
            <button
              className={`auth-tab ${authView === 'teacher-register' ? 'active' : ''}`}
              onClick={() => setAuthView('teacher-register')}
              type="button"
            >
              Teacher Register
            </button>
            <button
              className={`auth-tab ${authView === 'student-register' ? 'active' : ''}`}
              onClick={() => setAuthView('student-register')}
              type="button"
            >
              Student Register
            </button>
          </div>

          <header className="panel-header auth-header">
            <div className="brand-mark">
              <img src={mubasLogo} alt="MUBAS logo" className="brand-logo" />
            </div>
            <p className="eyebrow">{authView === 'student-register' ? 'Student Access' : 'Teacher Access'}</p>
            <h1>
              {authView === 'login'
                ? 'Login Required'
                : authView === 'teacher-register'
                  ? 'Teacher Registration'
                  : authView === 'forgot-password'
                    ? 'Reset Teacher Password'
                  : 'Student Self Registration'}
            </h1>
            <p>
              {authView === 'login'
                ? 'Only authorized teachers can access student and attendance data.'
                : authView === 'teacher-register'
                  ? 'Create a teacher account for secure access.'
                  : authView === 'forgot-password'
                    ? 'Use your teacher reset key to set a new password.'
                  : 'Students can submit their own name and registration number here.'}
            </p>
          </header>

          {authView === 'login' ? (
            <>
              <form className="login-form" onSubmit={handleTeacherLogin}>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Teacher email or username"
                  autoComplete="username"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <button className="btn btn-primary" type="submit" disabled={loginLoading}>
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </button>
                <button className="text-link-btn" type="button" onClick={() => setAuthView('forgot-password')}>
                  Forgot password?
                </button>
              </form>
              {loginError && <p className="status status-error">{loginError}</p>}
            </>
          ) : authView === 'teacher-register' ? (
            <>
              <form className="login-form" onSubmit={handleTeacherRegister}>
                <input
                  type="text"
                  value={teacherRegisterName}
                  onChange={(e) => setTeacherRegisterName(e.target.value)}
                  placeholder="Teacher full name"
                />
                <input
                  type="email"
                  value={teacherRegisterEmail}
                  onChange={(e) => setTeacherRegisterEmail(e.target.value)}
                  placeholder="Teacher email"
                />
                <input
                  type="password"
                  value={teacherRegisterPassword}
                  onChange={(e) => setTeacherRegisterPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                />
                <input
                  type="text"
                  value={teacherRegisterInviteCode}
                  onChange={(e) => setTeacherRegisterInviteCode(e.target.value)}
                  placeholder="Invite code (if required)"
                />
                <button className="btn btn-primary" type="submit" disabled={teacherRegisterLoading}>
                  {teacherRegisterLoading ? 'Creating...' : 'Create Teacher Account'}
                </button>
              </form>
              {teacherRegisterError && <p className="status status-error">{teacherRegisterError}</p>}
              {teacherRegisterSuccess && <p className="status status-success">{teacherRegisterSuccess}</p>}
            </>
          ) : authView === 'forgot-password' ? (
            <>
              <form className="login-form" onSubmit={handleForgotPassword}>
                <input
                  type="text"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  placeholder="Teacher email or username"
                />
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                />
                <input
                  type="password"
                  value={forgotResetKey}
                  onChange={(e) => setForgotResetKey(e.target.value)}
                  placeholder="Reset key"
                />
                <button className="btn btn-primary" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
                <button className="text-link-btn" type="button" onClick={() => setAuthView('login')}>
                  Back to sign in
                </button>
              </form>
              {forgotError && <p className="status status-error">{forgotError}</p>}
              {forgotSuccess && <p className="status status-success">{forgotSuccess}</p>}
            </>
          ) : (
            <>
              <form className="login-form" onSubmit={handleStudentSelfRegister}>
                <input
                  type="text"
                  value={studentRegisterName}
                  onChange={(e) => setStudentRegisterName(e.target.value)}
                  placeholder="Student full name"
                />
                <input
                  type="text"
                  value={studentRegisterNumber}
                  onChange={(e) => setStudentRegisterNumber(e.target.value)}
                  placeholder="Registration number"
                />
                <input
                  type="text"
                  value={studentRegisterClassCode}
                  onChange={(e) => setStudentRegisterClassCode(e.target.value.toUpperCase())}
                  placeholder="Class code"
                />
                <button className="btn btn-primary" type="submit" disabled={studentRegisterLoading}>
                  {studentRegisterLoading ? 'Submitting...' : 'Submit Registration'}
                </button>
              </form>
              {studentRegisterError && <p className="status status-error">{studentRegisterError}</p>}
              {studentRegisterSuccess && <p className="status status-success">{studentRegisterSuccess}</p>}
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <header className="panel-header">
          <div className="brand-mark">
            <img src={mubasLogo} alt="MUBAS logo" className="brand-logo" />
          </div>
          <div className="header-row">
            <p className="eyebrow">Student Manager</p>
            <button className="btn btn-muted logout-btn" onClick={handleTeacherLogout}>
              Logout
            </button>
          </div>
          <h1>{activePage === 'grades' ? 'Class Gradebook' : 'Class Register'}</h1>
          <p>
            {activePage === 'grades'
              ? 'Enter CW1, CW2, CW3, and final exam scores. Student names are synced from the same class register.'
              : 'Track students and attendance with fast class workflows. The same class roster appears in Grades.'}
          </p>
        </header>

        <nav className="view-switch" aria-label="Page switcher">
          <button
            className={`view-tab ${activePage === 'register' ? 'active' : ''}`}
            type="button"
            onClick={() => setActivePage('register')}
          >
            Register
          </button>
          <button
            className={`view-tab ${activePage === 'grades' ? 'active' : ''}`}
            type="button"
            onClick={() => setActivePage('grades')}
          >
            Grades
          </button>
        </nav>

        <section className="controls-stack">
          {currentTeacher?.role === 'admin' && (
            <details className="fold">
              <summary>Admin Lecturer Management</summary>
              <section className="admin-panel" aria-label="Admin lecturer management">
                <div className="admin-grid">
                  <form className="admin-form" onSubmit={handleAdminCreateLecturer}>
                    <h3>Create Lecturer</h3>
                    <input
                      type="text"
                      value={adminLecturerFullName}
                      onChange={(e) => setAdminLecturerFullName(e.target.value)}
                      placeholder="Lecturer full name"
                    />
                    <input
                      type="text"
                      value={adminLecturerUsername}
                      onChange={(e) => setAdminLecturerUsername(e.target.value)}
                      placeholder="Lecturer username"
                    />
                    <input
                      type="password"
                      value={adminLecturerPassword}
                      onChange={(e) => setAdminLecturerPassword(e.target.value)}
                      placeholder="Lecturer password"
                    />
                    <button className="btn btn-primary" type="submit" disabled={adminActionLoading}>
                      {adminActionLoading ? 'Saving...' : 'Create Lecturer'}
                    </button>
                  </form>

                  <form className="admin-form" onSubmit={handleAdminGenerateResetKey}>
                    <h3>Generate Lecturer Reset Key</h3>
                    <input
                      type="text"
                      value={adminTargetUsername}
                      onChange={(e) => setAdminTargetUsername(e.target.value)}
                      placeholder="Lecturer username"
                    />
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={adminResetHours}
                      onChange={(e) => setAdminResetHours(e.target.value)}
                      placeholder="Expiry hours"
                    />
                    <button className="btn btn-primary" type="submit" disabled={adminActionLoading}>
                      {adminActionLoading ? 'Generating...' : 'Generate Reset Key'}
                    </button>
                    {adminResetKeyOutput && (
                      <textarea className="reset-key-box" readOnly value={adminResetKeyOutput} />
                    )}
                  </form>

                  <div className="admin-form admin-form-wide">
                    <div className="admin-form-head">
                      <h3>Teacher Roles</h3>
                      <button
                        type="button"
                        className="btn btn-muted"
                        onClick={() => void fetchAdminTeachers()}
                        disabled={adminTeachersLoading || adminRoleSavingId !== null}
                      >
                        {adminTeachersLoading ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>

                    {adminTeachersLoading ? (
                      <p className="admin-inline-status">Loading teachers...</p>
                    ) : adminTeachers.length === 0 ? (
                      <p className="admin-inline-status">No teacher accounts found yet.</p>
                    ) : (
                      <ul className="teacher-role-list">
                        {adminTeachers.map((teacher) => (
                          <li key={`teacher-role-${teacher.id}`} className="teacher-role-item">
                            <div className="teacher-role-meta">
                              <p className="teacher-role-name">{teacher.full_name || teacher.username}</p>
                              <p className="teacher-role-sub">{teacher.email || teacher.username}</p>
                            </div>
                            <div className="teacher-role-controls">
                              <label className="teacher-role-label">
                                Role
                                <select
                                  value={teacher.role || 'lecturer'}
                                  onChange={(event) => void handleAdminRoleUpdate(teacher.id, event.target.value)}
                                  disabled={adminRoleSavingId !== null || adminTeachersLoading}
                                >
                                  <option value="lecturer">Lecturer</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </label>
                              {adminRoleSavingId === teacher.id && (
                                <span className="teacher-role-saving">Saving...</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {adminTeachersError && <p className="status status-error">{adminTeachersError}</p>}
                {adminActionError && <p className="status status-error">{adminActionError}</p>}
                {adminActionSuccess && <p className="status status-success">{adminActionSuccess}</p>}
              </section>
            </details>
          )}

          <details className="fold" open={!selectedClassCode}>
            <summary>Class Setup</summary>
            <section className="class-toolbar" aria-label="Class selection and creation">
              <select
                value={selectedClassCode}
                onChange={(e) => setSelectedClassCode(e.target.value)}
                aria-label="Select class"
              >
                <option value="">Select class</option>
                {classes.map((classItem) => (
                  <option key={classItem.class_code} value={classItem.class_code}>
                    {classItem.class_name} ({classItem.class_code})
                  </option>
                ))}
              </select>
              <form className="class-create-form" onSubmit={handleCreateClass}>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="New class name"
                  aria-label="New class name"
                />
                <input
                  type="text"
                  value={classCodeInput}
                  onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
                  placeholder="Class code"
                  aria-label="Class code"
                />
                <button className="btn btn-primary" type="submit" disabled={classActionLoading}>
                  {classActionLoading ? 'Saving...' : 'Create Class'}
                </button>
              </form>
            </section>
          </details>

          {selectedClassCode && activePage === 'register' && (
            <>
              <details className="fold">
                <summary>Student Management</summary>
                <section className="composer" aria-label="Add or update student">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Enter student name"
                    aria-label="Student name"
                  />
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Registration number"
                    aria-label="Registration number"
                  />
                  <button className="btn btn-primary" onClick={handleAddOrUpdate} disabled={!canSubmit}>
                    {saving ? 'Saving...' : editId !== null ? 'Update Student' : 'Add Student'}
                  </button>
                  {editId !== null && (
                    <button className="btn btn-muted" onClick={handleCancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  )}
                </section>
              </details>

              <details className="fold">
                <summary>Search And Layout</summary>
                <section className="toolbar" aria-label="Search and sort students">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, reg number, or ID"
                    aria-label="Search students"
                  />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort students">
                    <option value="name-asc">Sort: Name A-Z</option>
                    <option value="name-desc">Sort: Name Z-A</option>
                    <option value="id-asc">Sort: ID Low-High</option>
                    <option value="id-desc">Sort: ID High-Low</option>
                  </select>
                  <select
                    value={desksPerRow}
                    onChange={(e) => setDesksPerRow(Number(e.target.value))}
                    aria-label="Desks per row"
                  >
                    <option value={2}>2 desks/row</option>
                    <option value={3}>3 desks/row</option>
                    <option value={4}>4 desks/row</option>
                    <option value={5}>5 desks/row</option>
                    <option value={6}>6 desks/row</option>
                  </select>
                  <p className="result-count">
                    {visibleStudents.length} / {students.length} students
                  </p>
                </section>
              </details>

              <details className="fold">
                <summary>Attendance Actions</summary>
                <section className="attendance-toolbar" aria-label="Attendance controls">
                  <label htmlFor="attendance-date">Attendance Date</label>
                  <input
                    id="attendance-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoAdvanceDay}
                      onChange={(e) => setAutoAdvanceDay(e.target.checked)}
                    />
                    Auto-advance to next day
                  </label>
                  <button className="btn btn-primary" onClick={printAttendanceForDay}>
                    Print Day Attendance
                  </button>
                  <p className="attendance-summary">
                    Present: {attendanceSummary.present} | Late: {attendanceSummary.late} | Absent:{' '}
                    {attendanceSummary.absent} | Unmarked: {attendanceSummary.unmarked}
                  </p>
                </section>
              </details>

              <details className="fold">
                <summary>Final Combined Report</summary>
                <section className="final-register-toolbar" aria-label="Final register controls">
                  <label htmlFor="register-from">Report Date Range</label>
                  <input
                    id="register-from"
                    type="date"
                    value={registerFromDate}
                    onChange={(e) => setRegisterFromDate(e.target.value)}
                  />
                  <input
                    id="register-to"
                    type="date"
                    value={registerToDate}
                    onChange={(e) => setRegisterToDate(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={printFinalRegister} disabled={printingRegister}>
                    {printingRegister ? 'Preparing Report...' : 'Print Final Report'}
                  </button>
                </section>
              </details>
            </>
          )}

          {selectedClassCode && activePage === 'grades' && (
            <>
              <details className="fold" open>
                <summary>Gradebook Filters</summary>
                <section className="toolbar" aria-label="Filter and sort grades">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, reg number, or ID"
                    aria-label="Search grades"
                  />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort grades">
                    <option value="name-asc">Sort: Name A-Z</option>
                    <option value="name-desc">Sort: Name Z-A</option>
                    <option value="id-asc">Sort: ID Low-High</option>
                    <option value="id-desc">Sort: ID High-Low</option>
                  </select>
                  <p className="result-count">
                    {visibleStudents.length} / {students.length} students
                  </p>
                </section>
              </details>

              <details className="fold">
                <summary>Final Combined Report</summary>
                <section className="final-register-toolbar" aria-label="Combined report controls">
                  <label htmlFor="grades-register-from">Report Date Range</label>
                  <input
                    id="grades-register-from"
                    type="date"
                    value={registerFromDate}
                    onChange={(e) => setRegisterFromDate(e.target.value)}
                  />
                  <input
                    id="grades-register-to"
                    type="date"
                    value={registerToDate}
                    onChange={(e) => setRegisterToDate(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={printFinalRegister} disabled={printingRegister}>
                    {printingRegister ? 'Preparing Report...' : 'Print Final Report'}
                  </button>
                </section>
              </details>
            </>
          )}
        </section>

        {error && <p className="status status-error">{error}</p>}
        {loading && <p className="status">Loading {activePage === 'grades' ? 'grades' : 'students'}...</p>}
        {activePage === 'register' && attendanceLoading && !loading && <p className="status">Loading attendance...</p>}
        {activePage === 'register' && attendanceError && <p className="status status-error">{attendanceError}</p>}
        {gradeError && <p className="status status-error">{gradeError}</p>}

        {!selectedClassCode ? (
          <p className="status">
            {activePage === 'grades'
              ? 'Select a class to start entering coursework and exam grades.'
              : 'Create or select a class to start managing attendance and grades.'}
          </p>
        ) : !loading && students.length === 0 ? (
          <p className="status">No students yet. Add your first student from the Register page.</p>
        ) : !loading && visibleStudents.length === 0 ? (
          <p className="status">No students match your search.</p>
        ) : activePage === 'grades' ? (
          <section className="gradebook-panel" aria-label="Class gradebook">
            <ul className="gradebook-grid">
              {visibleStudents.map((student) => {
                const draft = gradeDrafts[student.id] || {
                  coursework1: '',
                  coursework2: '',
                  coursework3: '',
                  finalExam: ''
                };
                const { overall, letter } = computeGradeMetrics(
                  student.coursework_1_score,
                  student.coursework_2_score,
                  student.coursework_3_score,
                  student.final_exam_score
                );

                return (
                  <li key={`grade-${student.id}`} className="grade-card">
                    <div className="grade-card-head">
                      <p className="student-name">{student.name}</p>
                      <p className="student-reg">Reg: {student.registration_number || 'Not set'}</p>
                    </div>

                    <div className="grade-editor">
                      <label className="grade-field">
                        CW 1 /100
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.coursework1}
                          onChange={(e) => handleGradeDraftChange(student.id, 'coursework1', e.target.value)}
                          disabled={gradeSavingId === student.id}
                        />
                      </label>
                      <label className="grade-field">
                        CW 2 /100
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.coursework2}
                          onChange={(e) => handleGradeDraftChange(student.id, 'coursework2', e.target.value)}
                          disabled={gradeSavingId === student.id}
                        />
                      </label>
                      <label className="grade-field">
                        CW 3 /100
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.coursework3}
                          onChange={(e) => handleGradeDraftChange(student.id, 'coursework3', e.target.value)}
                          disabled={gradeSavingId === student.id}
                        />
                      </label>
                      <label className="grade-field">
                        Final /100
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.finalExam}
                          onChange={(e) => handleGradeDraftChange(student.id, 'finalExam', e.target.value)}
                          disabled={gradeSavingId === student.id}
                        />
                      </label>
                      <button
                        className="btn btn-primary grade-save-btn"
                        onClick={() => handleSaveGrades(student.id)}
                        disabled={gradeSavingId === student.id}
                      >
                        {gradeSavingId === student.id ? 'Saving...' : 'Save Grades'}
                      </button>
                    </div>

                    <p className="grade-summary">
                      CW1: {formatScore(student.coursework_1_score)} | CW2: {formatScore(student.coursework_2_score)} |
                      {' '}CW3: {formatScore(student.coursework_3_score)} | Final: {formatScore(student.final_exam_score)} |
                      {' '}Overall: {overall === null ? '-' : formatScore(overall)} | Grade: {letter}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="classroom" aria-label="Classroom desk layout">
            <div className="front-board">Front Of Class</div>
            <ul
              className="desk-grid"
              style={{ gridTemplateColumns: `repeat(${desksPerRow}, minmax(0, 1fr))` }}
            >
            {visibleStudents.map((student, index) => (
              <li
                key={student.id}
                className={`desk-card ${editId === student.id ? 'editing' : ''}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="student-card-head">
                  <p className="seat-tag">
                    Row {Math.floor(index / desksPerRow) + 1}, Seat {(index % desksPerRow) + 1}
                  </p>
                  <p className="student-name">{student.name}</p>
                  <p className="student-reg">Reg: {student.registration_number || 'Not set'}</p>
                  <p className="student-id">ID #{student.id}</p>
                </div>

                <div className="attendance-actions">
                  {ATTENDANCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`chip ${
                        attendanceByStudent[student.id] === option.value ? 'chip-active' : ''
                      }`}
                      onClick={() => handleSetAttendance(student.id, option.value)}
                      disabled={attendanceSavingId === student.id}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    className="chip chip-clear"
                    onClick={() => handleClearAttendance(student.id)}
                    disabled={attendanceSavingId === student.id || !attendanceByStudent[student.id]}
                  >
                    Clear
                  </button>
                </div>

                <p className={`attendance-state state-${attendanceByStudent[student.id] || 'unmarked'}`}>
                  Status: {(attendanceByStudent[student.id] || 'unmarked').replace(/^./, (c) => c.toUpperCase())}
                </p>

                <div className="actions">
                  <button className="btn btn-muted" onClick={() => handleEdit(student)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(student.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
