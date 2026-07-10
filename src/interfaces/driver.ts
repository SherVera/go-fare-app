export interface MockDriver {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  status: 'active' | 'inactive';
}

export interface MockVehicle {
  uuid: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  cooperativeName: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  assignedDriver?: MockDriver;
  adminNotes?: string;
}
