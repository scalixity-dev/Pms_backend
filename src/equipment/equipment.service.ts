import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, EquipmentStatus } from '@prisma/client';

const equipmentInclude = {
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
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEquipmentDto: CreateEquipmentDto, userId?: string) {
    // Verify that the property exists
    const property = await this.prisma.property.findUnique({
      where: { id: createEquipmentDto.propertyId },
      include: {
        manager: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException(
        `Property with ID ${createEquipmentDto.propertyId} not found`,
      );
    }

    // If userId is provided, verify permission to create equipment for this property
    if (userId && property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to create equipment for this property',
      );
    }

    // Validate that unitId or singleUnitDetailId belongs to the property
    if (createEquipmentDto.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: createEquipmentDto.unitId },
      });

      if (!unit) {
        throw new NotFoundException(
          `Unit with ID ${createEquipmentDto.unitId} not found`,
        );
      }

      if (unit.propertyId !== createEquipmentDto.propertyId) {
        throw new BadRequestException(
          `Unit ${createEquipmentDto.unitId} does not belong to property ${createEquipmentDto.propertyId}`,
        );
      }
    }

    if (createEquipmentDto.singleUnitDetailId) {
      const singleUnitDetail = await this.prisma.singleUnitDetail.findUnique({
        where: { id: createEquipmentDto.singleUnitDetailId },
      });

      if (!singleUnitDetail) {
        throw new NotFoundException(
          `Single unit detail with ID ${createEquipmentDto.singleUnitDetailId} not found`,
        );
      }

      if (singleUnitDetail.propertyId !== createEquipmentDto.propertyId) {
        throw new BadRequestException(
          `Single unit detail ${createEquipmentDto.singleUnitDetailId} does not belong to property ${createEquipmentDto.propertyId}`,
        );
      }
    }

    // Validate that unitId and singleUnitDetailId are not both provided
    if (createEquipmentDto.unitId && createEquipmentDto.singleUnitDetailId) {
      throw new BadRequestException(
        'Cannot assign equipment to both unit and single unit detail',
      );
    }

    // Create equipment
    const equipment = await this.prisma.equipment.create({
      data: {
        propertyId: createEquipmentDto.propertyId,
        unitId: createEquipmentDto.unitId ?? null,
        singleUnitDetailId: createEquipmentDto.singleUnitDetailId ?? null,
        category: createEquipmentDto.category,
        brand: createEquipmentDto.brand,
        model: createEquipmentDto.model,
        serialNumber: createEquipmentDto.serialNumber,
        price: new Decimal(createEquipmentDto.price),
        dateOfInstallation: new Date(createEquipmentDto.dateOfInstallation),
        equipmentDetails: createEquipmentDto.equipmentDetails,
        photoUrl: createEquipmentDto.photoUrl,
        status: createEquipmentDto.status ?? EquipmentStatus.ACTIVE,
      },
      include: equipmentInclude as Prisma.EquipmentInclude,
    });

    return equipment;
  }

  async findAll(userId?: string) {
    const where: Prisma.EquipmentWhereInput = {};

    // If userId is provided, filter by property manager
    if (userId) {
      where.property = {
        managerId: userId,
      };
    }

    const equipment = await this.prisma.equipment.findMany({
      where,
      include: equipmentInclude as Prisma.EquipmentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return equipment;
  }

  async findByPropertyId(propertyId: string, userId?: string) {
    // Verify that the property exists
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        manager: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    // If userId is provided, verify permission
    if (userId && property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access equipment for this property',
      );
    }

    const equipment = await this.prisma.equipment.findMany({
      where: { propertyId },
      include: equipmentInclude as Prisma.EquipmentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return equipment;
  }

  async findByUnitId(unitId: string, userId?: string) {
    // Verify that the unit exists and get property info
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    // If userId is provided, verify permission
    if (userId && unit.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access equipment for this unit',
      );
    }

    const equipment = await this.prisma.equipment.findMany({
      where: { unitId },
      include: equipmentInclude as Prisma.EquipmentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return equipment;
  }

  async findBySingleUnitDetailId(
    singleUnitDetailId: string,
    userId?: string,
  ) {
    // Verify that the single unit detail exists and get property info
    const singleUnitDetail = await this.prisma.singleUnitDetail.findUnique({
      where: { id: singleUnitDetailId },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!singleUnitDetail) {
      throw new NotFoundException(
        `Single unit detail with ID ${singleUnitDetailId} not found`,
      );
    }

    // If userId is provided, verify permission
    if (userId && singleUnitDetail.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access equipment for this single unit detail',
      );
    }

    const equipment = await this.prisma.equipment.findMany({
      where: { singleUnitDetailId },
      include: equipmentInclude as Prisma.EquipmentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return equipment;
  }

  async findOne(id: string, userId?: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: equipmentInclude as Prisma.EquipmentInclude,
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // If userId is provided, verify permission
    if (userId) {
      const property = await this.prisma.property.findUnique({
        where: { id: equipment.propertyId },
        include: {
          manager: {
            select: {
              id: true,
            },
          },
        },
      });

      if (property && property.manager.id !== userId) {
        throw new ForbiddenException(
          'You do not have permission to access this equipment',
        );
      }
    }

    return equipment;
  }

  async update(
    id: string,
    updateEquipmentDto: UpdateEquipmentDto,
    userId?: string,
  ) {
    // Verify that the equipment exists
    const existingEquipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existingEquipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // If userId is provided, verify permission
    if (userId && existingEquipment.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this equipment',
      );
    }

    // If propertyId is being updated, verify it exists
    if (updateEquipmentDto.propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: updateEquipmentDto.propertyId },
      });

      if (!property) {
        throw new NotFoundException(
          `Property with ID ${updateEquipmentDto.propertyId} not found`,
        );
      }
    }

    // Validate unitId if provided
    if (updateEquipmentDto.unitId !== undefined) {
      if (updateEquipmentDto.unitId) {
        const unit = await this.prisma.unit.findUnique({
          where: { id: updateEquipmentDto.unitId },
        });

        if (!unit) {
          throw new NotFoundException(
            `Unit with ID ${updateEquipmentDto.unitId} not found`,
          );
        }

        const targetPropertyId =
          updateEquipmentDto.propertyId ?? existingEquipment.propertyId;

        if (unit.propertyId !== targetPropertyId) {
          throw new BadRequestException(
            `Unit ${updateEquipmentDto.unitId} does not belong to property ${targetPropertyId}`,
          );
        }
      }
    }

    // Validate singleUnitDetailId if provided
    if (updateEquipmentDto.singleUnitDetailId !== undefined) {
      if (updateEquipmentDto.singleUnitDetailId) {
        const singleUnitDetail = await this.prisma.singleUnitDetail.findUnique(
          {
            where: { id: updateEquipmentDto.singleUnitDetailId },
          },
        );

        if (!singleUnitDetail) {
          throw new NotFoundException(
            `Single unit detail with ID ${updateEquipmentDto.singleUnitDetailId} not found`,
          );
        }

        const targetPropertyId =
          updateEquipmentDto.propertyId ?? existingEquipment.propertyId;

        if (singleUnitDetail.propertyId !== targetPropertyId) {
          throw new BadRequestException(
            `Single unit detail ${updateEquipmentDto.singleUnitDetailId} does not belong to property ${targetPropertyId}`,
          );
        }
      }
    }

    // Validate that unitId and singleUnitDetailId are not both provided
    const finalUnitId =
      updateEquipmentDto.unitId !== undefined
        ? updateEquipmentDto.unitId
        : existingEquipment.unitId;
    const finalSingleUnitDetailId =
      updateEquipmentDto.singleUnitDetailId !== undefined
        ? updateEquipmentDto.singleUnitDetailId
        : existingEquipment.singleUnitDetailId;

    if (finalUnitId && finalSingleUnitDetailId) {
      throw new BadRequestException(
        'Cannot assign equipment to both unit and single unit detail',
      );
    }

    // Build update data
    const updateData: Prisma.EquipmentUncheckedUpdateInput = {};

    if (updateEquipmentDto.propertyId !== undefined) {
      updateData.propertyId = updateEquipmentDto.propertyId;
    }

    if (updateEquipmentDto.unitId !== undefined) {
      updateData.unitId = updateEquipmentDto.unitId ?? null;
    }

    if (updateEquipmentDto.singleUnitDetailId !== undefined) {
      updateData.singleUnitDetailId =
        updateEquipmentDto.singleUnitDetailId ?? null;
    }

    if (updateEquipmentDto.category !== undefined) {
      updateData.category = updateEquipmentDto.category;
    }

    if (updateEquipmentDto.brand !== undefined) {
      updateData.brand = updateEquipmentDto.brand;
    }

    if (updateEquipmentDto.model !== undefined) {
      updateData.model = updateEquipmentDto.model;
    }

    if (updateEquipmentDto.serialNumber !== undefined) {
      updateData.serialNumber = updateEquipmentDto.serialNumber;
    }

    if (updateEquipmentDto.price !== undefined) {
      updateData.price = new Decimal(updateEquipmentDto.price);
    }

    if (updateEquipmentDto.dateOfInstallation !== undefined) {
      updateData.dateOfInstallation = new Date(
        updateEquipmentDto.dateOfInstallation,
      );
    }

    if (updateEquipmentDto.equipmentDetails !== undefined) {
      updateData.equipmentDetails = updateEquipmentDto.equipmentDetails;
    }

    if (updateEquipmentDto.photoUrl !== undefined) {
      updateData.photoUrl = updateEquipmentDto.photoUrl;
    }

    if (updateEquipmentDto.status !== undefined) {
      updateData.status = updateEquipmentDto.status;
    }

    // Update the equipment
    const updatedEquipment = await this.prisma.equipment.update({
      where: { id },
      data: updateData,
      include: equipmentInclude as Prisma.EquipmentInclude,
    });

    return updatedEquipment;
  }

  async remove(id: string, userId?: string) {
    // Verify that the equipment exists
    const existingEquipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existingEquipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    // If userId is provided, verify permission
    if (userId && existingEquipment.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this equipment',
      );
    }

    // Delete the equipment
    await this.prisma.equipment.delete({
      where: { id },
    });

    return {
      message: 'Equipment deleted successfully',
      equipment: existingEquipment,
    };
  }
}
