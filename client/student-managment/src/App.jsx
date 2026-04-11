import { Link, Route, Routes, useNavigate, useParams, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function useFetch(url, deps = [], token = null) {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	useEffect(() => {
		console.log("useFetch called", url, token);
		let cancelled = false;
		setLoading(true);
		const headers = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		fetch(url, { headers })
			.then((r) => {
				console.log("Fetch response", r.status, r.url);
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then((json) => {
				console.log("Fetch data", json);
				if (!cancelled) {
					setData(json);
					setError(null);
				}
			})
			.catch((e) => {
				console.error("Fetch error", e);
				!cancelled && setError(e)
			})
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, token]);
	return { data, loading, error, setData };
}

function ProtectedRoute({ children }) {
	const { user } = useAuth();
	return user ? children : <Navigate to="/login" />;
}

function Layout({ children }) {
	const { logout } = useAuth();
	const [open, setOpen] = useState(true);

	return (
		<div className="app">

			{/* SIDEBAR */}
			<div className={`sidebar ${open ? "open" : "closed"}`}>
				<h2>{open ? "School" : "S"}</h2>

				<Link to="/dashboard">Dashboard</Link>
				<Link to="/">Students</Link>
				<Link to="/courses">Courses</Link>

				<button onClick={logout}>Logout</button>
			</div>

			{/* MAIN AREA */}
			<div className="main">

				{/* TOP BAR */}
				<div className="topbar">
					<button onClick={() => setOpen(!open)}>☰</button>
				</div>

				<div className="content">
					{children}
				</div>
			</div>
		</div>
	);
}

function StudentsPage() {
	const { token } = useAuth();
	const [q, setQ] = useState("");
	const url = useMemo(() => {
		const p = new URLSearchParams();
		if (q.trim()) p.set("q", q.trim());
		return `${API_BASE}/api/students${p.toString() ? `?${p.toString()}` : ""}`;
	}, [q]);
	const { data: students, loading, error, setData: setStudents } = useFetch(url, [url], token);
	const navigate = useNavigate();

	console.log("StudentsPage", { students, loading, error, token });

	function onSubmit(e) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const name = form.get("name");
		const email = form.get("email");
		if (!name || !email) return;
		fetch(`${API_BASE}/api/students`, {
			method: "POST",
			headers: { 
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {})
			},
			body: JSON.stringify({ name, email })
		})
			.then((r) => r.json())
			.then((created) => {
				setStudents((prev) => (Array.isArray(prev) ? [created, ...prev] : [created]));
				e.currentTarget.reset();
			});
	}

	function removeStudent(id) {
		if (!confirm("Remove this student?")) return;
		fetch(`${API_BASE}/api/students/${id}`, { 
			method: "DELETE",
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		}).then(() => {
			setStudents((prev) => prev.filter((s) => s.id !== id));
		});
	}

	if (loading) return <Layout>Loading...</Layout>;
	if (error) return <Layout>Error loading students: {error.message}</Layout>;

	return (
		<Layout>
			<h2>Students</h2>

			<form onSubmit={onSubmit} className="form">
				<input className="input" name="name" placeholder="Name" />
				<input className="input" name="email" placeholder="Email" />
				<button className="button" type="submit">Add Student</button>
			</form>

			<div className="search">
				<input
					className="input"
					placeholder="Search..."
					value={q}
					onChange={(e) => setQ(e.target.value)}
				/>
			</div>

			<ul className="list">
				{students?.map((s) => (
					<li className="list-item">
						<span className="flex-grow">
							<strong>{s.name}</strong> — {s.email}
						</span>
						<button onClick={() => navigate(`/students/${s.id}`)}>View</button>
						<button onClick={() => navigate(`/students/${s.id}/edit`)}>Edit</button>
						<button onClick={() => removeStudent(s.id)}>Remove</button>
					</li>
				))}
			</ul>
		</Layout>
	);
}

function EditStudentPage() {
	const { id } = useParams();
	const { token } = useAuth();
	const { data: student, loading } = useFetch(`${API_BASE}/api/students/${id}`, [id], token);
	const navigate = useNavigate();

	if (loading) return <Layout>Loading...</Layout>;
	if (!student) return <Layout>Not found</Layout>;

	function onSubmit(e) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const name = form.get("name");
		const email = form.get("email");

		fetch(`${API_BASE}/api/students/${id}`, {
			method: "PUT",
			headers: { 
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {})
			},
			body: JSON.stringify({ name, email })
		}).then(() => navigate(-1));
	}

	return (
		<Layout>
			<h2>Edit Student</h2>

			<form onSubmit={onSubmit} className="form">
				<input className="input" name="name" defaultValue={student.name} />
				<input className="input" name="email" defaultValue={student.email} />
				<button className="button" type="submit">Save</button>
			</form>
		</Layout>
	);
}

