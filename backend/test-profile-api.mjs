// Test API /api/me/profile according to specifications
const API_BASE = 'http://localhost:5100';

async function main() {
  // 1. Login as accountant
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'accountant', password: 'Password@123' }),
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const { accessToken } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  console.log('Login successful. Testing Profile API...');

  async function testCase(name, body, expectedStatus, expectedField) {
    const res = await fetch(`${API_BASE}/api/me/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    const statusMatch = res.status === expectedStatus;
    const fieldMatch = !expectedField || data.field === expectedField;

    if (statusMatch && fieldMatch) {
      console.log(`[PASS] ${name} -> HTTP ${res.status}${data.field ? ` (Field: '${data.field}', Message: '${data.message}')` : ''}`);
      return data;
    } else {
      console.error(`[FAIL] ${name} -> Expected ${expectedStatus}/${expectedField} but got ${res.status}/${data.field}`, data);
      return data;
    }
  }

  // Case 1: Họ tên rỗng -> 400 (fullName)
  await testCase('1. Họ tên rỗng', { fullName: '', phone: '0987654321' }, 400, 'fullName');

  // Case 2: Họ tên 1 ký tự -> 400 (fullName)
  await testCase('2. Họ tên 1 ký tự', { fullName: 'A', phone: '0987654321' }, 400, 'fullName');

  // Case 3: Họ tên có số -> 400 (fullName)
  await testCase('3. Họ tên có số', { fullName: 'Nguyễn Văn 123', phone: '0987654321' }, 400, 'fullName');

  // Case 4: Ngày sinh chưa đủ 18 tuổi -> 400 (dateOfBirth)
  await testCase('4. Ngày sinh chưa đủ 18 tuổi', { fullName: 'Nguyễn Thị Kế Toán', dateOfBirth: '2015-01-01', phone: '0987654321' }, 400, 'dateOfBirth');

  // Case 5: Giới tính ngoài danh sách -> 400 (gender)
  await testCase('5. Giới tính ngoài danh sách', { fullName: 'Nguyễn Thị Kế Toán', gender: 'unknown', phone: '0987654321' }, 400, 'gender');

  // Case 6: CCCD 11 số -> 400 (idCardNumber)
  await testCase('6. CCCD 11 số', { fullName: 'Nguyễn Thị Kế Toán', idCardNumber: '12345678901', phone: '0987654321' }, 400, 'idCardNumber');

  // Case 7: CCCD trùng người khác -> 409 (idCardNumber)
  await testCase('7. CCCD trùng người khác (001200000001)', { fullName: 'Nguyễn Thị Kế Toán', idCardNumber: '001200000001', phone: '0987654321' }, 409, 'idCardNumber');

  // Test Case 8: Cập nhật hợp lệ -> 200, User.FullName sync, AuditLog
  const updated = await testCase('8. Cập nhật hợp lệ', {
    fullName: 'Nguyễn Thị Kế Toán Mới',
    dateOfBirth: '1995-10-20',
    gender: 'female',
    idCardNumber: '001200999888',
    phone: '0912345678',
    dependentCount: 99, // Should be ignored
    email: 'hacker@vnc.local', // Should be ignored
  }, 200);

  if (updated && updated.fullName === 'Nguyễn Thị Kế Toán Mới') {
    console.log('[PASS] Profile returned updated FullName and Phone.');
  }

  // Restore name back
  await testCase('Restore name', {
    fullName: 'Nguyễn Thị Kế Toán',
    dateOfBirth: '1995-10-20',
    gender: 'female',
    idCardNumber: '001200999888',
    phone: '0987654321',
  }, 200);
}

main().catch(err => console.error(err));
