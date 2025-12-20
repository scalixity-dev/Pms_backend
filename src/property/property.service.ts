import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CacheWarmingService } from '../redis/cache-warming.service';
import { Prisma } from '@prisma/client';
import { CreateAmenitiesDto, CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Decimal } from '@prisma/client/runtime/library';

type AmenitiesDataInput = {
  parking: CreateAmenitiesDto['parking'];
  laundry: CreateAmenitiesDto['laundry'];
  airConditioning: CreateAmenitiesDto['airConditioning'];
  propertyFeatures?: string[];
  propertyAmenities?: string[];
  propertyId?: string;
  unitId?: string;
  singleUnitDetailId?: string;
};

// Lightweight include for list view (without heavy relations)
const propertyListInclude = {
  manager: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  address: true,
  amenities: true,
  photos: {
    select: {
      id: true,
      photoUrl: true,
      isPrimary: true,
    },
    take: 1, // Only get first photo for list view
  },
  singleUnitDetails: {
    select: {
      beds: true,
      baths: true,
    },
  },
  leasing: {
    select: {
      id: true,
      monthlyRent: true,
      securityDeposit: true,
      amountRefundable: true,
      dateAvailable: true,
      minLeaseDuration: true,
      maxLeaseDuration: true,
      description: true,
      petsAllowed: true,
      petCategory: true,
      petDeposit: true,
      petFee: true,
      petDescription: true,
      onlineRentalApplication: true,
      requireApplicationFee: true,
      applicationFee: true,
    },
  },
} as const;

