export class Leasing {
  id: string;
  propertyId: string;
  monthlyRent: number;
  securityDeposit?: number;
  amountRefundable?: number;
  dateAvailable: Date;
  minLeaseDuration: string;
  maxLeaseDuration: string;
  description?: string;
  petsAllowed: boolean;
  petCategory: string[];
  petDeposit?: number;
  petFee?: number;
  petDescription?: string;
  onlineRentalApplication: boolean;
  requireApplicationFee: boolean;
  applicationFee?: number;
  applicantName: string;
  applicantContact: string;
  applicantEmail: string;
  createdAt: Date;
  updatedAt: Date;
}
