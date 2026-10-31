/* ============================================================
   DISCIPLINE OS - api client
   Thin fetch wrapper: attaches JWT, parses errors,
   redirects to /login.html when the session expires.
   ============================================================ */
const API = (() => {
    const BASE = '/api';
    const TOKEN_KEY = 'dos_token';
    const USER_KEY = 'dos_user';

    const getToken = () => localStorage.getItem(TOKEN_KEY);
    const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };

    const setSession = (token, user) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    };
    const clearSession = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    };

    async function request(path, { method = 'GET', body } = {}) {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(BASE + path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });

        if (res.status === 401 && !path.startsWith('/auth/')) {
            clearSession();
            window.location.href = '/login.html';
            throw new Error('Session expired');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
        return data;
    }

    return {
        getToken, getUser, setSession, clearSession,

        // Auth
        register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
        login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),

        // Bootstrap
        bootstrap: () => request('/data'),

        // Courses
        createCourse: (b) => request('/courses', { method: 'POST', body: b }),
        updateCourse: (id, b) => request(`/courses/${id}`, { method: 'PUT', body: b }),
        deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),

        // Marks
        createMark: (b) => request('/marks', { method: 'POST', body: b }),
        updateMark: (id, b) => request(`/marks/${id}`, { method: 'PUT', body: b }),
        deleteMark: (id) => request(`/marks/${id}`, { method: 'DELETE' }),

        // Todos
        createTodo: (b) => request('/todos', { method: 'POST', body: b }),
        updateTodo: (id, b) => request(`/todos/${id}`, { method: 'PUT', body: b }),
        deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),

        // Habits
        createHabit: (b) => request('/habits', { method: 'POST', body: b }),
        updateHabit: (id, b) => request(`/habits/${id}`, { method: 'PUT', body: b }),
        deleteHabit: (id) => request(`/habits/${id}`, { method: 'DELETE' }),
        setHabitCheck: (id, weekKey, day, checked) => request(`/habits/${id}/checks`, { method: 'PUT', body: { weekKey, day, checked } }),

        // Attendance
        createAttendance: (b) => request('/attendance', { method: 'POST', body: b }),
        updateAttendance: (id, b) => request(`/attendance/${id}`, { method: 'PUT', body: b }),
        deleteAttendance: (id) => request(`/attendance/${id}`, { method: 'DELETE' }),
        markAttendance: (id, status) => request(`/attendance/${id}/mark`, { method: 'PATCH', body: { status } })
    };
})();
