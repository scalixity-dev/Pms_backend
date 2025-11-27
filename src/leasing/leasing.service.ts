import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeasingDto } from './dto/create-leasing.dto';
import { UpdateLeasingDto } from './dto/update-leasing.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

const leasingInclude = {
  property: {
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
  },
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
} as const;

@Injectable()
export class LeasingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLeasingDto: CreateLeasingDto, userId?: string) {
    // Verify that the property exists
    const property = await this.prisma.property.findUnique({
      where: { id: createLeasingDto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(
        `Property with ID ${createLeasingDto.propertyId} not found`,
      );
    }

    // Check if leasing already exists for this property
    const existingLeasing = await this.prisma.propertyLeasing.findUnique({
      where: { propertyId: createLeasingDto.propertyId },
    });

    if (existingLeasing) {
      throw new BadRequestException(
        `Leasing already exists for property with ID ${createLeasingDto.propertyId}`,
      );
    }

    const propertyDetails = await this.prisma.property.findUnique({
      where: { id: createLeasingDto.propertyId },
      select: {
        propertyType: true,
        managerId: true,
      },
    });

    if (!propertyDetails) {
      throw new NotFoundException(`Property with ID ${createLeasingDto.propertyId} not found`);
    }

    if (userId && propertyDetails.managerId !== userId) {
      throw new BadRequestException('You do not have permission to manage this property');
    }

    const association = await this.resolveAssociationTargets(
      createLeasingDto.propertyId,
      propertyDetails.propertyType,
      createLeasingDto.unitId,
      createLeasingDto.singleUnitDetailId,
    );

    const createData: Prisma.PropertyLeasingUncheckedCreateInput = {
      propertyId: createLeasingDto.propertyId,
      monthlyRent: new Decimal(createLeasingDto.monthlyRent),
      securityDeposit:
        createLeasingDto.securityDeposit !== undefined &&
        createLeasingDto.securityDeposit !== null
          ? new Decimal(createLeasingDto.securityDeposit)
          : null,
      amountRefundable:
        createLeasingDto.amountRefundable !== undefined &&
        createLeasingDto.amountRefundable !== null
          ? new Decimal(createLeasingDto.amountRefundable)
          : null,
      dateAvailable: new Date(createLeasingDto.dateAvailable),
      minLeaseDuration: createLeasingDto.minLeaseDuration,
      maxLeaseDuration: createLeasingDto.maxLeaseDuration,
      description: createLeasingDto.description,
      petsAllowed: createLeasingDto.petsAllowed,
      petCategory: createLeasingDto.petCategory ?? [],
      petDeposit:
        createLeasingDto.petDeposit !== undefined &&
        createLeasingDto.petDeposit !== null
          ? new Decimal(createLeasingDto.petDeposit)
          : null,
      petFee:
        createLeasingDto.petFee !== undefined &&
        createLeasingDto.petFee !== null
          ? new Decimal(createLeasingDto.petFee)
          : null,
      petDescription: createLeasingDto.petDescription,
      onlineRentalApplication: createLeasingDto.onlineRentalApplication,
      requireApplicationFee: createLeasingDto.requireApplicationFee ?? false,
      applicationFee:
        createLeasingDto.applicationFee !== undefined &&
        createLeasingDto.applicationFee !== null
          ? new Decimal(createLeasingDto.applicationFee)
          : null,
    };

    if (association.unitId) {
      (createData as any).unitId = association.unitId;
      (createData as any).singleUnitDetailId = null;
    } else if (association.singleUnitDetailId) {
      (createData as any).singleUnitDetailId = association.singleUnitDetailId;
      (createData as any).unitId = null;
    }

    const leasing = await this.prisma.propertyLeasing.create({
      data: createData,
      include: leasingInclude as Prisma.PropertyLeasingInclude,
    });

    return leasing;
  }

  async findAll(userId?: string) {
    const leasings = await this.prisma.propertyLeasing.findMany({
      where: userId
        ? {
            property: {
              managerId: userId,
            },
          }
        : undefined,
      include: leasingInclude as Prisma.PropertyLeasingInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return leasings;
  }

  async findOne(id: string, userId?: string) {
    const leasing = await this.prisma.propertyLeasing.findUnique({
      where: { id },
      include: leasingInclude as Prisma.PropertyLeasingInclude,
    });

    if (!leasing) {
      throw new NotFoundException(`Leasing with ID ${id} not found`);
    }

    if (userId && leasing.property.managerId !== userId) {
      throw new BadRequestException('You do not have permission to access this leasing');
    }

    return leasing;
  }

  async findByPropertyId(propertyId: string, userId?: string) {
    const leasing = await this.prisma.propertyLeasing.findUnique({
      where: { propertyId },
      include: leasingInclude as Prisma.PropertyLeasingInclude,
    });

    if (!leasing) {
      throw new NotFoundException(
        `Leasing for property with ID ${propertyId} not found`,
      );
    }

    if (userId && leasing.property.managerId !== userId) {
      throw new BadRequestException('You do not have permission to access this leasing');
    }

    return leasing;
  }

  async update(id: string, updateLeasingDto: UpdateLeasingDto, userId?: string) {
    // Verify that the leasing exists
    const existingLeasing = (await this.prisma.propertyLeasing.findUnique({
      where: { id },
    })) as {
      unitId: string | null;
      singleUnitDetailId: string | null;
      propertyId: string;
    } | null;

    if (!existingLeasing) {
      throw new NotFoundException(`Leasing with ID ${id} not found`);
    }

    // If propertyId is being updated, verify that the property exists
    const targetPropertyId = updateLeasingDto.propertyId ?? existingLeasing.propertyId;

    if (updateLeasingDto.propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: updateLeasingDto.propertyId },
      });

      if (!property) {
        throw new NotFoundException(
          `Property with ID ${updateLeasingDto.propertyId} not found`,
        );
      }

      // Check if another leasing exists for the new property
      const otherLeasing = await this.prisma.propertyLeasing.findUnique({
        where: { propertyId: updateLeasingDto.propertyId },
      });

      if (otherLeasing && otherLeasing.id !== id) {
        throw new BadRequestException(
          `Leasing already exists for property with ID ${updateLeasingDto.propertyId}`,
        );
      }
    }

    const propertyDetails = await this.prisma.property.findUnique({
      where: { id: targetPropertyId },
      select: {
        propertyType: true,
        managerId: true,
      },
    });

    if (!propertyDetails) {
      throw new NotFoundException(`Property with ID ${targetPropertyId} not found`);
    }

    if (userId && propertyDetails.managerId !== userId) {
      throw new BadRequestException('You do not have permission to manage this property');
    }

    const association = await this.resolveAssociationTargets(
      targetPropertyId,
      propertyDetails.propertyType,
      updateLeasingDto.unitId ?? existingLeasing.unitId ?? undefined,
      updateLeasingDto.singleUnitDetailId ?? existingLeasing.singleUnitDetailId ?? undefined,
    );

    // Build update data
    const updateData: Prisma.PropertyLeasingUncheckedUpdateInput = {};

    if (updateLeasingDto.monthlyRent !== undefined) {
      updateData.monthlyRent = new Decimal(updateLeasingDto.monthlyRent);
    }

    if (updateLeasingDto.securityDeposit !== undefined) {
      updateData.securityDeposit =
        updateLeasingDto.securityDeposit !== null
          ? new Decimal(updateLeasingDto.securityDeposit)
          : null;
    }

    if (updateLeasingDto.amountRefundable !== undefined) {
      updateData.amountRefundable =
        updateLeasingDto.amountRefundable !== null
          ? new Decimal(updateLeasingDto.amountRefundable)
          : null;
    }

    if (updateLeasingDto.dateAvailable !== undefined) {
      updateData.dateAvailable = new Date(updateLeasingDto.dateAvailable);
    }

    if (updateLeasingDto.minLeaseDuration !== undefined) {
      updateData.minLeaseDuration = updateLeasingDto.minLeaseDuration;
    }

    if (updateLeasingDto.maxLeaseDuration !== undefined) {
      updateData.maxLeaseDuration = updateLeasingDto.maxLeaseDuration;
    }

    if (updateLeasingDto.description !== undefined) {
      updateData.description = updateLeasingDto.description;
    }

    if (updateLeasingDto.petsAllowed !== undefined) {
      updateData.petsAllowed = updateLeasingDto.petsAllowed;
    }

    if (updateLeasingDto.petCategory !== undefined) {
      updateData.petCategory = updateLeasingDto.petCategory;
    }

    if (updateLeasingDto.petDeposit !== undefined) {
      updateData.petDeposit =
        updateLeasingDto.petDeposit !== null
          ? new Decimal(updateLeasingDto.petDeposit)
          : null;
    }

    if (updateLeasingDto.petFee !== undefined) {
      updateData.petFee =
        updateLeasingDto.petFee !== null
          ? new Decimal(updateLeasingDto.petFee)
          : null;
    }

    if (updateLeasingDto.petDescription !== undefined) {
      updateData.petDescription = updateLeasingDto.petDescription;
    }

    if (updateLeasingDto.onlineRentalApplication !== undefined) {
      updateData.onlineRentalApplication =
        updateLeasingDto.onlineRentalApplication;
    }

    if (updateLeasingDto.requireApplicationFee !== undefined) {
      updateData.requireApplicationFee = updateLeasingDto.requireApplicationFee;
    }

    if (updateLeasingDto.applicationFee !== undefined) {
      updateData.applicationFee =
        updateLeasingDto.applicationFee !== null
          ? new Decimal(updateLeasingDto.applicationFee)
          : null;
    }

    if (updateLeasingDto.propertyId !== undefined) {
      updateData.propertyId = updateLeasingDto.propertyId;
    }

    if (association.unitId) {
      (updateData as any).unitId = association.unitId;
      (updateData as any).singleUnitDetailId = null;
    } else if (association.singleUnitDetailId) {
      (updateData as any).singleUnitDetailId = association.singleUnitDetailId;
      (updateData as any).unitId = null;
    }

    // Update the leasing
    const updatedLeasing = await this.prisma.propertyLeasing.update({
      where: { id },
      data: updateData,
      include: leasingInclude as Prisma.PropertyLeasingInclude,
    });

    return updatedLeasing;
  }

