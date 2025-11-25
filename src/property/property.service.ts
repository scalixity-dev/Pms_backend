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

    // Create address if provided
    let addressId: string | undefined;
    if (createPropertyDto.address) {
      const address = await this.prisma.address.create({
        data: {
          streetAddress: createPropertyDto.address.streetAddress,
          city: createPropertyDto.address.city,
          stateRegion: createPropertyDto.address.stateRegion,
          zipCode: createPropertyDto.address.zipCode,
          country: createPropertyDto.address.country,
        },
      });
      addressId = address.id;
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
        addressId: addressId,
        description: createPropertyDto.description,
        status: 'INACTIVE', // New properties are always created with INACTIVE status
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
        let unitAmenitiesId: string | undefined;
        
        // Create unit amenities if provided
        const unitAmenitiesData = this.buildAmenitiesData(unit.amenities);
        if (unitAmenitiesData) {
          const unitAmenities = await this.prisma.amenities.create({
            data: unitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
          });
          unitAmenitiesId = unitAmenities.id;
        }

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
            amenitiesId: unitAmenitiesId,
          },
        });
      }
    }

    // Create single unit details if provided (for SINGLE properties)
    if (createPropertyDto.singleUnitDetails) {
      let singleUnitAmenitiesId: string | undefined;

      // Create single unit amenities if provided
      const singleUnitAmenitiesData = this.buildAmenitiesData(
        createPropertyDto.singleUnitDetails.amenities,
      );
      if (singleUnitAmenitiesData) {
        const singleUnitAmenities = await this.prisma.amenities.create({
          data: singleUnitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
        });
        singleUnitAmenitiesId = singleUnitAmenities.id;
      }

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
          amenitiesId: singleUnitAmenitiesId,
        },
      });
    }

    // Return property with all related data
    return this.findOne(property.id);
  }

  async findAll() {
    const properties = await this.prisma.property.findMany({
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

    // Handle address update - create new address if provided
    let addressId: string | undefined;
    if (updatePropertyDto.address) {
      // Get existing property to check if it has an address
      const existingProperty = await this.prisma.property.findUnique({
        where: { id },
        select: { addressId: true },
      });

      // Create new address
      const newAddress = await this.prisma.address.create({
        data: {
          streetAddress: updatePropertyDto.address.streetAddress,
          city: updatePropertyDto.address.city,
          stateRegion: updatePropertyDto.address.stateRegion,
          zipCode: updatePropertyDto.address.zipCode,
          country: updatePropertyDto.address.country,
        },
      });
      addressId = newAddress.id;

      // Optionally delete old address if it existed (or you can keep it for history)
      if (existingProperty?.addressId) {
        await this.prisma.address.delete({
          where: { id: existingProperty.addressId },
        });
      }
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
        ...(addressId && { addressId: addressId }),
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
