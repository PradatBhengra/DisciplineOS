/* ============================================================
   DISCIPLINE OS - app logic
   Data flow: bootstrap once from GET /api/data into `state`,
   render synchronously from state, push mutations to the API
   and patch state from server responses.
   ============================================================ */

(function () {
    'use strict';

    // ========== STATE ==========
    const state = {
        classes: [],      // courses
        marks: [],
        todos: [],
        habits: [],
        habitChecks: {},  // { "<habitId>_<weekKey>_<day>": true }
        attendance: []
    };

    // ========== USER / LOGOUT ==========
    const user = API.getUser();
    const unameEl = document.getElementById('sb-username');
    if (unameEl && user) unameEl.textContent = '👤 ' + user.name;
    document.getElementById('btn-logout').addEventListener('click', () => {
        API.clearSession();
        window.location.href = '/login.html';
    });

    // ========== NAVIGATION ==========
    const links = document.querySelectorAll('.sb-link');
    const pages = document.querySelectorAll('.page');

    function navTo(page) {
        links.forEach(l => l.classList.toggle('active', l.dataset.page === page));
        pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('active');
        refreshPage(page);
    }

    links.forEach(l => l.addEventListener('click', () => navTo(l.dataset.page)));
    document.querySelectorAll('[data-page-link]').forEach(el => {
        el.addEventListener('click', () => navTo(el.dataset.pageLink));
    });

    document.getElementById('topbar-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('overlay').classList.add('active');
    });
    document.getElementById('overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('active');
    });

    // Date
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const todayEl = document.getElementById('sb-date');
    if (todayEl) todayEl.textContent = todayStr;
    const cdDate = document.getElementById('card-today-date');
    if (cdDate) cdDate.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Greeting
    const greetEl = document.getElementById('hero-greeting');
    if (greetEl && user) {
        const h = new Date().getHours();
        const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
        greetEl.textContent = `${g}, ${user.name.split(' ')[0]}`;
    }

    // Toast
    function showToast(msg, isError) {
        const wrap = document.getElementById('toast-wrap');
        const t = document.createElement('div');
        t.className = 'toast'; t.textContent = msg;
        if (isError) t.style.borderColor = '#ef4444';
        wrap.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
    const oops = (err) => showToast(err.message || 'Something went wrong', true);

    // Modal
    const moBg = document.getElementById('modal-bg');
    const moTitle = document.getElementById('modal-title');
    const moBody = document.getElementById('modal-body');
    const moSave = document.getElementById('modal-save');
    let moHandler = null;

    function openModal(title, html, onSave) {
        moTitle.textContent = title; moBody.innerHTML = html;
        moBg.classList.add('active');
        if (moHandler) moSave.removeEventListener('click', moHandler);
        moHandler = onSave; moSave.addEventListener('click', moHandler);
    }
    function closeModal() {
        moSave.style.display = 'block';
        document.getElementById('modal-cancel').textContent = 'Cancel';
        moBg.classList.remove('active');
    }
    document.getElementById('modal-x').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    moBg.addEventListener('click', e => { if (e.target === moBg) closeModal(); });

    // Disable save button while a request is in flight
    async function withSaving(fn) {
        moSave.disabled = true; moSave.textContent = 'Saving…';
        try { await fn(); }
        catch (err) { oops(err); }
        finally { moSave.disabled = false; moSave.textContent = 'Save'; }
    }

    // Progress Bar generator (Ascii █░)
    function asciiBar(pct) {
        const total = 10;
        const filled = Math.round((pct / 100) * total);
        let str = '';
        for (let i = 0; i < total; i++) str += i < filled ? '<span class="filled">█</span>' : '░';
        return str;
    }

    // Refresh Router
    function refreshPage(p) {
        if (p === 'dashboard') renderDash();
        else if (p === 'classes') renderClasses();
        else if (p === 'marks') renderMarks();
        else if (p === 'todos') renderTodos();
        else if (p === 'habits') renderHabits();
        else if (p === 'attendance') renderAttendance();
    }

    // ========== DASHBOARD ==========
    function renderDash() {
        const habits = state.habits;
        const checks = state.habitChecks;
        const alist = document.getElementById('analytics-list');
        alist.innerHTML = habits.map(h => {
            const count = Object.keys(checks).filter(k => k.startsWith(h.id) && checks[k]).length;
            const pct = Math.min(Math.round((count / 7) * 100), 100);
            return `
                <div class="analytics-item">
                    <div class="ana-top"><span>${esc(h.name)}</span><span>${pct.toFixed(2)}%</span></div>
                    <div class="ana-bar">${asciiBar(pct)}</div>
                </div>
            `;
        }).join('') || '<div class="empty-small">No habits tracked yet</div>';

        // Today's Habits
        const dayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
        const weekKey = getWeekKey(0);
        const thDash = document.getElementById('today-habits-dash');
        thDash.innerHTML = habits.length ? habits.map(h => {
            const key = `${h.id}_${weekKey}_${dayKey}`;
            const chkd = checks[key] || false;
            return `
                <div class="check-item">
                    <button class="check-box ${chkd ? 'checked' : ''}" onclick="togHabit('${h.id}', '${dayKey}', '${weekKey}')">✓</button>
                    <span class="check-text">${esc(h.name)}</span>
                </div>
             `;
        }).join('') : '<div class="empty-small">No habits</div>';

        // Pending Tasks
        const ptDash = document.getElementById('pending-tasks-dash');
        const pending = state.todos.filter(t => !t.done);
        ptDash.innerHTML = pending.length ? pending.slice(0, 4).map(t => `
            <div class="check-item">
                <div class="check-box" style="visibility:hidden"></div>
                <span class="check-text">${esc(t.name)}</span>
                <span class="check-meta">${t.deadline || ''}</span>
            </div>
        `).join('') : '<div class="empty-small">All caught up!</div>';
    }

    // ========== CLASSES ==========
    function renderClasses() {
        const cls = state.classes;
        const tb = document.getElementById('classes-tbody');
        document.getElementById('classes-empty').style.display = cls.length ? 'none' : 'block';
        tb.parentElement.style.display = cls.length ? 'table' : 'none';

        tb.innerHTML = cls.map(c => `
            <tr>
                <td><strong>${esc(c.name)}</strong></td><td>${esc(c.instructor)}</td>
                <td>${c.credits || '-'}</td><td>${attPctFor(c.name)}</td>
                <td class="tbl-actions">
                    <button class="tbl-btn" onclick="editClass('${c.id}')">Edit</button>
                    <button class="tbl-btn del" onclick="delClass('${c.id}')">Del</button>
                </td>
            </tr>
        `).join('');
    }

    // Pull attendance % from the attendance tracker when subject names match
    function attPctFor(courseName) {
        const a = state.attendance.find(x => x.name.toLowerCase() === String(courseName).toLowerCase());
        if (!a || !a.totalClasses) return '-';
        return Math.round((a.attended / a.totalClasses) * 100) + '%';
    }

    function formClass(ex = null) {
        openModal(ex ? 'Edit Course' : 'Add Course', `
            <div class="form-grp"><label>Name</label><input type="text" id="fc-name" value="${esc(ex?.name || '')}"></div>
            <div class="form-grp"><label>Instructor</label><input type="text" id="fc-inst" value="${esc(ex?.instructor || '')}"></div>
            <div class="form-grp"><label>Credits</label><input type="number" id="fc-cred" value="${ex?.credits || ''}"></div>
        `, () => withSaving(async () => {
            const body = {
                name: document.getElementById('fc-name').value,
                instructor: document.getElementById('fc-inst').value,
                credits: Number(document.getElementById('fc-cred').value) || 0
            };
            if (ex) {
                const doc = await API.updateCourse(ex.id, body);
                state.classes[state.classes.findIndex(x => x.id === ex.id)] = doc;
            } else {
                state.classes.push(await API.createCourse(body));
            }
            closeModal(); renderClasses();
        }));
    }

    document.getElementById('btn-add-class').onclick = () => formClass();
    document.getElementById('btn-add-class-empty').onclick = () => formClass();
    window.editClass = id => formClass(state.classes.find(x => x.id === id));
    window.delClass = async id => {
        try {
            await API.deleteCourse(id);
            state.classes = state.classes.filter(x => x.id !== id);
            renderClasses();
        } catch (err) { oops(err); }
    };

    // ========== MARKS ==========
    function renderMarks() {
        const mks = state.marks;
        const tb = document.getElementById('marks-tbody');
        document.getElementById('marks-empty').style.display = mks.length ? 'none' : 'block';
        tb.parentElement.style.display = mks.length ? 'table' : 'none';

        tb.innerHTML = mks.map(m => `
            <tr>
                <td><strong>${esc(m.name)}</strong></td><td>${m.quiz1 ?? '-'}</td><td>${m.midSem ?? '-'}</td>
                <td>${m.quiz2 ?? '-'}</td><td>${m.assignment ?? '-'}</td><td>${m.endSem ?? '-'}</td>
                <td>${m.total || 0}</td><td class="grade-${['A', 'B', 'C'].includes(m.grade) ? 'c' : 'w'}"><strong>${m.grade || 'N/A'}</strong></td>
                <td class="tbl-actions">
                    <button class="tbl-btn" onclick="editMark('${m.id}')">Edit</button>
                    <button class="tbl-btn del" onclick="delMark('${m.id}')">Del</button>
                </td>
            </tr>
        `).join('');
    }

    function formMark(ex = null) {
        openModal(ex ? 'Edit Mark' : 'Add Mark', `
            <div class="form-grp"><label>Subject</label><input type="text" id="fm-name" value="${esc(ex?.name || '')}"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-grp"><label>Max Marks</label><input type="number" id="fm-max" value="${ex?.maxMarks || ''}"></div>
                <div class="form-grp"><label>Quiz 1</label><input type="number" step="0.5" id="fm-q1" value="${ex?.quiz1 ?? ''}"></div>
                <div class="form-grp"><label>Mid Sem</label><input type="number" step="0.5" id="fm-mid" value="${ex?.midSem ?? ''}"></div>
                <div class="form-grp"><label>Quiz 2</label><input type="number" step="0.5" id="fm-q2" value="${ex?.quiz2 ?? ''}"></div>
                <div class="form-grp"><label>Assign.</label><input type="number" step="0.5" id="fm-ass" value="${ex?.assignment ?? ''}"></div>
                <div class="form-grp"><label>End Sem</label><input type="number" step="0.5" id="fm-end" value="${ex?.endSem ?? ''}"></div>
            </div>
        `, () => withSaving(async () => {
            const num = id => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
            const body = {
                name: document.getElementById('fm-name').value,
                maxMarks: num('fm-max') || 0,
                quiz1: num('fm-q1'), midSem: num('fm-mid'), quiz2: num('fm-q2'),
                assignment: num('fm-ass'), endSem: num('fm-end')
            };
            // total + grade are computed server-side
            if (ex) {
                const doc = await API.updateMark(ex.id, body);
                state.marks[state.marks.findIndex(x => x.id === ex.id)] = doc;
            } else {
                state.marks.push(await API.createMark(body));
            }
            closeModal(); renderMarks();
        }));
    }

    document.getElementById('btn-add-mark').onclick = () => formMark();
    document.getElementById('btn-add-mark-empty').onclick = () => formMark();
    window.editMark = id => formMark(state.marks.find(x => x.id === id));
    window.delMark = async id => {
        try {
            await API.deleteMark(id);
            state.marks = state.marks.filter(x => x.id !== id);
            renderMarks();
        } catch (err) { oops(err); }
    };

    // ========== TODOS ==========
    let tdFilt = 'all';
    function renderTodos() {
        const all = state.todos;
        const list = document.getElementById('todo-list');
        const f = tdFilt === 'all' ? all : tdFilt === 'pending' ? all.filter(x => !x.done) : all.filter(x => x.done);

        if (!all.length) { document.getElementById('todos-empty').style.display = 'block'; list.innerHTML = ''; list.appendChild(document.getElementById('todos-empty')); return; }
        document.getElementById('todos-empty').style.display = 'none';

        list.innerHTML = f.map(t => `
            <div class="check-item ${t.done ? 'done' : ''}">
                <button class="check-box ${t.done ? 'checked' : ''}" onclick="togTd('${t.id}')">✓</button>
                <span class="check-text">${esc(t.name)}</span>
                <span class="check-meta">${t.deadline || ''} ${t.estimatedHours ? t.estimatedHours + 'h' : ''}</span>
                <button class="tbl-btn" onclick="editTd('${t.id}')">Edit</button>
                <button class="tbl-btn del" onclick="delTd('${t.id}')">Del</button>
            </div>
        `).join('') || '<p style="color:#666">No matching tasks.</p>';
    }

    window.togTd = async id => {
        const t = state.todos.find(x => x.id === id);
        if (!t) return;
        // optimistic toggle, revert on failure
        t.done = !t.done; renderTodos(); renderDash();
        try {
            const doc = await API.updateTodo(id, { done: t.done });
            state.todos[state.todos.findIndex(x => x.id === id)] = doc;
        } catch (err) {
            t.done = !t.done; renderTodos(); renderDash(); oops(err);
        }
    };

    function formTd(ex = null) {
        openModal(ex ? 'Edit Task' : 'Add Task', `
            <div class="form-grp"><label>Name</label><input type="text" id="ft-name" value="${esc(ex?.name || '')}"></div>
            <div class="form-grp"><label>Deadline</label><input type="date" id="ft-dead" value="${ex?.deadline || ''}"></div>
            <div class="form-grp"><label>Est. Hours</label><input type="number" id="ft-hrs" value="${ex?.estimatedHours ?? ''}"></div>
        `, () => withSaving(async () => {
            const hrs = document.getElementById('ft-hrs').value;
            const body = {
                name: document.getElementById('ft-name').value,
                deadline: document.getElementById('ft-dead').value,
                estimatedHours: hrs === '' ? null : Number(hrs)
            };
            if (ex) {
                const doc = await API.updateTodo(ex.id, body);
                state.todos[state.todos.findIndex(x => x.id === ex.id)] = doc;
            } else {
                state.todos.push(await API.createTodo(body));
            }
            closeModal(); renderTodos(); renderDash();
        }));
    }

    document.getElementById('btn-add-todo').onclick = () => formTd();
    document.getElementById('btn-add-todo-empty').onclick = () => formTd();
    window.editTd = id => formTd(state.todos.find(x => x.id === id));
    window.delTd = async id => {
        try {
            await API.deleteTodo(id);
            state.todos = state.todos.filter(x => x.id !== id);
            renderTodos(); renderDash();
        } catch (err) { oops(err); }
    };

    document.querySelectorAll('.pill').forEach(p => p.onclick = () => {
        document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active'); tdFilt = p.dataset.filter; renderTodos();
    });

    // ========== HABITS ==========
    let hwOff = 0;
    function getWeekKey(off) {
        const d = new Date(); d.setDate(d.getDate() - d.getDay() + (off * 7));
        return d.getFullYear() + 'W' + d.getMonth() + d.getDate();
    }

    function renderHabits() {
        const hb = state.habits;
        const ck = state.habitChecks;
        const cont = document.getElementById('habits-container');
        if (!hb.length) { cont.innerHTML = ''; cont.appendChild(document.getElementById('habits-empty')); document.getElementById('habits-empty').style.display = 'block'; return; }

        document.getElementById('habit-week-label').textContent = hwOff === 0 ? 'This Week' : hwOff < 0 ? Math.abs(hwOff) + ' wks ago' : hwOff + ' wks ahead';
        const dnames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const wk = getWeekKey(hwOff);

        const table = `
            <table class="habit-calendar">
                <thead><tr><th>Habit</th>${dnames.map(d => `<th>${d}</th>`).join('')}<th>Progress</th></tr></thead>
                <tbody>
                    ${hb.map(h => {
                        let count = 0;
                        const cells = dnames.map(d => {
                            const key = `${h.id}_${wk}_${d}`;
                            const done = ck[key] || false;
                            if (done) count++;
                            return `<td><button class="hc-check ${done ? 'checked' : ''}" onclick="togHabit('${h.id}', '${d}', '${wk}')">✓</button></td>`;
                        }).join('');
                        const pct = Math.round((count / 7) * 100);
                        return `
                            <tr>
                                <td>
                                    <div class="habit-name-wrap">
                                        <span class="habit-name">${esc(h.name)}</span>
                                        <div><button class="habit-actions" onclick="editHb('${h.id}')">Edit</button> · <button class="habit-actions" onclick="delHb('${h.id}')">Del</button></div>
                                    </div>
                                </td>
                                ${cells}
                                <td>
                                    <div class="prog-bar">${asciiBar(pct)} <span class="prog-pct">${pct}%</span></div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        cont.innerHTML = table;
    }

    // Single toggle used by both the dashboard and the weekly grid
    window.togHabit = async (id, d, w) => {
        const key = `${id}_${w}_${d}`;
        // optimistic
        state.habitChecks[key] = !state.habitChecks[key];
        renderHabits(); renderDash();
        try {
            const res = await API.toggleHabitCheck(id, w, d);
            state.habitChecks[res.key] = res.checked;
        } catch (err) {
            state.habitChecks[key] = !state.habitChecks[key];
            renderHabits(); renderDash(); oops(err);
        }
    };

    function formHb(ex = null) {
        openModal(ex ? 'Edit Habit' : 'Add Habit', `
            <div class="form-grp"><label>Habit Name</label><input type="text" id="fh-name" value="${esc(ex?.name || '')}"></div>
        `, () => withSaving(async () => {
            const body = { name: document.getElementById('fh-name').value };
            if (ex) {
                const doc = await API.updateHabit(ex.id, body);
                state.habits[state.habits.findIndex(x => x.id === ex.id)] = doc;
            } else {
                state.habits.push(await API.createHabit(body));
            }
            closeModal(); renderHabits(); renderDash();
        }));
    }

    document.getElementById('habit-prev-week').onclick = () => { hwOff--; renderHabits(); };
    document.getElementById('habit-next-week').onclick = () => { hwOff++; renderHabits(); };
    document.getElementById('btn-add-habit').onclick = () => formHb();
    if (document.getElementById('btn-add-habit-empty')) document.getElementById('btn-add-habit-empty').onclick = () => formHb();
    window.editHb = id => formHb(state.habits.find(x => x.id === id));
    window.delHb = async id => {
        try {
            await API.deleteHabit(id);
            state.habits = state.habits.filter(x => x.id !== id);
            Object.keys(state.habitChecks).forEach(k => { if (k.startsWith(id)) delete state.habitChecks[k]; });
            renderHabits(); renderDash();
        } catch (err) { oops(err); }
    };

    // ========== ATTENDANCE ==========
    function renderAttendance() {
        const att = state.attendance;
        const grid = document.getElementById('att-grid');
        const emp = document.getElementById('attendance-empty');
        if (!att.length) { grid.innerHTML = ''; grid.appendChild(emp); emp.style.display = 'block'; return; }
        emp.style.display = 'none';

        grid.innerHTML = att.map(a => {
            const pct = a.totalClasses > 0 ? Math.round((a.attended / a.totalClasses) * 100) : 0;
            return `
                <div class="att-card">
                    <div class="att-head">
                        <span class="att-title">${esc(a.name)}</span>
                        <span class="att-pct ${pct >= 75 ? 'good' : 'bad'}">${pct}%</span>
                    </div>
                    <div class="att-stats">
                        <div class="att-stat"><span>${a.attended}</span> Attended</div>
                        <div class="att-stat"><span>${a.totalClasses}</span> Total</div>
                    </div>
                    <div class="att-actions">
                        <button class="btn btn-ghost" onclick="markAtt('${a.id}','present')">Present</button>
                        <button class="btn btn-ghost" onclick="markAtt('${a.id}','absent')">Absent</button>
                        <button class="btn btn-ghost" onclick="editAtt('${a.id}')">✏️</button>
                        <button class="btn btn-ghost" onclick="delAtt('${a.id}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.markAtt = async (id, status) => {
        try {
            const doc = await API.markAttendance(id, status);
            state.attendance[state.attendance.findIndex(x => x.id === id)] = doc;
            renderAttendance();
            showToast(status === 'present' ? 'Marked present' : 'Marked absent');
        } catch (err) { oops(err); }
    };

    function formAtt(ex = null) {
        openModal(ex ? 'Edit Subject' : 'Add Subject', `
            <div class="form-grp"><label>Subject</label><input type="text" id="fa-name" value="${esc(ex?.name || '')}"></div>
            <div style="display:flex;gap:10px;">
                <div class="form-grp"><label>Total Classes</label><input type="number" id="fa-tot" value="${ex?.totalClasses || 0}"></div>
                <div class="form-grp"><label>Attended</label><input type="number" id="fa-att" value="${ex?.attended || 0}"></div>
            </div>
        `, () => withSaving(async () => {
            const body = {
                name: document.getElementById('fa-name').value,
                totalClasses: parseInt(document.getElementById('fa-tot').value) || 0,
                attended: parseInt(document.getElementById('fa-att').value) || 0
            };
            if (ex) {
                const doc = await API.updateAttendance(ex.id, body);
                state.attendance[state.attendance.findIndex(x => x.id === ex.id)] = doc;
            } else {
                state.attendance.push(await API.createAttendance(body));
            }
            closeModal(); renderAttendance();
        }));
    }

    document.getElementById('btn-add-attendance').onclick = () => formAtt();
    if (document.getElementById('btn-add-attendance-empty')) document.getElementById('btn-add-attendance-empty').onclick = () => formAtt();
    window.editAtt = id => formAtt(state.attendance.find(x => x.id === id));
    window.delAtt = async id => {
        try {
            await API.deleteAttendance(id);
            state.attendance = state.attendance.filter(x => x.id !== id);
            renderAttendance();
        } catch (err) { oops(err); }
    };

    // Utils
    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    // ========== EXPORT (CSV) ==========
    function toCSVRow(arr) {
        return arr.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',');
    }

    function downloadCSV(filename, csvData) {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const btnExport = document.getElementById('btn-export-notion');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            openModal('Export to Notion', `
                <p style="margin-bottom: 15px; color: #888;">Notion requires each data type (Classes, Todos, etc.) to be imported as a separate database. Download your CSV files below and import them into Notion via <strong>Import > CSV</strong>.</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="btn btn-ghost" id="dl-classes" style="text-align: left;">🎓 Download Classes CSV</button>
                    <button class="btn btn-ghost" id="dl-marks" style="text-align: left;">📝 Download Marks CSV</button>
                    <button class="btn btn-ghost" id="dl-todos" style="text-align: left;">✅ Download To-Dos CSV</button>
                    <button class="btn btn-ghost" id="dl-habits" style="text-align: left;">🔥 Download Habits CSV</button>
                    <button class="btn btn-ghost" id="dl-attendance" style="text-align: left;">📅 Download Attendance CSV</button>
                </div>
            `, () => closeModal());

            document.getElementById('modal-save').style.display = 'none';
            document.getElementById('modal-cancel').textContent = 'Close';

            document.getElementById('dl-classes').onclick = () => {
                let csv = 'Name,Instructor,Credits\n';
                state.classes.forEach(d => { csv += toCSVRow([d.name, d.instructor, d.credits]) + '\n'; });
                downloadCSV('Dos_Classes.csv', csv);
            };
            document.getElementById('dl-marks').onclick = () => {
                let csv = 'Subject,Max Marks,Quiz 1,Mid Sem,Quiz 2,Assignment,End Sem,Total,Grade\n';
                state.marks.forEach(d => { csv += toCSVRow([d.name, d.maxMarks, d.quiz1, d.midSem, d.quiz2, d.assignment, d.endSem, d.total, d.grade]) + '\n'; });
                downloadCSV('Dos_Marks.csv', csv);
            };
            document.getElementById('dl-todos').onclick = () => {
                let csv = 'Task Name,Deadline,Estimated Hours,Status\n';
                state.todos.forEach(d => { csv += toCSVRow([d.name, d.deadline, d.estimatedHours, d.done ? 'Done' : 'Pending']) + '\n'; });
                downloadCSV('Dos_ToDos.csv', csv);
            };
            document.getElementById('dl-habits').onclick = () => {
                let csv = 'Habit Name\n';
                state.habits.forEach(d => { csv += toCSVRow([d.name]) + '\n'; });
                downloadCSV('Dos_Habits.csv', csv);
            };
            document.getElementById('dl-attendance').onclick = () => {
                let csv = 'Subject,Total Classes,Attended,Attendance %\n';
                state.attendance.forEach(d => {
                    const pct = d.totalClasses > 0 ? ((d.attended / d.totalClasses) * 100).toFixed(2) : 0;
                    csv += toCSVRow([d.name, d.totalClasses, d.attended, pct + '%']) + '\n';
                });
                downloadCSV('Dos_Attendance.csv', csv);
            };
        });
    }

    // ========== INIT ==========
    async function init() {
        try {
            const data = await API.bootstrap();
            state.classes = data.courses || [];
            state.marks = data.marks || [];
            state.todos = data.todos || [];
            state.habits = data.habits || [];
            state.habitChecks = data.habitChecks || {};
            state.attendance = data.attendance || [];
            renderDash();
        } catch (err) {
            oops(err);
        } finally {
            const ls = document.getElementById('loading-screen');
            if (ls) ls.remove();
        }
    }

    init();

})();
