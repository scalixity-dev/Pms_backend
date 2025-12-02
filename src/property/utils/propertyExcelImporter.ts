import * as XLSX from 'xlsx';

// ===== Types that mirror your backend DTO (no schema changes) =====

export type PropertyType = 'SINGLE' | 'MULTI';
export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type RibbonType = 'NONE' | 'CHAT' | 'CUSTOM';
export type ParkingType = 'NONE' | 'STREET' | 'GARAGE' | 'DRIVEWAY' | 'ASSIGNED';
export type LaundryType = 'NONE' | 'IN_UNIT' | 'ON_SITE' | 'HOOKUPS';
export type AirConditioningType = 'NONE' | 'CENTRAL' | 'WINDOW' | 'PORTABLE';
export type FileType = 'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'IMAGE' | 'OTHER';

export interface CreateAmenitiesDto {
  parking: ParkingType;
  laundry: LaundryType;
  airConditioning: AirConditioningType;
  propertyFeatures?: string[];
  propertyAmenities?: string[];
}

export interface CreatePropertyPhotoDto {
  photoUrl: string;
  isPrimary?: boolean;
}

export interface CreatePropertyAttachmentDto {
  fileUrl: string;
  fileType: FileType;
  description?: string;
}

export interface CreateUnitDto {
  unitName: string;
  apartmentType?: string;
  sizeSqft?: number;
  beds?: number;
  baths?: number;
  rent?: number;
  amenities?: CreateAmenitiesDto;
}

export interface CreateSingleUnitDetailDto {
  beds?: number;
  baths?: number;
  marketRent?: number;
  deposit?: number;
  amenities?: CreateAmenitiesDto;
}

export interface CreateAddressDto {
  streetAddress: string;
  city: string;
  stateRegion: string;
  zipCode: string;
  country: string;
}

export interface CreatePropertyRequest {
  managerId?: string;
  propertyName: string;
  yearBuilt?: number;
  mlsNumber?: string;
  propertyType: PropertyType;
  sizeSqft?: number;
  marketRent?: number;
  depositAmount?: number;
  address?: CreateAddressDto;
  description?: string;
  coverPhotoUrl?: string;
  youtubeUrl?: string;
  ribbonType?: RibbonType;
  ribbonTitle?: string;
  listingContactName?: string;
  listingPhoneCountryCode?: string;
  listingPhoneNumber?: string;
  listingEmail?: string;
  displayPhonePublicly?: boolean;
  status?: PropertyStatus;
  amenities?: CreateAmenitiesDto;
  photos?: CreatePropertyPhotoDto[];
  attachments?: CreatePropertyAttachmentDto[];
  units?: CreateUnitDto[];
  singleUnitDetails?: CreateSingleUnitDetailDto;
}

// ===== Excel row shape (headers must match your Excel template) =====

interface ExcelRow {
  // Core property fields
  'Property Name': string;
  'Year Built'?: number | string;
  'MLS Number'?: string;
  'Property Type': string; // SINGLE or MULTI
  'Size Sqft'?: number | string;
  'Market Rent'?: number | string;
  'Deposit Amount'?: number | string;
  Description?: string;

  // Address
  'Street Address'?: string;
  City?: string;
  State?: string;
  'Zip Code'?: string;
  Country?: string;

  // Media
  'Cover Photo URL'?: string;
  'YouTube URL'?: string;

  // Ribbon
  'Ribbon Type'?: string;
  'Ribbon Title'?: string;

  // Listing contact
  'Listing Contact Name'?: string;
  'Listing Phone Country Code'?: string;
  'Listing Phone Number'?: string;
  'Listing Email'?: string;
  'Display Phone Publicly'?: string;

  // Status
  Status?: string;

  // Amenities
  'Parking Type'?: string;
  'Laundry Type'?: string;
  'Air Conditioning Type'?: string;
  'Property Features'?: string;   // comma separated
  'Property Amenities'?: string;  // comma separated

  // Photos / attachments
  'Photo URLs'?: string;              // comma separated URLs
  'Primary Photo URL'?: string;       // single URL
  'Attachment URLs'?: string;         // comma separated
  'Attachment File Types'?: string;   // comma separated
  'Attachment Descriptions'?: string; // comma separated