function StudentDetailPage() {
	const { id } = useParams();
	const { token } = useAuth();
	const { data: student, loading: loadingStudent } = useFetch(`${API_BASE}/api/students/${id}`, [id], token);
	const { data: courses, loading: loadingCourses } = useFetch(`${API_BASE}/api/courses`, [], token);
	const {
		data: enrollments,
		loading: loadingEnrollments,
		setData: setEnrollments
	} = useFetch(`${API_BASE}/api/students/${id}/enrollments`, [id], token);

	if (loadingStudent || loadingCourses || loadingEnrollments) return <Layout>Loading...</Layout>;
	if (!student) return <Layout>Not found</Layout>;

	const enrolledCourseIds = new Set(enrollments?.map((e) => e.courseId));
	const availableCourses = courses?.filter((c) => !enrolledCourseIds.has(c.id));

	function enroll(courseId) {
		fetch(`${API_BASE}/api/students/${id}/enrollments`, {
			method: "POST",
			headers: { 
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {})
			},
			body: JSON.stringify({ courseId })
		})
			.then((r) => r.json())
			.then((created) => {
				setEnrollments((prev) => [
					...(Array.isArray(prev) ? prev : []),
					{ ...created, course: courses.find((c) => c.id === created.courseId) }
				]);
			});
	}

	function unenroll(enrollmentId) {
		fetch(`${API_BASE}/api/students/${id}/enrollments/${enrollmentId}`, { 
			method: "DELETE",
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		}).then(() => {
			setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
		});
	}

	function setGrade(enrollmentId, grade) {
		fetch(`${API_BASE}/api/enrollments/${enrollmentId}/grade`, {
			method: "PUT",
			headers: { 
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {})
			},
			body: JSON.stringify({ grade })
		})
			.then((r) => r.json())
			.then((updated) => {
				setEnrollments((prev) => prev.map((e) => (e.id === updated.id ? { ...e, grade: updated.grade } : e)));
			});
	}

	return (
		<Layout>
			<h2>{student.name}</h2>
			<p>{student.email}</p>
			<h3>Enroll in a course</h3>
			<div className="course-list">
				{availableCourses?.map((c) => (
					<button key={c.id} onClick={() => enroll(c.id)}>
						{c.code} — {c.name}
					</button>
				))}

				{availableCourses?.length === 0 && <span>All courses enrolled</span>}
			</div>
			<h3 className="section-title">Current Enrollments</h3>
			<ul className="list">
				{enrollments?.map((e) => (
					<li key={e.id} className="list-item">
						<span className="flex-grow">
							{e.course?.code} — {e.course?.name}{" "}
							{e.grade ? `(Grade: ${e.grade})` : "(No grade)"}
						</span>

						<select
							defaultValue={e.grade ?? ""}
							onChange={(ev) => setGrade(e.id, ev.target.value || null)}
						>
							<option value="">No grade</option>
							<option value="A">A</option>
							<option value="B">B</option>
							<option value="C">C</option>
							<option value="D">D</option>
							<option value="F">F</option>
						</select>

						<button onClick={() => unenroll(e.id)}>Unenroll</button>
					</li>
				))}
			</ul>
		</Layout>
	);
}

function CoursesPage() {
  const { token } = useAuth();
  const { data: courses, loading, error, setData: setCourses } =
    useFetch(`${API_BASE}/api/courses`, [], token);

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const code = form.get("code");
    const name = form.get("name");

    if (!code || !name) return;

    fetch(`${API_BASE}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ code, name })
    })
      .then((r) => r.json())
      .then((created) => {
        setCourses((prev) =>
          Array.isArray(prev) ? [created, ...prev] : [created]
        );
        e.currentTarget.reset();
      });
  }

  if (loading) return <Layout>Loading...</Layout>;
  if (error) return <Layout>Error loading courses</Layout>;

  return (
    <Layout>
      <h2>Courses</h2>

      {/* ✅ Add Course Form */}
      <form onSubmit={onSubmit} className="form">
        <input className="input" name="code" placeholder="Course Code" />
        <input className="input" name="name" placeholder="Course Name" />
        <button className="button" type="submit">Add Course</button>
      </form>

      <ul className="list">
        {courses?.map((c) => (
          <li key={c.id} className="list-item">
            <span className="flex-grow">
              {c.code} — {c.name}
            </span>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
function DashboardPage() {
	const { token } = useAuth();

	const { data: students, loading: loadingStudents } =
		useFetch(`${API_BASE}/api/students`, [], token);

	const { data: courses, loading: loadingCourses } =
		useFetch(`${API_BASE}/api/courses`, [], token);

	// ✅ NEW: enrollments added
	const { data: enrollments, loading: loadingEnrollments } =
		useFetch(`${API_BASE}/api/enrollments`, [], token);

	// ✅ loading fix
	if (loadingStudents || loadingCourses || loadingEnrollments)
		return <Layout>Loading...</Layout>;

	// stats
	const totalStudents = students?.length || 0;
	const totalCourses = courses?.length || 0;
	const totalEnrollments = enrollments?.length || 0;

	return (
		<Layout>
			<h2>Dashboard</h2>

			{/* STATS */}
			<div className="dashboard-stats">
				<div className="stat-card">
					<h3>Total Students</h3>
					<p>{totalStudents}</p>
				</div>

				<div className="stat-card">
					<h3>Total Courses</h3>
					<p>{totalCourses}</p>
				</div>

				{/* NEW CARD */}
				<div className="stat-card">
					<h3>Total Enrollments</h3>
					<p>{totalEnrollments}</p>
				</div>
			</div>

			{/* RECENT STUDENTS */}
			<div className="dashboard-recent">
				<h3>Recent Students</h3>

				<ul className="list">
					{students?.slice(0, 5).map((s) => (
						<li key={s.id} className="list-item">
							<span className="flex-grow">
								<strong>{s.name}</strong> — {s.email}
							</span>
						</li>
					))}
				</ul>
			</div>
		</Layout>
	);
}
export default function App() { const { user } = useAuth();
 return ( <Routes> <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
   <Route path="/" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
    <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
	 <Route path="/students/:id" element={<ProtectedRoute><StudentDetailPage /></ProtectedRoute>} 
	 /> <Route path="/students/:id/edit" element={<ProtectedRoute><EditStudentPage /></ProtectedRoute>} />
	  </Routes> ); }