// Full include with all relations (for detail view)
const propertyRelationsInclude = {
  manager: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  address: true,
  amenities: true,
  photos: true,
  attachments: true,
  units: {
    include: {
      amenities: true,
    },
  },
  singleUnitDetails: {
    include: {
      amenities: true,
    },
  },
  leasing: {
    include: {
      unit: {
        include: {
          amenities: true,
        },
      },
      singleUnitDetail: {
        include: {
          amenities: true,
        },
      },
    },
  },
  listings: {
    select: {
      id: true,
      listingStatus: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
} as const;

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly cacheWarming: CacheWarmingService,
  ) {}

  async create(createPropertyDto: CreatePropertyDto, userId: string) {
    // Use the authenticated user's ID as managerId
    // Ignore managerId from DTO if provided (security: users can only create properties for themselves)
    const managerId = userId;

    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true },
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Validate property type consistency
    if (createPropertyDto.propertyType === 'SINGLE' && createPropertyDto.units?.length) {
      throw new BadRequestException('SINGLE property type cannot have units');
    }

    if (createPropertyDto.propertyType === 'MULTI' && createPropertyDto.singleUnitDetails) {
      throw new BadRequestException('MULTI property type cannot have single unit details');
    }

    // Create the property
    const property = await this.prisma.property.create({
      data: {
        managerId: managerId,
        propertyName: createPropertyDto.propertyName,
        yearBuilt: createPropertyDto.yearBuilt,
        mlsNumber: createPropertyDto.mlsNumber || null,
        propertyType: createPropertyDto.propertyType,
        sizeSqft:
          createPropertyDto.sizeSqft !== undefined && createPropertyDto.sizeSqft !== null
            ? new Decimal(createPropertyDto.sizeSqft)
            : null,
        marketRent:
          createPropertyDto.marketRent !== undefined && createPropertyDto.marketRent !== null
            ? new Decimal(createPropertyDto.marketRent)
            : null,
        depositAmount:
          createPropertyDto.depositAmount !== undefined && createPropertyDto.depositAmount !== null
            ? new Decimal(createPropertyDto.depositAmount)
            : null,
        description: createPropertyDto.description,
        coverPhotoUrl: createPropertyDto.coverPhotoUrl || null,
        youtubeUrl: createPropertyDto.youtubeUrl || null,
        ribbonType: createPropertyDto.ribbonType || 'NONE',
        ribbonTitle: createPropertyDto.ribbonTitle || null,
        listingContactName: createPropertyDto.listingContactName || null,
        listingPhoneCountryCode: createPropertyDto.listingPhoneCountryCode || null,
        listingPhoneNumber: createPropertyDto.listingPhoneNumber || null,
        listingEmail: createPropertyDto.listingEmail || null,
        displayPhonePublicly: createPropertyDto.displayPhonePublicly ?? false,
        status: 'INACTIVE', // New properties are always created with INACTIVE status
        // Create address if provided using nested create
        ...(createPropertyDto.address && {
          address: {
            create: {
              streetAddress: createPropertyDto.address.streetAddress,
              city: createPropertyDto.address.city,
              stateRegion: createPropertyDto.address.stateRegion,
              zipCode: createPropertyDto.address.zipCode,
              country: createPropertyDto.address.country,
            },
          },
        }),
      },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        address: true,
      },
    });

    // Create property amenities if provided
    if (createPropertyDto.amenities) {
      const propertyAmenitiesData = this.buildAmenitiesData(createPropertyDto.amenities, {
        propertyId: property.id,
      });

      if (propertyAmenitiesData) {
        await this.prisma.amenities.create({
          data: propertyAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
        });
      }
    }

    // Create photos if provided
    if (createPropertyDto.photos?.length) {
      await this.prisma.propertyPhoto.createMany({
        data: createPropertyDto.photos.map((photo) => ({
          propertyId: property.id,
          photoUrl: photo.photoUrl,
          isPrimary: photo.isPrimary || false,
        })),
      });
    }

    // Create attachments if provided
    if (createPropertyDto.attachments?.length) {
      await this.prisma.propertyAttachment.createMany({
        data: createPropertyDto.attachments.map((attachment) => ({
          propertyId: property.id,
          fileUrl: attachment.fileUrl,
          fileType: attachment.fileType,
          description: attachment.description,
        })),
      });
    }

    if (createPropertyDto.units?.length) {
      const units = createPropertyDto.units;
      await this.prisma.$transaction(async (tx) => {
        const unitsData = units.map((unit) => ({
            propertyId: property.id,
            unitName: unit.unitName,
            apartmentType: unit.apartmentType,
            sizeSqft: unit.sizeSqft ? new Decimal(unit.sizeSqft) : null,
            beds: unit.beds,
            baths: unit.baths ? new Decimal(unit.baths) : null,
            rent: unit.rent ? new Decimal(unit.rent) : null,
        }));

        const createdUnits = await tx.unit.createManyAndReturn({
          data: unitsData,
        });

        const amenitiesData = createdUnits
          .map((createdUnit, index) => {
            const unitAmenitiesData = this.buildAmenitiesData(
              units[index].amenities,
              { unitId: createdUnit.id },
            );
            return unitAmenitiesData
              ? ({ ...unitAmenitiesData, unitId: createdUnit.id } as Prisma.AmenitiesCreateInput)
              : null;
          })
          .filter((data): data is Prisma.AmenitiesCreateInput => data !== null);

        if (amenitiesData.length > 0) {
          await tx.amenities.createMany({
            data: amenitiesData as Prisma.AmenitiesCreateManyInput[],
          });
        }
      });
    }

    if (createPropertyDto.singleUnitDetails) {
      const singleUnitDetailsDto = createPropertyDto.singleUnitDetails;
      await this.prisma.$transaction(async (tx) => {
        const singleUnitDetails = await tx.singleUnitDetail.create({
        data: {
          propertyId: property.id,
            beds: singleUnitDetailsDto.beds,
            baths: singleUnitDetailsDto.baths
              ? new Decimal(singleUnitDetailsDto.baths)
            : null,
            marketRent: singleUnitDetailsDto.marketRent
              ? new Decimal(singleUnitDetailsDto.marketRent)
            : null,
            deposit: singleUnitDetailsDto.deposit
              ? new Decimal(singleUnitDetailsDto.deposit)
            : null,
        },
      });

      const singleUnitAmenitiesData = this.buildAmenitiesData(
          singleUnitDetailsDto.amenities,
          { singleUnitDetailId: singleUnitDetails.id },
      );

      if (singleUnitAmenitiesData) {
          await tx.amenities.create({
          data: singleUnitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
        });
      }
      });
    }

    await this.cache.invalidateProperty(managerId, property.id);
    
    const freshProperty = await this.prisma.property.findUnique({
      where: { id: property.id },
      include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
    });

    if (freshProperty) {
      const cacheKey = this.cache.propertyDetailKey(property.id);
      await this.cache.set(cacheKey, freshProperty, this.cache.getTTL('PROPERTY_DETAIL'));
    }

    setImmediate(() => {
      this.cacheWarming.warmUserCache(managerId).catch(() => {});
    });

    return freshProperty!;
  }

  async findAll(userId: string, includeListings: boolean = false) {
    const cacheKey = this.cache.propertyListKey(userId, includeListings);
    const ttl = this.cache.getTTL('PROPERTY_LIST');

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const include = includeListings
          ? propertyRelationsInclude
          : propertyListInclude;

        const properties = await this.prisma.property.findMany({
          where: {
            managerId: userId,
          },
          include: include as unknown as Prisma.PropertyInclude,
          orderBy: {
            createdAt: 'desc',
          },
        });

        return properties;
      },
      ttl,
    );
  }

  async findOne(id: string, userId: string) {
    const cacheKey = this.cache.propertyDetailKey(id);
    const ttl = this.cache.getTTL('PROPERTY_DETAIL');

    const property = await this.cache.getOrSet(
      cacheKey,
      async () => {
        const property = await this.prisma.property.findUnique({
          where: { id },
          include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
        });

        if (!property) {
          throw new NotFoundException(`Property with ID ${id} not found`);
        }

        return property;
      },
      ttl,
    );

    if (property.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this property');
    }

    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto, userId: string) {
    // Verify that the property exists
    const existingProperty = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!existingProperty) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Ensure the property belongs to the authenticated user
    if (existingProperty.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to update this property');
    }

    // Prevent users from changing the managerId (users can only manage their own properties)
    // Remove managerId from update if provided
    const { managerId, ...updateData } = updatePropertyDto;

    // Handle address and amenities updates in parallel for better performance
    const [existingAddress, existingAmenities] = await Promise.all([
      updateData.address
        ? this.prisma.address.findUnique({
            where: { propertyId: id },
          })
        : Promise.resolve(null),
      updateData.amenities
        ? this.prisma.amenities.findUnique({
            where: { propertyId: id },
          })
        : Promise.resolve(null),
    ]);

    // Process address update if provided
    if (updateData.address) {
      if (existingAddress) {
        await this.prisma.address.update({
          where: { id: existingAddress.id },
          data: {
            streetAddress: updateData.address.streetAddress,
            city: updateData.address.city,
            stateRegion: updateData.address.stateRegion,
            zipCode: updateData.address.zipCode,
            country: updateData.address.country,
          },
        });
      } else {
        await this.prisma.address.create({
          data: {
            propertyId: id,
            streetAddress: updateData.address.streetAddress,
            city: updateData.address.city,
            stateRegion: updateData.address.stateRegion,
            zipCode: updateData.address.zipCode,
            country: updateData.address.country,
          },
        });
      }
    }

    // Handle amenities update if provided
    if (updateData.amenities) {
      const amenitiesData = this.buildAmenitiesData(updateData.amenities, {
        propertyId: id,
      });

      if (existingAmenities) {
        // Update existing amenities
        await this.prisma.amenities.update({
          where: { id: existingAmenities.id },
          data: amenitiesData as unknown as Prisma.AmenitiesUpdateInput,
        });
      } else {
        // Create new amenities if they don't exist
        if (amenitiesData) {
          await this.prisma.amenities.create({
            data: amenitiesData as unknown as Prisma.AmenitiesCreateInput,
          });
        }
      }
    }

    // Handle photos update if provided
    if (updateData.photos?.length) {
      // First, set all existing photos to not primary
      await this.prisma.propertyPhoto.updateMany({
        where: { propertyId: id },
        data: { isPrimary: false },
      });

      // Batch check all existing photos in parallel
      const photoUrls = updateData.photos.map(photo => photo.photoUrl);
      const existingPhotos = await this.prisma.propertyPhoto.findMany({
        where: {
          propertyId: id,
          photoUrl: { in: photoUrls },
        },
      });

      // Create a map for quick lookup
      const existingPhotosMap = new Map(
        existingPhotos.map(photo => [photo.photoUrl, photo])
      );

      // Batch create/update operations
      const photoOperations = updateData.photos.map(photo => {
        const existingPhoto = existingPhotosMap.get(photo.photoUrl);
        if (existingPhoto) {
          // Update existing photo
          return this.prisma.propertyPhoto.update({
            where: { id: existingPhoto.id },
            data: { isPrimary: photo.isPrimary || false },
          });
        } else {
          // Create new photo
          return this.prisma.propertyPhoto.create({
            data: {
              propertyId: id,
              photoUrl: photo.photoUrl,
              isPrimary: photo.isPrimary || false,
            },
          });
        }
      });

      await Promise.all(photoOperations);
    }

    // Update the property
    const updatedProperty = await this.prisma.property.update({
      where: { id },
      data: {
        // managerId is not updated - users can only manage their own properties
        ...(updateData.propertyName && { propertyName: updateData.propertyName }),
        ...(updateData.yearBuilt !== undefined && { yearBuilt: updateData.yearBuilt }),
        ...(updateData.mlsNumber !== undefined && { mlsNumber: updateData.mlsNumber }),
        ...(updateData.propertyType && { propertyType: updateData.propertyType }),
        ...(updateData.sizeSqft !== undefined && {
          sizeSqft:
            updateData.sizeSqft !== null
              ? new Decimal(updateData.sizeSqft)
              : null,
        }),
        ...(updateData.marketRent !== undefined && {
          marketRent:
            updateData.marketRent !== null
              ? new Decimal(updateData.marketRent)
              : null,
        }),
        ...(updateData.depositAmount !== undefined && {
          depositAmount:
            updateData.depositAmount !== null
              ? new Decimal(updateData.depositAmount)
              : null,
        }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.coverPhotoUrl !== undefined && { coverPhotoUrl: updateData.coverPhotoUrl }),
        ...(updateData.youtubeUrl !== undefined && { youtubeUrl: updateData.youtubeUrl || null }),
        ...(updateData.ribbonType !== undefined && { ribbonType: updateData.ribbonType }),
        ...(updateData.ribbonTitle !== undefined && { ribbonTitle: updateData.ribbonTitle || null }),
        ...(updateData.listingContactName !== undefined && { listingContactName: updateData.listingContactName || null }),
        ...(updateData.listingPhoneCountryCode !== undefined && { listingPhoneCountryCode: updateData.listingPhoneCountryCode || null }),
        ...(updateData.listingPhoneNumber !== undefined && { listingPhoneNumber: updateData.listingPhoneNumber || null }),
        ...(updateData.listingEmail !== undefined && { listingEmail: updateData.listingEmail || null }),
        ...(updateData.displayPhonePublicly !== undefined && { displayPhonePublicly: updateData.displayPhonePublicly }),
        ...(updateData.status !== undefined && { status: updateData.status }),
      },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        address: true,
      },
    });

    await this.cache.invalidateProperty(userId, id);
    
    const freshProperty = await this.prisma.property.findUnique({
      where: { id },
      include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
    });

    if (!freshProperty) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    if (freshProperty.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this property');
    }

    const cacheKey = this.cache.propertyDetailKey(id);
    await this.cache.set(cacheKey, freshProperty, this.cache.getTTL('PROPERTY_DETAIL'));

    setImmediate(() => {
      this.cacheWarming.warmUserCache(userId).catch(() => {});
    });

    return freshProperty;
  }

  async remove(id: string, userId: string) {
    // Verify that the property exists
    const existingProperty = await this.prisma.property.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        address: true,
      },
    });

    if (!existingProperty) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Ensure the property belongs to the authenticated user
    if (existingProperty.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this property');
    }

    // Hard delete the property from the database
    await this.prisma.property.delete({
      where: { id },
    });

    return {
      message: 'Property deleted successfully',
      property: existingProperty,
    };
  }

  private buildAmenitiesData(
    amenities?: CreateAmenitiesDto,
    options?: {
      propertyId?: string;
      unitId?: string;
      singleUnitDetailId?: string;
    },
  ) {
    if (!amenities) {
      return undefined;
    }

    const data: AmenitiesDataInput = {
      parking: amenities.parking,
      laundry: amenities.laundry,
      airConditioning: amenities.airConditioning,
    };

    if (amenities.propertyFeatures !== undefined) {
      data.propertyFeatures = amenities.propertyFeatures;
    }

    if (amenities.propertyAmenities !== undefined) {
      data.propertyAmenities = amenities.propertyAmenities;
    }

    if (options?.propertyId) {
      data.propertyId = options.propertyId;
    }

    if (options?.unitId) {
      data.unitId = options.unitId;
    }

    if (options?.singleUnitDetailId) {
      data.singleUnitDetailId = options.singleUnitDetailId;
    }

    return data;
  }
}

