-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROPERTY_MANAGER', 'TENANT', 'SERVICE_PRO');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL_PASSWORD', 'GOOGLE', 'APPLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'EXPIRED', 'TRIALING');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParkingType" AS ENUM ('NONE', 'STREET', 'GARAGE', 'DRIVEWAY', 'DEDICATED_SPOT', 'PRIVATE_LOT', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "LaundryType" AS ENUM ('NONE', 'IN_UNIT', 'ON_SITE', 'HOOKUPS');

-- CreateEnum
CREATE TYPE "AirConditioningType" AS ENUM ('NONE', 'CENTRAL', 'WINDOW', 'PORTABLE', 'COOLER');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaseDuration" AS ENUM ('ONE_MONTH', 'TWO_MONTHS', 'THREE_MONTHS', 'FOUR_MONTHS', 'FIVE_MONTHS', 'SIX_MONTHS', 'SEVEN_MONTHS', 'EIGHT_MONTHS', 'NINE_MONTHS', 'TEN_MONTHS', 'ELEVEN_MONTHS', 'TWELVE_MONTHS', 'THIRTEEN_MONTHS', 'FOURTEEN_MONTHS', 'FIFTEEN_MONTHS', 'SIXTEEN_MONTHS', 'SEVENTEEN_MONTHS', 'EIGHTEEN_MONTHS', 'NINETEEN_MONTHS', 'TWENTY_MONTHS', 'TWENTY_ONE_MONTHS', 'TWENTY_TWO_MONTHS', 'TWENTY_THREE_MONTHS', 'TWENTY_FOUR_MONTHS', 'THIRTY_SIX_PLUS_MONTHS', 'CONTACT_FOR_DETAILS');

-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('EMAIL_VERIFICATION', 'DEVICE_VERIFICATION');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('ENTIRE_PROPERTY', 'UNIT');