  // SINGLE-unit detail fields
  'Single Beds'?: number | string;
  'Single Baths'?: number | string;
  'Single Market Rent'?: number | string;
  'Single Deposit'?: number | string;

  // Optional helper column to limit number of units
  'Number of Units'?: number | string;

  // Dynamic unit columns - "Unit <n> Name", "Unit <n> Beds", etc.
  [key: string]: string | number | undefined;
}

// ===== Helpers =====

function parseNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isNaN(num) ? undefined : num;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === 'yes' || normalized === 'y') return true;
  if (normalized === 'false' || normalized === 'no' || normalized === 'n') return false;
  return undefined;
}

function splitCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : undefined;
}

// ===== Mapping one Excel row -> CreatePropertyRequest =====

function mapExcelRowToPayload(row: ExcelRow): CreatePropertyRequest {
  const propertyType = row['Property Type'].trim().toUpperCase() as PropertyType;

  const addressAvailable =
    row['Street Address'] ||
    row.City ||
    row.State ||
    row['Zip Code'] ||
    row.Country;

  const amenitiesBase: CreateAmenitiesDto | undefined =
    row['Parking Type'] ||
    row['Laundry Type'] ||
    row['Air Conditioning Type'] ||
    row['Property Features'] ||
    row['Property Amenities']
      ? {
          parking: (row['Parking Type']?.trim().toUpperCase() as ParkingType) || 'NONE',
          laundry: (row['Laundry Type']?.trim().toUpperCase() as LaundryType) || 'NONE',
          airConditioning:
            (row['Air Conditioning Type']?.trim().toUpperCase() as AirConditioningType) || 'NONE',
          propertyFeatures: splitCsv(row['Property Features']),
          propertyAmenities: splitCsv(row['Property Amenities']),
        }
      : undefined;

  const photos: CreatePropertyPhotoDto[] = [];
  const photoUrls = splitCsv(row['Photo URLs']);
  if (photoUrls) {
    for (const url of photoUrls) {
      photos.push({ photoUrl: url, isPrimary: false });
    }
  }
  if (row['Primary Photo URL']) {
    photos.unshift({
      photoUrl: row['Primary Photo URL'],
      isPrimary: true,
    });
  }

  const attachmentUrls = splitCsv(row['Attachment URLs']) ?? [];
  const attachmentTypes = splitCsv(row['Attachment File Types']) ?? [];
  const attachmentDescriptions = splitCsv(row['Attachment Descriptions']) ?? [];
  const attachments: CreatePropertyAttachmentDto[] = attachmentUrls.map((url, index) => {
    const type =
      (attachmentTypes[index]?.toUpperCase() as FileType) ?? 'OTHER';
    const description = attachmentDescriptions[index];
    return {
      fileUrl: url,
      fileType: type,
      description,
    };
  });

  let singleUnitDetails: CreateSingleUnitDetailDto | undefined;
  let units: CreateUnitDto[] | undefined;

  if (propertyType === 'SINGLE') {
    const hasSingleFields =
      row['Single Beds'] ||
      row['Single Baths'] ||
      row['Single Market Rent'] ||
      row['Single Deposit'] ||
      amenitiesBase;

    if (hasSingleFields) {
      singleUnitDetails = {
        beds: parseNumber(row['Single Beds']),
        baths: parseNumber(row['Single Baths']),
        marketRent: parseNumber(row['Single Market Rent']),
        deposit: parseNumber(row['Single Deposit']),
        amenities: amenitiesBase,
      };
    }
  } else if (propertyType === 'MULTI') {
    const unitList: CreateUnitDto[] = [];

    // Optional: explicit "Number of Units" column to cap indexes
    const explicitCountRaw = row['Number of Units'];
    const explicitCount =
      typeof explicitCountRaw === 'string' || typeof explicitCountRaw === 'number'
        ? parseNumber(explicitCountRaw)
        : undefined;
    const explicitMaxIndex = explicitCount && explicitCount > 0 ? explicitCount : undefined;

    // Discover all indexes from keys like "Unit <n> Name"
    const unitNamePrefix = 'Unit ';
    const nameSuffix = ' Name';
    const indexesSet: Set<number> = new Set();

    Object.keys(row).forEach((key) => {
      if (key.startsWith(unitNamePrefix) && key.endsWith(nameSuffix)) {
        const middle = key
          .slice(unitNamePrefix.length, key.length - nameSuffix.length)
          .trim();
        const indexNumber = Number(middle);
        if (!Number.isNaN(indexNumber) && indexNumber > 0) {
          if (!explicitMaxIndex || indexNumber <= explicitMaxIndex) {
            indexesSet.add(indexNumber);
          }
        }
      }
    });

    const sortedIndexes = Array.from(indexesSet).sort((a, b) => a - b);

    sortedIndexes.forEach((indexValue) => {
      const nameKey = `Unit ${indexValue} Name`;
      const aptTypeKey = `Unit ${indexValue} Apartment Type`;
      const sizeKey = `Unit ${indexValue} Size Sqft`;
      const bedsKey = `Unit ${indexValue} Beds`;
      const bathsKey = `Unit ${indexValue} Baths`;
      const rentKey = `Unit ${indexValue} Rent`;

      const nameValue = row[nameKey];

      if (typeof nameValue !== 'string' || nameValue.trim().length === 0) {
        return;
      }

      const sizeValue = row[sizeKey];
      const bedsValue = row[bedsKey];
      const bathsValue = row[bathsKey];
      const rentValue = row[rentKey];

      unitList.push({
        unitName: nameValue,
        apartmentType: typeof row[aptTypeKey] === 'string' ? row[aptTypeKey] : undefined,
        sizeSqft:
          typeof sizeValue === 'string' || typeof sizeValue === 'number'
            ? parseNumber(sizeValue)
            : undefined,
        beds:
          typeof bedsValue === 'string' || typeof bedsValue === 'number'
            ? parseNumber(bedsValue)
            : undefined,
        baths:
          typeof bathsValue === 'string' || typeof bathsValue === 'number'
            ? parseNumber(bathsValue)
            : undefined,
        rent:
          typeof rentValue === 'string' || typeof rentValue === 'number'
            ? parseNumber(rentValue)
            : undefined,
        amenities: amenitiesBase,
      });
    });

    if (unitList.length > 0) {
      units = unitList;
    }
  }

  return {
    // managerId is usually filled from auth; omit here by default
    propertyName: row['Property Name']?.trim(),
    yearBuilt: parseNumber(row['Year Built']),
    mlsNumber: row['MLS Number'],
    propertyType,
    sizeSqft: parseNumber(row['Size Sqft']),
    marketRent: parseNumber(row['Market Rent']),
    depositAmount: parseNumber(row['Deposit Amount']),

    address: addressAvailable
      ? {
          streetAddress: row['Street Address'] ?? '',
          city: row.City ?? '',
          stateRegion: row.State ?? '',
          zipCode: row['Zip Code'] ?? '',
          country: row.Country ?? '',
        }
      : undefined,

    description: row.Description,
    coverPhotoUrl: row['Cover Photo URL'],
    youtubeUrl: row['YouTube URL'],
    ribbonType: row['Ribbon Type']
      ? (row['Ribbon Type'].trim().toUpperCase() as RibbonType)
      : undefined,
    ribbonTitle: row['Ribbon Title'],

    listingContactName: row['Listing Contact Name'],
    listingPhoneCountryCode: row['Listing Phone Country Code'],
    listingPhoneNumber: row['Listing Phone Number'],
    listingEmail: row['Listing Email'],
    displayPhonePublicly: parseBoolean(row['Display Phone Publicly']),

    status: row.Status ? (row.Status.trim().toUpperCase() as PropertyStatus) : undefined,

    amenities: amenitiesBase,
    photos: photos.length > 0 ? photos : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    units,
    singleUnitDetails,
  };
}

// ===== Public API: parse Excel buffer into property payloads =====

export type ExcelBufferInput = ArrayBuffer | Uint8Array | Buffer;

function toUint8Array(input: ExcelBufferInput): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (typeof Buffer !== 'undefined' && input instanceof Buffer) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input);
}

/**
 * Parse an Excel file buffer into an array of CreatePropertyRequest objects.
 * You can pass:
 *  - Multer file buffer (Node): file.buffer
 *  - fs.readFile buffer (Node)
 *  - ArrayBuffer / Uint8Array (browser or Node)
 */
export function parsePropertyExcelBuffer(
  buffer: ExcelBufferInput
): CreatePropertyRequest[] {
  const data = toUint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet, {
    defval: '',
  });

  return rows.map(mapExcelRowToPayload);
}