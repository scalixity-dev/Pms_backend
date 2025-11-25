import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async create(createPropertyDto: CreatePropertyDto) {
    // Verify that the manager exists
    const manager = await this.prisma.user.findUnique({
      where: { id: createPropertyDto.managerId },
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${createPropertyDto.managerId} not found`);
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
        managerId: createPropertyDto.managerId,
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
    const propertyAmenitiesData = this.buildAmenitiesData(createPropertyDto.amenities);
    if (propertyAmenitiesData) {
      await this.prisma.amenities.create({
        data: {
          ...propertyAmenitiesData,
          propertyId: property.id,
        } as unknown as Prisma.AmenitiesCreateInput,
      });
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
        // Build unit amenities data if provided
        const unitAmenitiesData = this.buildAmenitiesData(unit.amenities);

        await this.prisma.unit.create({
          data: {
            propertyId: property.id,
            unitName: unit.unitName,
            apartmentType: unit.apartmentType,
            sizeSqft: unit.sizeSqft
              ? new Decimal(unit.sizeSqft)
              : null,
            beds: unit.beds,
            baths: unit.baths ? new Decimal(unit.baths) : null,
            rent: unit.rent ? new Decimal(unit.rent) : null,
            // Create unit amenities if provided using nested create
            ...(unitAmenitiesData && {
              amenities: {
                create: unitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
              },
            }),
          },
        });
      }
    }

    // Create single unit details if provided (for SINGLE properties)
    if (createPropertyDto.singleUnitDetails) {
      // Build single unit amenities data if provided
      const singleUnitAmenitiesData = this.buildAmenitiesData(
        createPropertyDto.singleUnitDetails.amenities,
      );

      await this.prisma.singleUnitDetail.create({
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
          // Create single unit amenities if provided using nested create
          ...(singleUnitAmenitiesData && {
            amenities: {
              create: singleUnitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
            },
          }),
        },
      });
    }

    // Return property with all related data
    return this.findOne(property.id);
  }

  async findAll() {
    const properties = await this.prisma.property. findMany({
      include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return properties;
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: propertyRelationsInclude as unknown as Prisma.PropertyInclude,
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    // Verify that the property exists
    const existingProperty = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!existingProperty) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // If managerId is being updated, verify that the manager exists
    if (updatePropertyDto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: updatePropertyDto.managerId },
      });

      if (!manager) {
        throw new NotFoundException(`Manager with ID ${updatePropertyDto.managerId} not found`);
      }
    }

    // Handle address update - use upsert to create or update address
    let addressUpdateData: any = undefined;
    if (updatePropertyDto.address) {
      addressUpdateData = {
        upsert: {
          create: {
            streetAddress: updatePropertyDto.address.streetAddress,
            city: updatePropertyDto.address.city,
            stateRegion: updatePropertyDto.address.stateRegion,
            zipCode: updatePropertyDto.address.zipCode,
            country: updatePropertyDto.address.country,
          },
          update: {
            streetAddress: updatePropertyDto.address.streetAddress,
            city: updatePropertyDto.address.city,
            stateRegion: updatePropertyDto.address.stateRegion,
            zipCode: updatePropertyDto.address.zipCode,
            country: updatePropertyDto.address.country,
          },
        },
      };
    }

    // Update the property
    const updatedProperty = await this.prisma.property.update({
      where: { id },
      data: {
        ...(updatePropertyDto.managerId && { managerId: updatePropertyDto.managerId }),
        ...(updatePropertyDto.propertyName && { propertyName: updatePropertyDto.propertyName }),
        ...(updatePropertyDto.yearBuilt !== undefined && { yearBuilt: updatePropertyDto.yearBuilt }),
        ...(updatePropertyDto.mlsNumber !== undefined && { mlsNumber: updatePropertyDto.mlsNumber }),
        ...(updatePropertyDto.propertyType && { propertyType: updatePropertyDto.propertyType }),
        ...(updatePropertyDto.sizeSqft !== undefined && {
          sizeSqft:
            updatePropertyDto.sizeSqft !== null
              ? new Decimal(updatePropertyDto.sizeSqft)
              : null,
        }),
        ...(updatePropertyDto.marketRent !== undefined && {
          marketRent:
            updatePropertyDto.marketRent !== null
              ? new Decimal(updatePropertyDto.marketRent)
              : null,
        }),
        ...(updatePropertyDto.depositAmount !== undefined && {
          depositAmount:
            updatePropertyDto.depositAmount !== null
              ? new Decimal(updatePropertyDto.depositAmount)
              : null,
        }),
        ...(addressUpdateData && { address: addressUpdateData }),
        ...(updatePropertyDto.description !== undefined && { description: updatePropertyDto.description }),
        ...(updatePropertyDto.status !== undefined && { status: updatePropertyDto.status }),
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
    return this.findOne(id);
  }

  async remove(id: string) {
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

    // Hard delete the property from the database
    // Related records (amenities, photos, attachments, units, singleUnitDetails)
    // will be automatically deleted due to cascade delete constraints
    await this.prisma.property.delete({
      where: { id },
    });

    return {
      message: 'Property deleted successfully',
      property: existingProperty,
    };
  }

  private buildAmenitiesData(amenities?: CreateAmenitiesDto) {
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

    return data;
  }
}
