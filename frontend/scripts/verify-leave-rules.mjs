import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { calculateWorkingDays, getTodayInVietnam, formatVietnamDateTime } = await server.ssrLoadModule('/src/utils/leaveRules.ts');

  // Test 1: CountWorkingDays == 0 (Sunday only) throws 400 MSG
  // 2026-11-01 is a Sunday
  const sunday = '2026-11-01';
  assert.throws(() => {
    calculateWorkingDays(sunday, sunday, '2026-10-01');
  }, (err) => {
    assert.match(err.message, /Khoảng thời gian đã chọn không có ngày làm việc/);
    return true;
  });

  // Test 2: At 01:00 AM VN time, yesterday is rejected
  // Suppose UTC is 2026-10-27 18:00:00 (which is 2026-10-28 01:00:00 in Vietnam UTC+7)
  const utcDateAt1AmVn = new Date('2026-10-27T18:00:00Z');
  const todayInVn = getTodayInVietnam(utcDateAt1AmVn);
  assert.equal(todayInVn, '2026-10-28');

  // Yesterday relative to 2026-10-28 is 2026-10-27
  assert.throws(() => {
    calculateWorkingDays('2026-10-27', '2026-10-27', todayInVn);
  }, (err) => {
    assert.match(err.message, /Ngày bắt đầu nghỉ không được ở trong quá khứ/);
    return true;
  });

  // Test 3: Normal range counts working days properly (Mon-Sat = 6 days, Sun excluded)
  // 2026-11-02 (Mon) to 2026-11-08 (Sun) = 6 working days
  const days = calculateWorkingDays('2026-11-02', '2026-11-08', '2026-10-01');
  assert.equal(days, 6);

  // Test 4: formatVietnamDateTime formats UTC to UTC+7
  const formatted = formatVietnamDateTime('2026-10-27T18:00:00Z');
  assert.equal(formatted, '28/10/2026 01:00');

  console.log('PASS: LeaveRules working days, Sunday exclusion, 0 working days rejection, and VN timezone 01:00 yesterday rejection.');
} finally {
  await server.close();
}
