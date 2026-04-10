import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory data stores
const users = [
	// Plaintext for demo only
	{ id: "u1", username: "admin", password: "password", name: "Administrator" }
];
const sessions = new Map(); // token -> userId

const courses = [
	{ id: "c1", code: "CS101", name: "Intro to CS" },
	{ id: "c2", code: "MATH201", name: "Calculus I" },
	{ id: "c3", code: "ENG110", name: "English Composition" }
];

const students = [
	{ id: uuidv4(), name: "Alice Johnson", email: "alice@example.com" },
	{ id: uuidv4(), name: "Bob Smith", email: "bob@example.com" }
];

// enrollment: { id, studentId, courseId, grade?: string }
const enrollments = [];

// Helpers
function findStudent(studentId) {
	return students.find((s) => s.id === studentId);
}

function findCourse(courseId) {
	return courses.find((c) => c.id === courseId);
}

function authRequired(req, res, next) {
	const header = req.headers.authorization || "";
	if (!header.startsWith("Bearer ")) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const token = header.slice("Bearer ".length);
	const userId = sessions.get(token);
	if (!userId) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	req.userId = userId;
	next();
}

// Routes
app.get("/", (_req, res) => {
	res.json({ status: "ok", service: "student-management-server" });
});

// Auth
app.post("/api/login", (req, res) => {
	const { username, password } = req.body || {};
	const user = users.find((u) => u.username === username && u.password === password);
	if (!user) {
		return res.status(401).json({ error: "Invalid credentials" });
	}
	const token = uuidv4();
	sessions.set(token, user.id);
	res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
});

// Courses
app.get("/api/courses", (_req, res) => {
	res.json(courses);
});

// Students CRUD
app.get("/api/students", authRequired, (req, res) => {
	const q = (req.query.q || "").toString().toLowerCase();
	const result = q
		? students.filter(
				(s) =>
					s.name.toLowerCase().includes(q) ||
					s.email.toLowerCase().includes(q)
		  )
		: students;
	res.json(result);
});

app.get("/api/students/:id", authRequired, (req, res) => {
	const student = findStudent(req.params.id);
	if (!student) return res.status(404).json({ error: "Student not found" });
	res.json(student);
});

app.post("/api/students", authRequired, (req, res) => {
	const { name, email } = req.body || {};
	if (!name || !email) {
		return res.status(400).json({ error: "name and email are required" });
	}
	const student = { id: uuidv4(), name, email };
	students.push(student);
	res.status(201).json(student);
});

app.put("/api/students/:id", authRequired, (req, res) => {
	const { name, email } = req.body || {};
	const student = findStudent(req.params.id);
	if (!student) return res.status(404).json({ error: "Student not found" });
	if (name) student.name = name;
	if (email) student.email = email;
	res.json(student);
});

app.delete("/api/students/:id", authRequired, (req, res) => {
	const idx = students.findIndex((s) => s.id === req.params.id);
	if (idx === -1) return res.status(404).json({ error: "Student not found" });
	// Remove student
	const [removed] = students.splice(idx, 1);
	// Remove related enrollments
	for (let i = enrollments.length - 1; i >= 0; i--) {
		if (enrollments[i].studentId === removed.id) {
			enrollments.splice(i, 1);
		}
	}
	res.json({ success: true });
});

// Enrollments
app.get("/api/students/:id/enrollments", authRequired, (req, res) => {
	const student = findStudent(req.params.id);
	if (!student) return res.status(404).json({ error: "Student not found" });
	const result = enrollments
		.filter((e) => e.studentId === student.id)
		.map((e) => ({
			...e,
			course: findCourse(e.courseId)
		}));
	res.json(result);
});

app.post("/api/students/:id/enrollments", authRequired, (req, res) => {
	const student = findStudent(req.params.id);
	const { courseId } = req.body || {};
	if (!student) return res.status(404).json({ error: "Student not found" });
	const course = findCourse(courseId);
	if (!course) return res.status(400).json({ error: "Invalid courseId" });
	const exists = enrollments.some(
		(e) => e.studentId === student.id && e.courseId === course.id
	);
	if (exists) return res.status(409).json({ error: "Already enrolled" });
	const enrollment = { id: uuidv4(), studentId: student.id, courseId: course.id };
	enrollments.push(enrollment);
	res.status(201).json(enrollment);
});

app.delete("/api/students/:id/enrollments/:enrollmentId", authRequired, (req, res) => {
	const student = findStudent(req.params.id);
	if (!student) return res.status(404).json({ error: "Student not found" });
	const idx = enrollments.findIndex(
		(e) => e.id === req.params.enrollmentId && e.studentId === student.id
	);
	if (idx === -1) return res.status(404).json({ error: "Enrollment not found" });
	enrollments.splice(idx, 1);
	res.json({ success: true });
});

// Grades
app.put("/api/enrollments/:enrollmentId/grade", authRequired, (req, res) => {
	const { grade } = req.body || {};
	const enrollment = enrollments.find((e) => e.id === req.params.enrollmentId);
	if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
	enrollment.grade = grade ?? null;
	res.json(enrollment);
});

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Server listening on http://localhost:${PORT}`);
});

