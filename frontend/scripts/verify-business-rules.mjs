import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { validateEmployeeBasics, validateEmployeeProfile } = await server.ssrLoadModule('/src/utils/employeeRules.ts');
  const basics = { code: 'NV01', name: "Nguyễn Thị An", email: null };
  const profile = { ...basics, dateOfBirth: '2000-01-01', dateJoined: '2024-01-01', dateLeft: '', phone: '', idCardNumber: '', dependentCount: 0 };
  const today = '2026-11-06';
  assert.equal(validateEmployeeBasics(basics), '');
  assert.equal(validateEmployeeBasics({ ...basics, name: "Jean-Luc O'Neil" }), '');
  assert.ok(validateEmployeeBasics({ ...basics, code: '   ' }));
  assert.ok(validateEmployeeBasics({ ...basics, name: 'NV123' }));
  assert.ok(validateEmployeeBasics({ ...basics, name: 'A' }));
  assert.equal(validateEmployeeProfile(profile, today), '');
  assert.equal(validateEmployeeProfile({ ...profile, phone: '0912345678', idCardNumber: '012345678901', dateOfBirth: '2008-11-06' }, today), '');
  assert.ok(validateEmployeeProfile({ ...profile, dateOfBirth: '2008-11-07' }, today));
  assert.ok(validateEmployeeProfile({ ...profile, dateOfBirth: '1939-12-31' }, today));
  assert.ok(validateEmployeeProfile({ ...profile, dateJoined: '1999-12-31' }, today));
  assert.ok(validateEmployeeProfile({ ...profile, dateLeft: '2023-12-31' }, today));
  assert.equal(validateEmployeeProfile({ ...profile, dateLeft: '2024-01-01' }, today), '');
  assert.ok(validateEmployeeProfile({ ...profile, phone: '1234567890' }, today));
  assert.ok(validateEmployeeProfile({ ...profile, idCardNumber: '123' }, today));
  assert.ok(validateEmployeeProfile({ ...profile, dependentCount: -1 }, today));
  assert.ok(validateEmployeeProfile({ ...profile, dependentCount: 0.5 }, today));
  console.log('PASS 16 employee business rule cases: optional fields, names, age boundary, employment dates, phone, CCCD and dependents.');
  const { schedulePermissions } = await server.ssrLoadModule('/src/utils/schedule.ts');
  const week = { monday: '2026-11-09', closed: false, assignmentCount: 1, isCorrection: false,
    serverNow: '2026-11-06T10:00:00+07:00', planningStartsAt: '2026-11-02T00:00:00+07:00',
    publishDeadline: '2026-11-09T07:00:00+07:00', correctionEndsAt: '2026-11-16T00:00:00+07:00' };
  const at = (status, time) => schedulePermissions(status, Date.parse(time));
  assert.equal(at(week, '2026-11-01T23:59:59+07:00').canEdit, false);
  assert.equal(at(week, week.planningStartsAt).canEdit, true);
  assert.equal(at(week, '2026-11-06T10:00:00+07:00').canPublish, true);
  assert.equal(at(week, '2026-11-09T06:59:59.999+07:00').canPublish, true);
  assert.equal(at(week, week.publishDeadline).canPublish, false);
  assert.equal(at(week, '2026-11-09T00:00:00Z').canEdit, false);
  assert.equal(at({ ...week, closed: true }, week.serverNow).canEdit, false);
  assert.equal(at({ ...week, assignmentCount: 0 }, week.serverNow).canPublish, false);
  assert.equal(at({ ...week, closed: true }, '2026-11-09T08:00:00+07:00').canReopen, true);
  assert.equal(at({ ...week, isCorrection: true }, '2026-11-09T08:00:00+07:00').canPublish, true);
  assert.equal(at({ ...week, isCorrection: true }, '2026-11-15T23:59:59.999+07:00').canEdit, true);
  assert.equal(at({ ...week, isCorrection: true }, week.correctionEndsAt).canEdit, false);
  assert.equal(at({ ...week, closed: true }, week.correctionEndsAt).canReopen, false);
  assert.equal(at(undefined, week.serverNow).canEdit, false);
  console.log('PASS 14 schedule permission cases: next-week planning, exact publication cutoff, timezone, reopened corrections and expiry.');
} finally {
  await server.close();
}
