import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateAmenitiesDto } from '../property/dto/create-property.dto';

type AmenitiesDataInput = {
  parking: CreateAmenitiesDto['parking'];
  laundry: CreateAmenitiesDto['laundry'];
  airConditioning: CreateAmenitiesDto['airConditioning'];
  propertyFeatures?: string[];
  propertyAmenities?: string[];
  unitId?: string;
};

@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUnitDto: CreateUnitDto, propertyId: string, userId: string) {
    // Verify property exists and belongs to user
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    if (property.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to create units for this property');
    }

    if (property.propertyType !== 'MULTI') {
      throw new BadRequestException('Units can only be created for MULTI property types');
    }

    // Create the unit
    const unit = await this.prisma.unit.create({
      data: {
        propertyId: propertyId,
        unitName: createUnitDto.unitName,
        apartmentType: createUnitDto.apartmentType || null,
        sizeSqft: createUnitDto.sizeSqft
          ? new Decimal(createUnitDto.sizeSqft)
          : null,
        beds: createUnitDto.beds || null,
        baths: createUnitDto.baths
          ? new Decimal(createUnitDto.baths)
          : null,
        rent: createUnitDto.rent ? new Decimal(createUnitDto.rent) : null,
        deposit: createUnitDto.deposit ? new Decimal(createUnitDto.deposit) : null,
        coverPhotoUrl: createUnitDto.coverPhotoUrl || null,
        description: createUnitDto.description || null,
      },
    });

    // Create unit amenities if provided
    if (createUnitDto.amenities) {
      const unitAmenitiesData = this.buildAmenitiesData(createUnitDto.amenities, {
        unitId: unit.id,
      });

      if (unitAmenitiesData) {
        await this.prisma.amenities.create({
          data: unitAmenitiesData as unknown as Prisma.AmenitiesCreateInput,
        });
      }
    }

    // Create unit photos if provided
    if (createUnitDto.photos?.length) {
      // Set first photo as primary if none specified
      const photos = createUnitDto.photos.map((photo, index) => ({
        unitId: unit.id,
        photoUrl: photo.photoUrl,
        isPrimary: photo.isPrimary ?? (index === 0),
      }));

      // If any photo is marked as primary, ensure only one is primary
      const hasPrimary = photos.some((p) => p.isPrimary);
      if (hasPrimary) {
        photos.forEach((photo, index) => {
          if (index > 0) photo.isPrimary = false;
        });
      }

      await this.prisma.unitPhoto.createMany({
        data: photos,
      });
    }

    return this.findOne(unit.id, userId);
  }

  async findAll(propertyId: string, userId: string) {
    // Verify property exists and belongs to user
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    if (property.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to access units for this property');
    }

    const units = await this.prisma.unit.findMany({
      where: { propertyId },
      include: {
        amenities: true,
        photos: {
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'asc' },
          ],
        },
        leasing: {
          select: {
            id: true,
            monthlyRent: true,
            securityDeposit: true,
          },
        },
        listings: {
          where: {
            listingStatus: 'ACTIVE',
          },
          take: 1,
          select: {
            id: true,
            occupancyStatus: true,
            listingStatus: true,
          },
        },
      },
      orderBy: {
        unitName: 'asc',
      },
    });

    return units;
  }

  async findOne(id: string, userId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            propertyName: true,
            managerId: true,
            propertyType: true,
          },
        },
        amenities: true,
        photos: {
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'asc' },
          ],
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
          },
        },
        listings: {
          where: {
            listingStatus: 'ACTIVE',
          },
          take: 1,
          select: {
            id: true,
            occupancyStatus: true,
            listingStatus: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // Ensure the unit belongs to a property owned by the user
    if (unit.property.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this unit');
    }

    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto, userId: string) {
    // Verify unit exists and belongs to user
    const existingUnit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            managerId: true,
          },
        },
      },
    });

    if (!existingUnit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    if (existingUnit.property.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to update this unit');
    }

    // Update unit basic fields
    const updatedUnit = await this.prisma.unit.update({
      where: { id },
      data: {
        ...(updateUnitDto.unitName && { unitName: updateUnitDto.unitName }),
        ...(updateUnitDto.apartmentType !== undefined && {
          apartmentType: updateUnitDto.apartmentType || null,
        }),
        ...(updateUnitDto.sizeSqft !== undefined && {
          sizeSqft:
            updateUnitDto.sizeSqft !== null
              ? new Decimal(updateUnitDto.sizeSqft)
              : null,
        }),
        ...(updateUnitDto.beds !== undefined && { beds: updateUnitDto.beds || null }),
        ...(updateUnitDto.baths !== undefined && {
          baths:
            updateUnitDto.baths !== null
              ? new Decimal(updateUnitDto.baths)
              : null,
        }),
        ...(updateUnitDto.rent !== undefined && {
          rent: updateUnitDto.rent !== null ? new Decimal(updateUnitDto.rent) : null,
        }),
        ...(updateUnitDto.deposit !== undefined && {
          deposit: updateUnitDto.deposit !== null ? new Decimal(updateUnitDto.deposit) : null,
        }),
        ...(updateUnitDto.coverPhotoUrl !== undefined && {
          coverPhotoUrl: updateUnitDto.coverPhotoUrl || null,
        }),
        ...(updateUnitDto.description !== undefined && {
          description: updateUnitDto.description || null,
        }),
      },
    });

    // Handle amenities update if provided
    if (updateUnitDto.amenities) {
      const existingAmenities = await this.prisma.amenities.findUnique({
        where: { unitId: id },
      });

      // Merge existing amenities with update data to ensure all required fields are present
      const mergedAmenities = {
        parking: updateUnitDto.amenities.parking ?? existingAmenities?.parking ?? 'NONE',
        laundry: updateUnitDto.amenities.laundry ?? existingAmenities?.laundry ?? 'NONE',
        airConditioning: updateUnitDto.amenities.airConditioning ?? existingAmenities?.airConditioning ?? 'NONE',
        propertyFeatures: updateUnitDto.amenities.propertyFeatures ?? existingAmenities?.propertyFeatures ?? [],
        propertyAmenities: updateUnitDto.amenities.propertyAmenities ?? existingAmenities?.propertyAmenities ?? [],
      };

      const amenitiesData = this.buildAmenitiesData(mergedAmenities as CreateAmenitiesDto, {
        unitId: id,
      });

      if (existingAmenities) {
        await this.prisma.amenities.update({
          where: { id: existingAmenities.id },
          data: amenitiesData as unknown as Prisma.AmenitiesUpdateInput,
        });
      } else {
        if (amenitiesData) {
          await this.prisma.amenities.create({
            data: amenitiesData as unknown as Prisma.AmenitiesCreateInput,
          });
        }
      }
    }

    // Handle photos update if provided
    if (updateUnitDto.photos?.length) {
      // First, set all existing photos to not primary
      await this.prisma.unitPhoto.updateMany({
        where: { unitId: id },
        data: { isPrimary: false },
      });

      // Then, create or update photos
      for (const photo of updateUnitDto.photos) {
        // Check if photo with this URL already exists
        const existingPhoto = await this.prisma.unitPhoto.findFirst({
          where: {
            unitId: id,
            photoUrl: photo.photoUrl,
          },
        });

        if (existingPhoto) {
          // Update existing photo
          await this.prisma.unitPhoto.update({
            where: { id: existingPhoto.id },
            data: { isPrimary: photo.isPrimary || false },
          });
        } else {
          // Create new photo
          await this.prisma.unitPhoto.create({
            data: {
              unitId: id,
              photoUrl: photo.photoUrl,
              isPrimary: photo.isPrimary || false,
            },
          });
        }
      }
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    // Verify unit exists and belongs to user
    const existingUnit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            managerId: true,
            propertyName: true,
          },
        },
      },
    });

    if (!existingUnit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    if (existingUnit.property.managerId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this unit');
    }

    // Delete the unit (cascade will handle related records)
    await this.prisma.unit.delete({
      where: { id },
    });

    return {
      message: 'Unit deleted successfully',
      unit: {
        id: existingUnit.id,
        unitName: existingUnit.unitName,
        propertyName: existingUnit.property.propertyName,
      },
    };
  }

  private buildAmenitiesData(
    amenities?: CreateAmenitiesDto,
    options?: {
      unitId?: string;
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

    if (options?.unitId) {
      data.unitId = options.unitId;
    }

    return data;
  }
}
