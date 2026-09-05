export interface MockDriver {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  email?: string;
  driverUuid?: string;
  userUuid?: string;
  status: 'active' | 'inactive';
}

export type VehicleStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'approved'
  | 'pending'
  | 'rejected';

export interface MockVehicle {
  uuid: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  cooperativeName: string;
  status: VehicleStatus;
  rawStatus?: string;
  createdAt: string;
  assignedDriver?: MockDriver;
  adminNotes?: string;
  color?: string;
  capacity?: number;
  totalEarnings?: number;
  tripsCount?: number;
  photoUrl?: string;
  routeNumber?: string;
  inviteCode?: string;
}