-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('VACANT', 'OCCUPIED', 'PARTIALLY_OCCUPIED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ListingVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ResidenceType" AS ENUM ('RENT', 'OWN');

-- CreateEnum
CREATE TYPE "RibbonType" AS ENUM ('NONE', 'CHAT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'REPLACED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "MaintenanceRequestType" AS ENUM ('MAINTENANCE', 'REPAIR', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('APPLIANCES', 'ELECTRICAL', 'EXTERIOR', 'HOUSEHOLD', 'OUTDOORS', 'PLUMBING');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('NEW', 'IN_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'VENDOR_NOTIFIED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KeyType" AS ENUM ('DOOR', 'MAILBOX', 'GARAGE', 'GATE', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PreferredBeds" AS ENUM ('ANY', 'STUDIO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE_PLUS');

-- CreateEnum
CREATE TYPE "PreferredBaths" AS ENUM ('ANY', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE_PLUS');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionCategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionFrequency" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PROPERTY_MANAGER',
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneCountryCode" TEXT,
    "phoneNumber" TEXT,
    "country" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "address" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT',
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "renterProfileLink" TEXT NOT NULL,
    "newPlace" BOOLEAN,
    "landlordEmail" TEXT,
    "preferredLocation" BOOLEAN,
    "preferredRentals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredBeds" "PreferredBeds",
    "preferredBaths" "PreferredBaths",
    "preferredMinRent" DECIMAL(65,30),
    "preferredMaxRent" DECIMAL(65,30),
    "preferredPetAllowance" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAuthIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT,
    "passwordHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT,
    "passwordHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "deviceTokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateRegion" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "yearBuilt" INTEGER,
    "mlsNumber" TEXT,
    "propertyType" "PropertyType" NOT NULL,
    "sizeSqft" DECIMAL(65,30),
    "marketRent" DECIMAL(65,30),
    "depositAmount" DECIMAL(65,30),
    "coverPhotoUrl" TEXT,
    "youtubeUrl" TEXT,
    "ribbonType" "RibbonType" NOT NULL DEFAULT 'NONE',
    "ribbonTitle" TEXT,
    "description" TEXT,
    "listingContactName" TEXT,
    "listingPhoneCountryCode" TEXT,
    "listingPhoneNumber" TEXT,
    "listingEmail" TEXT,
    "displayPhonePublicly" BOOLEAN NOT NULL DEFAULT false,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_attachments" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "apartmentType" TEXT,
    "sizeSqft" DECIMAL(65,30),
    "beds" INTEGER,
    "baths" DECIMAL(65,30),
    "rent" DECIMAL(65,30),

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_unit_details" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "beds" INTEGER,
    "baths" DECIMAL(65,30),
    "marketRent" DECIMAL(65,30),
    "deposit" DECIMAL(65,30),

    CONSTRAINT "single_unit_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "singleUnitDetailId" TEXT,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "dateOfInstallation" TIMESTAMP(3) NOT NULL,
    "equipmentDetails" TEXT,
    "photoUrl" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keys" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "singleUnitDetailId" TEXT,
    "keyName" TEXT NOT NULL,
    "keyType" "KeyType" NOT NULL,
    "description" TEXT,
    "keyPhotoUrl" TEXT,
    "status" "KeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "issuedTo" TEXT,
    "issuedDate" TIMESTAMP(3),
    "returnedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "singleUnitDetailId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionCategoryType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSchedule" (
    "id" TEXT NOT NULL,
    "frequency" "TransactionFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountTotal" DECIMAL(65,30) NOT NULL,
    "balanceRemaining" DECIMAL(65,30) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tenantId" TEXT,
    "propertyId" TEXT,
    "propertyManagerId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_providers" (
    "id" TEXT NOT NULL,
    "photoUrl" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyWebsite" TEXT,
    "faxNumber" TEXT,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "singleUnitDetailId" TEXT,
    "requestType" "MaintenanceRequestType",
    "equipmentLinked" BOOLEAN NOT NULL DEFAULT false,
    "equipmentId" TEXT,
    "category" "MaintenanceCategory" NOT NULL,
    "subcategory" TEXT NOT NULL,
    "issue" TEXT,
    "subissue" TEXT,
    "title" TEXT NOT NULL,
    "problemDetails" TEXT,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'NEW',
    "internalNotes" TEXT,
    "tenantId" TEXT,
    "tenantInformation" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_photos" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "videoUrl" TEXT,
    "description" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_assignments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "serviceProviderId" TEXT,
    "assignedToUserId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_materials" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "singleUnitDetailId" TEXT,
    "parking" "ParkingType" NOT NULL,
    "laundry" "LaundryType" NOT NULL,
    "airConditioning" "AirConditioningType" NOT NULL,
    "propertyFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_leasing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "singleUnitDetailId" TEXT,
    "monthlyRent" DECIMAL(65,30) NOT NULL,
    "securityDeposit" DECIMAL(65,30),
    "amountRefundable" DECIMAL(65,30),
    "dateAvailable" TIMESTAMP(3) NOT NULL,
    "minLeaseDuration" "LeaseDuration" NOT NULL,
    "maxLeaseDuration" "LeaseDuration" NOT NULL,
    "description" TEXT,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "petCategory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "petDeposit" DECIMAL(65,30),
    "petFee" DECIMAL(65,30),
    "petDescription" TEXT,
    "onlineRentalApplication" BOOLEAN NOT NULL DEFAULT false,
    "requireApplicationFee" BOOLEAN NOT NULL DEFAULT false,
    "applicationFee" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_leasing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "currentTenantId" TEXT,
    "listingType" "ListingType" NOT NULL DEFAULT 'ENTIRE_PROPERTY',
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "occupancyStatus" "OccupancyStatus" NOT NULL DEFAULT 'VACANT',
    "visibility" "ListingVisibility" NOT NULL DEFAULT 'PUBLIC',
    "listingPrice" DECIMAL(65,30),
    "monthlyRent" DECIMAL(65,30),
    "securityDeposit" DECIMAL(65,30),
    "amountRefundable" DECIMAL(65,30),
    "minLeaseDuration" "LeaseDuration",
    "maxLeaseDuration" "LeaseDuration",
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "petCategory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicationFee" DECIMAL(65,30),
    "onlineApplicationAvailable" BOOLEAN NOT NULL DEFAULT false,
    "externalListingUrl" TEXT,
    "source" TEXT,
    "title" TEXT,
    "description" TEXT,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "leasingId" TEXT NOT NULL,
    "invitedById" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moveInDate" TIMESTAMP(3) NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicants" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupants" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "relationship" TEXT NOT NULL,

    CONSTRAINT "occupants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL(65,30),
    "breed" TEXT NOT NULL,
    "photoUrl" TEXT,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "registeredIn" TEXT NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residence_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "residenceType" "ResidenceType" NOT NULL,
    "monthlyRent" DECIMAL(65,30),
    "moveInDate" TIMESTAMP(3) NOT NULL,
    "moveOutDate" TIMESTAMP(3),
    "landlordName" TEXT NOT NULL,
    "landlordEmail" TEXT NOT NULL,
    "landlordPhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "additionalInfo" TEXT,

    CONSTRAINT "residence_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_details" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "incomeType" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "monthlyIncome" DECIMAL(65,30) NOT NULL,
    "officeAddress" TEXT NOT NULL,
    "supervisorName" TEXT NOT NULL,
    "supervisorPhone" TEXT NOT NULL,
    "additionalInfo" TEXT,

    CONSTRAINT "income_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "details" TEXT,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_contacts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "yearsKnown" INTEGER NOT NULL,

    CONSTRAINT "reference_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_questions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "smoke" BOOLEAN NOT NULL,
    "militaryMember" BOOLEAN NOT NULL,
    "criminalRecord" BOOLEAN NOT NULL,
    "bankruptcy" BOOLEAN NOT NULL,
    "refusedRent" BOOLEAN NOT NULL,
    "evicted" BOOLEAN NOT NULL,

    CONSTRAINT "background_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_email_key" ON "TenantUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAuthIdentity_tenantId_provider_key" ON "TenantAuthIdentity"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthIdentity_userId_provider_key" ON "UserAuthIdentity"("userId", "provider");

-- CreateIndex
CREATE INDEX "Otp_userId_type_isUsed_idx" ON "Otp"("userId", "type", "isUsed");

-- CreateIndex
CREATE INDEX "Otp_code_expiresAt_isUsed_idx" ON "Otp"("code", "expiresAt", "isUsed");

-- CreateIndex
CREATE INDEX "Device_userId_isVerified_idx" ON "Device"("userId", "isVerified");

-- CreateIndex
CREATE INDEX "Device_deviceTokenHash_idx" ON "Device"("deviceTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceTokenHash_key" ON "Device"("userId", "deviceTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Address_propertyId_key" ON "Address"("propertyId");

-- CreateIndex
CREATE INDEX "property_photos_propertyId_idx" ON "property_photos"("propertyId");

-- CreateIndex
CREATE INDEX "property_attachments_propertyId_idx" ON "property_attachments"("propertyId");

-- CreateIndex
CREATE INDEX "units_propertyId_idx" ON "units"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "single_unit_details_propertyId_key" ON "single_unit_details"("propertyId");

-- CreateIndex
CREATE INDEX "equipment_propertyId_idx" ON "equipment"("propertyId");

-- CreateIndex
CREATE INDEX "equipment_unitId_idx" ON "equipment"("unitId");

-- CreateIndex
CREATE INDEX "equipment_singleUnitDetailId_idx" ON "equipment"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "keys_propertyId_idx" ON "keys"("propertyId");

-- CreateIndex
CREATE INDEX "keys_unitId_idx" ON "keys"("unitId");

-- CreateIndex
CREATE INDEX "keys_singleUnitDetailId_idx" ON "keys"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "keys_status_idx" ON "keys"("status");

-- CreateIndex
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");

-- CreateIndex
CREATE INDEX "Lease_propertyId_idx" ON "Lease"("propertyId");

-- CreateIndex
CREATE INDEX "Lease_unitId_idx" ON "Lease"("unitId");

-- CreateIndex
CREATE INDEX "Lease_singleUnitDetailId_idx" ON "Lease"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_dueDate_idx" ON "Transaction"("dueDate");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_idx" ON "Transaction"("tenantId");

-- CreateIndex
CREATE INDEX "Transaction_propertyManagerId_idx" ON "Transaction"("propertyManagerId");

-- CreateIndex
CREATE INDEX "maintenance_requests_managerId_idx" ON "maintenance_requests"("managerId");

-- CreateIndex
CREATE INDEX "maintenance_requests_propertyId_idx" ON "maintenance_requests"("propertyId");

-- CreateIndex
CREATE INDEX "maintenance_requests_unitId_idx" ON "maintenance_requests"("unitId");

-- CreateIndex
CREATE INDEX "maintenance_requests_singleUnitDetailId_idx" ON "maintenance_requests"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "maintenance_requests_equipmentId_idx" ON "maintenance_requests"("equipmentId");

-- CreateIndex
CREATE INDEX "maintenance_requests_tenantId_idx" ON "maintenance_requests"("tenantId");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_priority_idx" ON "maintenance_requests"("priority");

-- CreateIndex
CREATE INDEX "maintenance_requests_requestedAt_idx" ON "maintenance_requests"("requestedAt");

-- CreateIndex
CREATE INDEX "maintenance_photos_requestId_idx" ON "maintenance_photos"("requestId");

-- CreateIndex
CREATE INDEX "maintenance_assignments_requestId_idx" ON "maintenance_assignments"("requestId");

-- CreateIndex
CREATE INDEX "maintenance_assignments_serviceProviderId_idx" ON "maintenance_assignments"("serviceProviderId");

-- CreateIndex
CREATE INDEX "maintenance_assignments_assignedToUserId_idx" ON "maintenance_assignments"("assignedToUserId");

-- CreateIndex
CREATE INDEX "maintenance_assignments_status_idx" ON "maintenance_assignments"("status");

-- CreateIndex
CREATE INDEX "maintenance_materials_requestId_idx" ON "maintenance_materials"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_propertyId_key" ON "amenities"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_unitId_key" ON "amenities"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_singleUnitDetailId_key" ON "amenities"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "amenities_propertyId_idx" ON "amenities"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "property_leasing_propertyId_key" ON "property_leasing"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "property_leasing_unitId_key" ON "property_leasing"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "property_leasing_singleUnitDetailId_key" ON "property_leasing"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "property_leasing_propertyId_idx" ON "property_leasing"("propertyId");

-- CreateIndex
CREATE INDEX "property_leasing_unitId_idx" ON "property_leasing"("unitId");

-- CreateIndex
CREATE INDEX "property_leasing_singleUnitDetailId_idx" ON "property_leasing"("singleUnitDetailId");

-- CreateIndex
CREATE INDEX "listings_propertyId_idx" ON "listings"("propertyId");

-- CreateIndex
CREATE INDEX "listings_unitId_idx" ON "listings"("unitId");

-- CreateIndex
CREATE INDEX "listings_listingStatus_idx" ON "listings"("listingStatus");

-- CreateIndex
CREATE INDEX "listings_occupancyStatus_idx" ON "listings"("occupancyStatus");

-- CreateIndex
CREATE INDEX "applications_leasingId_idx" ON "applications"("leasingId");

-- CreateIndex
CREATE INDEX "applications_invitedById_idx" ON "applications"("invitedById");

-- CreateIndex
CREATE INDEX "applications_tenantId_idx" ON "applications"("tenantId");

-- CreateIndex
CREATE INDEX "applicants_applicationId_idx" ON "applicants"("applicationId");

-- CreateIndex
CREATE INDEX "occupants_applicationId_idx" ON "occupants"("applicationId");

-- CreateIndex
CREATE INDEX "pets_applicationId_idx" ON "pets"("applicationId");

-- CreateIndex
CREATE INDEX "vehicles_applicationId_idx" ON "vehicles"("applicationId");

-- CreateIndex
CREATE INDEX "residence_history_applicationId_idx" ON "residence_history"("applicationId");

-- CreateIndex
CREATE INDEX "income_details_applicationId_idx" ON "income_details"("applicationId");

-- CreateIndex
CREATE INDEX "emergency_contacts_applicationId_idx" ON "emergency_contacts"("applicationId");

-- CreateIndex
CREATE INDEX "reference_contacts_applicationId_idx" ON "reference_contacts"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "background_questions_applicationId_key" ON "background_questions"("applicationId");

-- AddForeignKey
ALTER TABLE "TenantAuthIdentity" ADD CONSTRAINT "TenantAuthIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuthIdentity" ADD CONSTRAINT "UserAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_attachments" ADD CONSTRAINT "property_attachments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_unit_details" ADD CONSTRAINT "single_unit_details_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_singleUnitDetailId_fkey" FOREIGN KEY ("singleUnitDetailId") REFERENCES "single_unit_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keys" ADD CONSTRAINT "keys_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keys" ADD CONSTRAINT "keys_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keys" ADD CONSTRAINT "keys_singleUnitDetailId_fkey" FOREIGN KEY ("singleUnitDetailId") REFERENCES "single_unit_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_singleUnitDetailId_fkey" FOREIGN KEY ("singleUnitDetailId") REFERENCES "single_unit_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TransactionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyManagerId_fkey" FOREIGN KEY ("propertyManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "TransactionSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_singleUnitDetailId_fkey" FOREIGN KEY ("singleUnitDetailId") REFERENCES "single_unit_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_photos" ADD CONSTRAINT "maintenance_photos_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_assignments" ADD CONSTRAINT "maintenance_assignments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_assignments" ADD CONSTRAINT "maintenance_assignments_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_assignments" ADD CONSTRAINT "maintenance_assignments_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_materials" ADD CONSTRAINT "maintenance_materials_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_singleUnitDetailId_fkey" FOREIGN KEY ("singleUnitDetailId") REFERENCES "single_unit_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_leasing" ADD CONSTRAINT "property_leasing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_leasing" ADD CONSTRAINT "property_leasing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_leasing" ADD CONSTRAINT "property_leasing_singleUnitDetailId_fkey" FOREIGN KEY ("singleUnitDetailId") REFERENCES "single_unit_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_currentTenantId_fkey" FOREIGN KEY ("currentTenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_leasingId_fkey" FOREIGN KEY ("leasingId") REFERENCES "property_leasing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupants" ADD CONSTRAINT "occupants_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residence_history" ADD CONSTRAINT "residence_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_details" ADD CONSTRAINT "income_details_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_contacts" ADD CONSTRAINT "reference_contacts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_questions" ADD CONSTRAINT "background_questions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

