let _counter = 0;
const next = () => ++_counter;

export function resetCounter() {
    _counter = 0;
}

export function createUser(overrides: Record<string, any> = {}) {
    const n = next();
    return {
        usr_id: `user-${n}`,
        firstname: "Test",
        lastname: `User${n}`,
        email: `user${n}@example.com`,
        password: "$2b$10$hashedpassword",
        role: "user",
        created_at: new Date("2025-01-01"),
        updated_at: new Date("2025-01-01"),
        ...overrides,
    };
}

export function createProject(overrides: Record<string, any> = {}) {
    const n = next();
    return {
        pr_id: `project-${n}`,
        pr_name: `Project ${n}`,
        owner_id: `user-${n}`,
        created_at: new Date("2025-01-01"),
        updated_at: new Date("2025-01-01"),
        documents: [],
        ...overrides,
    };
}

export function createClassroom(overrides: Record<string, any> = {}) {
    const n = next();
    const code = n.toString(16).toUpperCase().padStart(6, "0");
    return {
        cl_id: `classroom-${n}`,
        name: `Classroom ${n}`,
        description: null,
        join_code: code,
        teacher_id: `user-${n}`,
        created_at: new Date("2025-01-01"),
        _count: { enrollments: 0, projects: 0 },
        ...overrides,
    };
}

export function createInvitation(overrides: Record<string, any> = {}) {
    const n = next();
    return {
        inv_id: `invitation-${n}`,
        guest_id: `user-${n}`,
        project_id: `project-${n}`,
        role: "EDITOR" as const,
        invitation_state: "Accepted" as const,
        invitation_token: `token-${n}-${Math.random().toString(36).slice(2)}`,
        created_at: new Date("2025-01-01"),
        ...overrides,
    };
}

export function createEnrollment(overrides: Record<string, any> = {}) {
    const n = next();
    return {
        enr_id: `enrollment-${n}`,
        student_id: `user-${n}`,
        classroom_id: `classroom-${n}`,
        enrolled_at: new Date("2025-01-01"),
        ...overrides,
    };
}
