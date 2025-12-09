import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import {
  MaintenanceRequestType,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

const maintenanceRequestInclude = {
  manager: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
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
  equipment: {
    include: {
      property: {
        select: {
          id: true,
          propertyName: true,
        },
      },
    },
  },
  photos: true,
  assignments: {
    include: {
      serviceProvider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phoneNumber: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  },
  materials: true,
} as const;

@Injectable()
export class MaintenanceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(
    createMaintenanceRequestDto: CreateMaintenanceRequestDto,
    userId?: string,
  ) {
    // Verify that the property exists
    const property = await this.prisma.property.findUnique({
      where: { id: createMaintenanceRequestDto.propertyId },
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
        `Property with ID ${createMaintenanceRequestDto.propertyId} not found`,
      );
    }

    // If userId is provided, verify permission to create maintenance request for this property
    if (userId && property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to create maintenance requests for this property',
      );
    }

    // Validate that unitId belongs to the property
    if (createMaintenanceRequestDto.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: createMaintenanceRequestDto.unitId },
      });

      if (!unit) {
        throw new NotFoundException(
          `Unit with ID ${createMaintenanceRequestDto.unitId} not found`,
        );
      }

      if (unit.propertyId !== createMaintenanceRequestDto.propertyId) {
        throw new BadRequestException(
          `Unit ${createMaintenanceRequestDto.unitId} does not belong to property ${createMaintenanceRequestDto.propertyId}`,
        );
      }
    }

    // Validate that singleUnitDetailId belongs to the property
    if (createMaintenanceRequestDto.singleUnitDetailId) {
      const singleUnitDetail =
        await this.prisma.singleUnitDetail.findUnique({
          where: { id: createMaintenanceRequestDto.singleUnitDetailId },
        });

      if (!singleUnitDetail) {
        throw new NotFoundException(
          `Single unit detail with ID ${createMaintenanceRequestDto.singleUnitDetailId} not found`,
        );
      }

      if (
        singleUnitDetail.propertyId !==
        createMaintenanceRequestDto.propertyId
      ) {
        throw new BadRequestException(
          `Single unit detail ${createMaintenanceRequestDto.singleUnitDetailId} does not belong to property ${createMaintenanceRequestDto.propertyId}`,
        );
      }
    }

    // Validate that unitId and singleUnitDetailId are not both provided
    if (
      createMaintenanceRequestDto.unitId &&
      createMaintenanceRequestDto.singleUnitDetailId
    ) {
      throw new BadRequestException(
        'Cannot specify both unitId and singleUnitDetailId',
      );
    }

    // Validate equipment if provided
    if (createMaintenanceRequestDto.equipmentId) {
      const equipment = await this.prisma.equipment.findUnique({
        where: { id: createMaintenanceRequestDto.equipmentId },
      });

      if (!equipment) {
        throw new NotFoundException(
          `Equipment with ID ${createMaintenanceRequestDto.equipmentId} not found`,
        );
      }

      // Verify equipment belongs to the property
      if (equipment.propertyId !== createMaintenanceRequestDto.propertyId) {
        throw new BadRequestException(
          `Equipment ${createMaintenanceRequestDto.equipmentId} does not belong to property ${createMaintenanceRequestDto.propertyId}`,
        );
      }

      // If unitId is provided, verify equipment belongs to that unit
      if (createMaintenanceRequestDto.unitId) {
        if (equipment.unitId !== createMaintenanceRequestDto.unitId) {
          throw new BadRequestException(
            `Equipment ${createMaintenanceRequestDto.equipmentId} does not belong to unit ${createMaintenanceRequestDto.unitId}`,
          );
        }
      }

      // If singleUnitDetailId is provided, verify equipment belongs to that single unit detail
      if (createMaintenanceRequestDto.singleUnitDetailId) {
        if (
          equipment.singleUnitDetailId !==
          createMaintenanceRequestDto.singleUnitDetailId
        ) {
          throw new BadRequestException(
            `Equipment ${createMaintenanceRequestDto.equipmentId} does not belong to single unit detail ${createMaintenanceRequestDto.singleUnitDetailId}`,
          );
        }
      }
    }

    // Use the managerId from the property or from userId
    const managerId = userId || property.manager.id;

    // Prepare data for creation
    const data: Prisma.MaintenanceRequestCreateInput = {
      manager: {
        connect: { id: managerId },
      },
      property: {
        connect: { id: createMaintenanceRequestDto.propertyId },
      },
      requestType: createMaintenanceRequestDto.requestType,
      equipmentLinked: createMaintenanceRequestDto.equipmentLinked || false,
      category: createMaintenanceRequestDto.category,
      subcategory: createMaintenanceRequestDto.subcategory,
      issue: createMaintenanceRequestDto.issue,
      subissue: createMaintenanceRequestDto.subissue,
      title: createMaintenanceRequestDto.title,
      problemDetails: createMaintenanceRequestDto.problemDetails,
      priority: createMaintenanceRequestDto.priority || MaintenancePriority.MEDIUM,
      status: createMaintenanceRequestDto.status || MaintenanceStatus.NEW,
      internalNotes: createMaintenanceRequestDto.internalNotes,
      tenantInformation: createMaintenanceRequestDto.tenantInformation,
      dueDate: createMaintenanceRequestDto.dueDate
        ? new Date(createMaintenanceRequestDto.dueDate)
        : undefined,
      ...(createMaintenanceRequestDto.unitId && {
        unit: {
          connect: { id: createMaintenanceRequestDto.unitId },
        },
      }),
      ...(createMaintenanceRequestDto.singleUnitDetailId && {
        singleUnitDetail: {
          connect: { id: createMaintenanceRequestDto.singleUnitDetailId },
        },
      }),
      ...(createMaintenanceRequestDto.equipmentId && {
        equipment: {
          connect: { id: createMaintenanceRequestDto.equipmentId },
        },
      }),
      ...(createMaintenanceRequestDto.photos && {
        photos: {
          create: createMaintenanceRequestDto.photos.map((photo) => ({
            photoUrl: photo.photoUrl,
            videoUrl: photo.videoUrl,
            description: photo.description,
            isPrimary: photo.isPrimary || false,
          })),
        },
      }),
      ...(createMaintenanceRequestDto.materials && {
        materials: {
          create: createMaintenanceRequestDto.materials.map((material) => ({
            materialName: material.materialName,
            quantity: material.quantity || 1,
            unit: material.unit,
            description: material.description,
          })),
        },
      }),
    };

    const maintenanceRequest = await this.prisma.maintenanceRequest.create({
      data,
      include: maintenanceRequestInclude,
    });

    if (managerId) {
      await this.cache.invalidateMaintenance(managerId, maintenanceRequest.id, createMaintenanceRequestDto.propertyId);
      await this.cache.invalidateProperty(managerId, createMaintenanceRequestDto.propertyId);
    }

    const cacheKey = this.cache.maintenanceDetailKey(maintenanceRequest.id);
    await this.cache.set(cacheKey, maintenanceRequest, this.cache.getTTL('MAINTENANCE_DETAIL'));

    return maintenanceRequest;
  }

  async findAll(userId?: string) {
    const cacheKey = this.cache.maintenanceListKey(userId);
    const ttl = this.cache.getTTL('MAINTENANCE_LIST');

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const where: Prisma.MaintenanceRequestWhereInput = userId
          ? { managerId: userId }
          : {};

        const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
          where,
          include: maintenanceRequestInclude,
          orderBy: {
            requestedAt: 'desc',
          },
        });

        return maintenanceRequests;
      },
      ttl,
    );
  }

  async findByPropertyId(propertyId: string, userId?: string) {
    // Verify property exists and user has permission
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
      throw new NotFoundException(
        `Property with ID ${propertyId} not found`,
      );
    }

    if (userId && property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view maintenance requests for this property',
      );
    }

    const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
      where: { propertyId },
      include: maintenanceRequestInclude,
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return maintenanceRequests;
  }

  async findByUnitId(unitId: string, userId?: string) {
    // Verify unit exists and user has permission
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

    if (userId && unit.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view maintenance requests for this unit',
      );
    }

    const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
      where: { unitId },
      include: maintenanceRequestInclude,
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return maintenanceRequests;
  }

  async findBySingleUnitDetailId(
    singleUnitDetailId: string,
    userId?: string,
  ) {
    // Verify single unit detail exists and user has permission
    const singleUnitDetail =
      await this.prisma.singleUnitDetail.findUnique({
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

    if (userId && singleUnitDetail.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view maintenance requests for this single unit detail',
      );
    }

    const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
      where: { singleUnitDetailId },
      include: maintenanceRequestInclude,
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return maintenanceRequests;
  }

  async findByEquipmentId(equipmentId: string, userId?: string) {
    // Verify equipment exists and user has permission
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
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

    if (!equipment) {
      throw new NotFoundException(
        `Equipment with ID ${equipmentId} not found`,
      );
    }

    if (userId && equipment.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view maintenance requests for this equipment',
      );
    }

    const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
      where: { equipmentId },
      include: maintenanceRequestInclude,
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return maintenanceRequests;
  }

  async findOne(id: string, userId?: string) {
    const cacheKey = this.cache.maintenanceDetailKey(id);
    const ttl = this.cache.getTTL('MAINTENANCE_DETAIL');

    const maintenanceRequest = await this.cache.getOrSet(
      cacheKey,
      async () => {
        const maintenanceRequest = await this.prisma.maintenanceRequest.findUnique({
          where: { id },
          include: maintenanceRequestInclude,
        });

        if (!maintenanceRequest) {
          throw new NotFoundException(
            `Maintenance request with ID ${id} not found`,
          );
        }

        return maintenanceRequest;
      },
      ttl,
    );

    if (userId && maintenanceRequest.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this maintenance request',
      );
    }

    return maintenanceRequest;
  }

  async update(
    id: string,
    updateMaintenanceRequestDto: UpdateMaintenanceRequestDto,
    userId?: string,
  ) {
    // Verify maintenance request exists
    const existingRequest = await this.prisma.maintenanceRequest.findUnique({
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

    if (!existingRequest) {
      throw new NotFoundException(
        `Maintenance request with ID ${id} not found`,
      );
    }

    // Verify user has permission to update this maintenance request
    if (userId && existingRequest.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this maintenance request',
      );
    }

    // Validate propertyId if being updated
    if (updateMaintenanceRequestDto.propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: updateMaintenanceRequestDto.propertyId },
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
          `Property with ID ${updateMaintenanceRequestDto.propertyId} not found`,
        );
      }

      if (userId && property.manager.id !== userId) {
        throw new ForbiddenException(
          'You do not have permission to update maintenance request to this property',
        );
      }
    }

    // Validate unitId if being updated
    if (updateMaintenanceRequestDto.unitId !== undefined) {
      if (updateMaintenanceRequestDto.unitId) {
        const unit = await this.prisma.unit.findUnique({
          where: { id: updateMaintenanceRequestDto.unitId },
        });

        if (!unit) {
          throw new NotFoundException(
            `Unit with ID ${updateMaintenanceRequestDto.unitId} not found`,
          );
        }

        const propertyId =
          updateMaintenanceRequestDto.propertyId ||
          existingRequest.propertyId;

        if (unit.propertyId !== propertyId) {
          throw new BadRequestException(
            `Unit ${updateMaintenanceRequestDto.unitId} does not belong to property ${propertyId}`,
          );
        }
      }
    }

    // Validate singleUnitDetailId if being updated
    if (updateMaintenanceRequestDto.singleUnitDetailId !== undefined) {
      if (updateMaintenanceRequestDto.singleUnitDetailId) {
        const singleUnitDetail =
          await this.prisma.singleUnitDetail.findUnique({
            where: { id: updateMaintenanceRequestDto.singleUnitDetailId },
          });

        if (!singleUnitDetail) {
          throw new NotFoundException(
            `Single unit detail with ID ${updateMaintenanceRequestDto.singleUnitDetailId} not found`,
          );
        }

        const propertyId =
          updateMaintenanceRequestDto.propertyId ||
          existingRequest.propertyId;

        if (singleUnitDetail.propertyId !== propertyId) {
          throw new BadRequestException(
            `Single unit detail ${updateMaintenanceRequestDto.singleUnitDetailId} does not belong to property ${propertyId}`,
          );
        }
      }
    }

    // Validate equipmentId if being updated
    if (updateMaintenanceRequestDto.equipmentId !== undefined) {
      if (updateMaintenanceRequestDto.equipmentId) {
        const equipment = await this.prisma.equipment.findUnique({
          where: { id: updateMaintenanceRequestDto.equipmentId },
        });

        if (!equipment) {
          throw new NotFoundException(
            `Equipment with ID ${updateMaintenanceRequestDto.equipmentId} not found`,
          );
        }

        const propertyId =
          updateMaintenanceRequestDto.propertyId ||
          existingRequest.propertyId;

        if (equipment.propertyId !== propertyId) {
          throw new BadRequestException(
            `Equipment ${updateMaintenanceRequestDto.equipmentId} does not belong to property ${propertyId}`,
          );
        }
      }
    }

    // Prepare update data
    const updateData: Prisma.MaintenanceRequestUpdateInput = {};

    if (updateMaintenanceRequestDto.propertyId) {
      updateData.property = {
        connect: { id: updateMaintenanceRequestDto.propertyId },
      };
    }

    if (updateMaintenanceRequestDto.unitId !== undefined) {
      if (updateMaintenanceRequestDto.unitId) {
        updateData.unit = {
          connect: { id: updateMaintenanceRequestDto.unitId },
        };
      } else {
        updateData.unit = { disconnect: true };
      }
    }

    if (updateMaintenanceRequestDto.singleUnitDetailId !== undefined) {
      if (updateMaintenanceRequestDto.singleUnitDetailId) {
        updateData.singleUnitDetail = {
          connect: { id: updateMaintenanceRequestDto.singleUnitDetailId },
        };
      } else {
        updateData.singleUnitDetail = { disconnect: true };
      }
    }

    if (updateMaintenanceRequestDto.equipmentId !== undefined) {
      if (updateMaintenanceRequestDto.equipmentId) {
        updateData.equipment = {
          connect: { id: updateMaintenanceRequestDto.equipmentId },
        };
      } else {
        updateData.equipment = { disconnect: true };
      }
    }

    if (updateMaintenanceRequestDto.requestType !== undefined) {
      updateData.requestType = updateMaintenanceRequestDto.requestType;
    }

    if (updateMaintenanceRequestDto.equipmentLinked !== undefined) {
      updateData.equipmentLinked = updateMaintenanceRequestDto.equipmentLinked;
    }

    if (updateMaintenanceRequestDto.category !== undefined) {
      updateData.category = updateMaintenanceRequestDto.category;
    }

    if (updateMaintenanceRequestDto.subcategory !== undefined) {
      updateData.subcategory = updateMaintenanceRequestDto.subcategory;
    }

    if (updateMaintenanceRequestDto.issue !== undefined) {
      updateData.issue = updateMaintenanceRequestDto.issue;
    }

    if (updateMaintenanceRequestDto.subissue !== undefined) {
      updateData.subissue = updateMaintenanceRequestDto.subissue;
    }

    if (updateMaintenanceRequestDto.title !== undefined) {
      updateData.title = updateMaintenanceRequestDto.title;
    }

    if (updateMaintenanceRequestDto.problemDetails !== undefined) {
      updateData.problemDetails = updateMaintenanceRequestDto.problemDetails;
    }

    if (updateMaintenanceRequestDto.priority !== undefined) {
      updateData.priority = updateMaintenanceRequestDto.priority;
    }

    if (updateMaintenanceRequestDto.status !== undefined) {
      updateData.status = updateMaintenanceRequestDto.status;
      
      // Set completedAt if status is COMPLETED
      if (updateMaintenanceRequestDto.status === MaintenanceStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }
    }

    if (updateMaintenanceRequestDto.internalNotes !== undefined) {
      updateData.internalNotes = updateMaintenanceRequestDto.internalNotes;
    }

    if (updateMaintenanceRequestDto.tenantInformation !== undefined) {
      updateData.tenantInformation = updateMaintenanceRequestDto.tenantInformation;
    }

    if (updateMaintenanceRequestDto.dueDate !== undefined) {
      updateData.dueDate = updateMaintenanceRequestDto.dueDate
        ? new Date(updateMaintenanceRequestDto.dueDate)
        : null;
    }

    const updatedRequest = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      include: maintenanceRequestInclude,
    });

    if (userId) {
      await this.cache.invalidateMaintenance(userId, id, updatedRequest.propertyId);
      await this.cache.invalidateProperty(userId, updatedRequest.propertyId);
    }

    const cacheKey = this.cache.maintenanceDetailKey(id);
    await this.cache.set(cacheKey, updatedRequest, this.cache.getTTL('MAINTENANCE_DETAIL'));

    return updatedRequest;
  }

  async remove(id: string, userId?: string) {
    // Verify maintenance request exists
    const existingRequest = await this.prisma.maintenanceRequest.findUnique({
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

    if (!existingRequest) {
      throw new NotFoundException(
        `Maintenance request with ID ${id} not found`,
      );
    }

    // Verify user has permission to delete this maintenance request
    if (userId && existingRequest.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this maintenance request',
      );
    }

    await this.prisma.maintenanceRequest.delete({
      where: { id },
    });

    if (userId) {
      await this.cache.invalidateMaintenance(userId, id, existingRequest.propertyId);
      await this.cache.invalidateProperty(userId, existingRequest.propertyId);
    }

    return { message: 'Maintenance request deleted successfully' };
  }
}
