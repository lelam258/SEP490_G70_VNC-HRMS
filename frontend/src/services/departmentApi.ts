import { axiosClient } from './axiosClient';

export type FacilityOption = { id: string; name: string; status: string };
export type Department = {
  id: string;
  code: string;
  name: string;
  status: string;
  facilityIds?: string[];
  facilityLabel?: string;
};

const LOCAL_DEPT_FACILITIES_KEY = 'vnc_dept_facilities_map_v1';

const FALLBACK_FACILITIES: FacilityOption[] = [
  { id: '11111111-1111-1111-1111-111111111101', name: 'Cơ sở 1', status: 'active' },
  { id: '11111111-1111-1111-1111-111111111102', name: 'Cơ sở 2', status: 'active' },
];

export function readLocalDeptFacilitiesMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LOCAL_DEPT_FACILITIES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function readSharedDeptFacilitiesMap(): Promise<Record<string, string[]>> {
  const local = readLocalDeptFacilitiesMap();
  try {
    const res = await fetch('/api/department-facilities-map', { cache: 'no-store' });
    if (res.ok) {
      const serverMap = (await res.json()) as Record<string, string[]>;
      if (serverMap && typeof serverMap === 'object') {
        const merged = { ...local, ...serverMap };
        localStorage.setItem(LOCAL_DEPT_FACILITIES_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch {
    // ignore fetch error
  }
  return local;
}

export async function writeSharedDeptFacilityIds(departmentId: string, facilityIds: string[]) {
  try {
    const map = readLocalDeptFacilitiesMap();
    map[departmentId] = facilityIds;
    localStorage.setItem(LOCAL_DEPT_FACILITIES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }

  try {
    await fetch('/api/department-facilities-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId, facilityIds }),
    });
  } catch {
    // ignore network error
  }
}

export function formatDepartmentFacilityLabel(
  assignedIds: string[] | undefined,
  facilities: FacilityOption[]
): string {
  if (!facilities.length) return 'Cả hai (Cơ sở 1 & Cơ sở 2)';
  const validNames = facilities
    .filter((f) => !assignedIds || assignedIds.length === 0 || assignedIds.includes(f.id))
    .map((f) => f.name);
  if (validNames.length === 0 || validNames.length >= facilities.length) {
    return `Cả hai (${facilities.map((f) => f.name).join(' & ')})`;
  }
  return `Chỉ thuộc ${validNames.join(', ')}`;
}

async function fetchActiveFacilities(): Promise<FacilityOption[]> {
  try {
    const res = await axiosClient.get<FacilityOption[]>('/departments/facilities');
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // Fallback to /schedules/options if /departments/facilities is not available yet
  }

  try {
    const res = await axiosClient.get<{
      facilities?: Array<{ id: string; name: string; status?: string }>;
    }>('/schedules/options');
    const list = (res.data?.facilities ?? [])
      .filter((f) => !f.status || f.status === 'active')
      .map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status || 'active',
      }));
    if (list.length > 0) {
      return list;
    }
  } catch {
    // Fallback to default Cơ sở 1 & Cơ sở 2
  }

  return FALLBACK_FACILITIES;
}

function enrichDepartmentWithFacilities(
  dept: Department,
  facilities: FacilityOption[],
  sharedMap: Record<string, string[]>
): Department {
  const allFacilityIds = facilities.map((f) => f.id);
  const validFacilitySet = new Set(allFacilityIds);

  const fromShared = sharedMap[dept.id]?.filter((id) => validFacilitySet.has(id));
  const fromServer = dept.facilityIds?.filter((id) => validFacilitySet.has(id));

  const resolvedIds =
    fromShared && fromShared.length > 0
      ? fromShared
      : fromServer && fromServer.length > 0
      ? fromServer
      : allFacilityIds;

  return {
    ...dept,
    facilityIds: resolvedIds,
    facilityLabel: formatDepartmentFacilityLabel(resolvedIds, facilities),
  };
}

export const departmentApi = {
  async setStatus(id: string, status: 'active' | 'inactive') {
    const res = await axiosClient.patch<Department>(`/departments/${id}/status`, { status });
    const [facilities, sharedMap] = await Promise.all([
      fetchActiveFacilities(),
      readSharedDeptFacilitiesMap(),
    ]);
    return enrichDepartmentWithFacilities(res.data, facilities, sharedMap);
  },

  async list() {
    const [rawDepts, facilities, sharedMap] = await Promise.all([
      axiosClient.get<Department[]>('/departments').then((r) => r.data),
      fetchActiveFacilities(),
      readSharedDeptFacilitiesMap(),
    ]);
    return rawDepts.map((d) => enrichDepartmentWithFacilities(d, facilities, sharedMap));
  },

  async listFacilities() {
    return fetchActiveFacilities();
  },

  async assignFacilities(id: string, facilityIds: string[]) {
    await writeSharedDeptFacilityIds(id, facilityIds);
    try {
      const res = await axiosClient.put<Department>(`/departments/${id}/facilities`, {
        facilityIds,
      });
      const [facilities, sharedMap] = await Promise.all([
        fetchActiveFacilities(),
        readSharedDeptFacilitiesMap(),
      ]);
      return enrichDepartmentWithFacilities(res.data, facilities, sharedMap);
    } catch {
      const [depts, facilities, sharedMap] = await Promise.all([
        axiosClient.get<Department[]>('/departments').then((r) => r.data),
        fetchActiveFacilities(),
        readSharedDeptFacilitiesMap(),
      ]);
      const found = depts.find((d) => d.id === id) ?? {
        id,
        code: '',
        name: '',
        status: 'active',
      };
      return enrichDepartmentWithFacilities(found, facilities, sharedMap);
    }
  },

  async create(input: { code: string; name: string; facilityIds?: string[] }) {
    const res = await axiosClient.post<Department>('/departments', input);
    if (input.facilityIds && input.facilityIds.length > 0) {
      await writeSharedDeptFacilityIds(res.data.id, input.facilityIds);
    }
    const [facilities, sharedMap] = await Promise.all([
      fetchActiveFacilities(),
      readSharedDeptFacilitiesMap(),
    ]);
    return enrichDepartmentWithFacilities(res.data, facilities, sharedMap);
  },

  async update(
    id: string,
    input: { code: string; name: string; status: string; facilityIds?: string[] }
  ) {
    if (input.facilityIds && input.facilityIds.length > 0) {
      await writeSharedDeptFacilityIds(id, input.facilityIds);
    }
    const res = await axiosClient.put<Department>(`/departments/${id}`, input);
    const [facilities, sharedMap] = await Promise.all([
      fetchActiveFacilities(),
      readSharedDeptFacilitiesMap(),
    ]);
    return enrichDepartmentWithFacilities(res.data, facilities, sharedMap);
  },
};
