export class MaintenanceRequest {
  id: string;
  managerId: string;
  propertyId: string;
  unitId?: string;
  singleUnitDetailId?: string;
  requestType?: string; // Consider using enum
  equipmentLinked: boolean;
  equipmentId?: string;
  category: string; // Consider using enum
  subcategory: string;
  issue?: string;
  subissue?: string;
  title: string;
  problemDetails?: string;
  priority: string; // Consider using enum
  status: string; // Consider using enum
  internalNotes?: string;
  tenantInformation?: string;
  requestedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}