  async remove(id: string, userId?: string) {
    // Verify that the leasing exists
    const existingLeasing = await this.prisma.propertyLeasing.findUnique({
      where: { id },
      include: leasingInclude as Prisma.PropertyLeasingInclude,
    });

    if (!existingLeasing) {
      throw new NotFoundException(`Leasing with ID ${id} not found`);
    }

    if (userId && existingLeasing.property.managerId !== userId) {
      throw new BadRequestException('You do not have permission to delete this leasing');
    }

    // Delete the leasing
    await this.prisma.propertyLeasing.delete({
      where: { id },
    });

    return {
      message: 'Leasing deleted successfully',
      leasing: existingLeasing,
    };
  }

  private async resolveAssociationTargets(
    propertyId: string,
    propertyType: 'SINGLE' | 'MULTI',
    unitId?: string,
    singleUnitDetailId?: string,
  ): Promise<{ unitId?: string; singleUnitDetailId?: string }> {
    if (propertyType === 'MULTI') {
      if (!unitId) {
        throw new BadRequestException('unitId is required for MULTI properties');
      }

      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit || unit.propertyId !== propertyId) {
        throw new BadRequestException(
          `Unit ${unitId} does not belong to property with ID ${propertyId}`,
        );
      }

      return { unitId: unit.id };
    }

    let resolvedSingleUnitDetailId = singleUnitDetailId;

    if (resolvedSingleUnitDetailId) {
      const singleUnitDetail = await this.prisma.singleUnitDetail.findUnique({
        where: { id: resolvedSingleUnitDetailId },
      });

      if (!singleUnitDetail || singleUnitDetail.propertyId !== propertyId) {
        throw new BadRequestException(
          `Single unit detail ${resolvedSingleUnitDetailId} does not belong to property with ID ${propertyId}`,
        );
      }
    } else {
      const singleUnitDetail = await this.prisma.singleUnitDetail.findUnique({
        where: { propertyId },
      });

      if (!singleUnitDetail) {
        throw new BadRequestException(
          `Single unit details not found for property with ID ${propertyId}`,
        );
      }

      resolvedSingleUnitDetailId = singleUnitDetail.id;
    }

    return { singleUnitDetailId: resolvedSingleUnitDetailId };
  }
}
