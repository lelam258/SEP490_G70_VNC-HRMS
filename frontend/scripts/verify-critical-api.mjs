
import test from "node:test";
import assert from "node:assert/strict";

const API = process.env.API_BASE_URL || "http://localhost:5100";

const admin = {
    login: process.env.QA_ADMIN_LOGIN,
    password: process.env.QA_ADMIN_PASSWORD,
};

const employee = {
    login: process.env.QA_EMPLOYEE_LOGIN,
    password: process.env.QA_EMPLOYEE_PASSWORD,
};

const accountant = {
    login: process.env.QA_ACCOUNTANT_LOGIN,
    password: process.env.QA_ACCOUNTANT_PASSWORD,
};

const hr = {
    login: process.env.QA_HR_LOGIN,
    password: process.env.QA_HR_PASSWORD,
};

function configured(account) {
    return Boolean(account.login && account.password);
}

async function login(account) {
    const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            login: account.login,
            password: account.password,
        }),
    });

    assert.equal(response.status, 200, "Login phải thành công");

    const data = await response.json();

    assert.ok(data.accessToken, "Response phải có accessToken");
    assert.ok(data.user, "Response phải có thông tin user");

    const setCookie = response.headers.get("set-cookie") || "";
    const match = setCookie.match(/vnc\.hrms\.refresh=([^;]+)/);

    return {
        token: data.accessToken,
        cookie: match ? `vnc.hrms.refresh=${match[1]}` : "",
        user: data.user,
    };
}

async function api(path, options = {}) {
    const headers = {
        Accept: "application/json",
        ...options.headers,
    };

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }

    if (options.cookie) {
        headers.Cookie = options.cookie;
    }

    return fetch(`${API}${path}`, {
        ...options,
        headers,
    });
}

// SYS-01: Health check
test("SYS-01 - Backend health check", async () => {
    const response = await api("/health");

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.equal(data.status, "ok");
    assert.ok(data.application);
});

// AUTH-03: Sai mật khẩu
test(
    "AUTH-03 - Reject login with wrong password",
    { skip: !configured(employee) },
    async () => {
        const response = await api("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                login: employee.login,
                password: "Wrong!2026",
            }),
        });

        assert.equal(response.status, 401);
    }
);

// AUTH-02: Đăng nhập thành công
test(
    "AUTH-02 - Login with valid account",
    { skip: !configured(admin) },
    async () => {
        const session = await login(admin);

        assert.ok(session.token);
        assert.equal(session.user.role, "admin");
    }
);

// PERM-02: Employee không được quản lý tài khoản
test(
    "PERM-02 - Employee cannot access user management API",
    { skip: !configured(employee) },
    async () => {
        const session = await login(employee);

        const response = await api("/api/users", {
            token: session.token,
        });

        assert.equal(response.status, 403);
    }
);

// PERM-03: Employee không được quản lý nhân viên
test(
    "PERM-03 - Employee cannot access employee management API",
    { skip: !configured(employee) },
    async () => {
        const session = await login(employee);

        const response = await api("/api/employees", {
            token: session.token,
        });

        assert.equal(response.status, 403);
    }
);

// PERM-04: Employee không được truy cập payroll
test(
    "PERM-04 - Employee cannot access payroll API",
    { skip: !configured(employee) },
    async () => {
        const session = await login(employee);

        const response = await api("/api/payroll/periods", {
            token: session.token,
        });

        assert.equal(response.status, 403);
    }
);

// PERM-04 bổ sung: Accountant được truy cập payroll
test(
    "PERM-04 - Accountant can access payroll API",
    { skip: !configured(accountant) },
    async () => {
        const session = await login(accountant);

        const response = await api("/api/payroll/periods", {
            token: session.token,
        });

        assert.equal(response.status, 200);
    }
);

// PERM-03 bổ sung: HR Manager được truy cập danh sách nhân viên
test(
    "PERM-03 - HR Manager can access employee API",
    { skip: !configured(hr) },
    async () => {
        const session = await login(hr);

        const response = await api("/api/employees", {
            token: session.token,
        });

        assert.equal(response.status, 200);
    }
);

// PERM-06: Không có token thì không được truy cập API bảo vệ
test("PERM-06 - Reject unauthenticated request", async () => {
    const response = await api("/api/users");

    assert.equal(response.status, 401);
});

// AUTH-13: Logout và kiểm tra access token cũ
test(
    "AUTH-13 - Logout invalidates the old session",
    { skip: !configured(admin) },
    async () => {
        const session = await login(admin);

        assert.ok(session.cookie, "Login phải trả refresh cookie");

        const logout = await api("/api/auth/logout", {
            method: "POST",
            token: session.token,
            cookie: session.cookie,
            headers: {
                "Content-Type": "application/json",
            },
            body: "{}",
        });

        assert.equal(logout.status, 204);

        const me = await api("/api/auth/me", {
            token: session.token,
        });

        assert.equal(me.status, 401);
    }
);
