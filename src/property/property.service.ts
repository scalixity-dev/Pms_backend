import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  leasing: true,
} as const;

@Injectable()
export class PropertyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPropertyDto: CreatePropertyDto, userId: string) {
    // Use the authenticated user's ID as managerId
    // Ignore managerId from DTO if provided (security: users can only create properties for themselves)
    const managerId = userId;

    // Verify that the manager exists
    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
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

    // Create units if provided (for MULTI properties)
    if (createPropertyDto.units?.length) {
      for (const unit of createPropertyDto.units) {
        const createdUnit = await this.prisma.unit.create({
          data: {
            propertyId: property.id,
            unitName: unit.unitName,
            apartmentType: unit.apartmentType,
            sizeSqft: unit.sizeSqft ? new Decimal(unit.sizeSqft) : null,
            beds: unit.beds,
            baths: unit.baths ? new Decimal(unit.baths) : null,
            rent: unit.rent ? new Decimal(unit.rent) : null,
          },
        });

        const unitAmenitiesData = this.buildAmenitiesData(unit.amenities, {
          unitId: createdUnit.id,
        });

        if (unitAmenitiesData) {
          await this.prisma.amenities.create({
            data: unitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
          });
        }
      }
    }

    // Create single unit details if provided (for SINGLE properties)
    if (createPropertyDto.singleUnitDetails) {
      const singleUnitDetails = await this.prisma.singleUnitDetail.create({
        data: {
          propertyId: property.id,
          beds: createPropertyDto.singleUnitDetails.beds,
          baths: createPropertyDto.singleUnitDetails.baths
            ? new Decimal(createPropertyDto.singleUnitDetails.baths)
            : null,
          marketRent: createPropertyDto.singleUnitDetails.marketRent
            ? new Decimal(createPropertyDto.singleUnitDetails.marketRent)
            : null,
          deposit: createPropertyDto.singleUnitDetails.deposit
            ? new Decimal(createPropertyDto.singleUnitDetails.deposit)
            : null,
        },
      });

      const singleUnitAmenitiesData = this.buildAmenitiesData(
        createPropertyDto.singleUnitDetails.amenities,
        {
          singleUnitDetailId: singleUnitDetails.id,
        },
      );

      if (singleUnitAmenitiesData) {
        await this.prisma.amenities.create({
          data: singleUnitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
        });
      }
    }

    // Return property with all related data
    return this.findOne(property.id, managerId);
  }

  async findAll(userId: string) {
    const properties = await this.prisma.property.findMany({
      where: {
        managerId: userId,
      },
      include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return properties;
  }

  async findOne(id: string, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Ensure the property belongs to the authenticated user
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

    // Handle address update - create or update address if provided
    if (updateData.address) {
      const existingAddress = await this.prisma.address.findUnique({
        where: { propertyId: id },
      });

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
      const existingAmenities = await this.prisma.amenities.findUnique({
        where: { propertyId: id },
      });

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

      // Then, create or update photos
      for (const photo of updateData.photos) {
        // Check if photo with this URL already exists
        const existingPhoto = await this.prisma.propertyPhoto.findFirst({
          where: {
            propertyId: id,
            photoUrl: photo.photoUrl,
          },
        });

        if (existingPhoto) {
          // Update existing photo
          await this.prisma.propertyPhoto.update({
            where: { id: existingPhoto.id },
            data: { isPrimary: photo.isPrimary || false },
          });
        } else {
          // Create new photo
          await this.prisma.propertyPhoto.create({
            data: {
              propertyId: id,
              photoUrl: photo.photoUrl,
              isPrimary: photo.isPrimary || false,
            },
          });
        }
      }
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

    // Return property with all related data
    return this.findOne(id, userId);
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

