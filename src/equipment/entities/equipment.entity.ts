export enum EquipmentStatus {
  ACTIVE = 'ACTIVE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  REPLACED = 'REPLACED',
  DISPOSED = 'DISPOSED',
}

export class Equipment {
  id: string;
  propertyId: string;
  unitId?: string;
  singleUnitDetailId?: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  price: number;
  dateOfInstallation: Date;
  equipmentDetails?: string;
  photoUrl?: string;
  status: EquipmentStatus;
  createdAt: Date;
  updatedAt: Date;
}
