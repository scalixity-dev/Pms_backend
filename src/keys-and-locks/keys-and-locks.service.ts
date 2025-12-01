import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKeysAndLockDto } from './dto/create-keys-and-lock.dto';
import { UpdateKeysAndLockDto } from './dto/update-keys-and-lock.dto';
import { Prisma } from '@prisma/client';
import { KeyStatus } from '@prisma/client';

const keyInclude = {
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
export class KeysAndLocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createKeysAndLockDto: CreateKeysAndLockDto, userId: string) {
    // Verify that the property exists
    const property = await this.prisma.property.findUnique({
      where: { id: createKeysAndLockDto.propertyId },
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
        `Property with ID ${createKeysAndLockDto.propertyId} not found`,
      );
    }

    // Verify permission to create keys for this property
    if (property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to create keys for this property',
      );
    }

    // Validate that unitId and singleUnitDetailId are not both provided
    if (
      createKeysAndLockDto.unitId &&
      createKeysAndLockDto.singleUnitDetailId
    ) {
      throw new BadRequestException(
        'Cannot specify both unitId and singleUnitDetailId',
      );
    }

    // Validate that unitId belongs to the property if provided
    if (createKeysAndLockDto.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: createKeysAndLockDto.unitId },
      });

      if (!unit) {
        throw new NotFoundException(
          `Unit with ID ${createKeysAndLockDto.unitId} not found`,
        );
      }

      if (unit.propertyId !== createKeysAndLockDto.propertyId) {
        throw new BadRequestException(
          `Unit ${createKeysAndLockDto.unitId} does not belong to property ${createKeysAndLockDto.propertyId}`,
        );
      }
    }

    // Validate that singleUnitDetailId belongs to the property if provided
    if (createKeysAndLockDto.singleUnitDetailId) {
      const singleUnitDetail =
        await this.prisma.singleUnitDetail.findUnique({
          where: { id: createKeysAndLockDto.singleUnitDetailId },
        });

      if (!singleUnitDetail) {
        throw new NotFoundException(
          `Single unit detail with ID ${createKeysAndLockDto.singleUnitDetailId} not found`,
        );
      }

      if (
        singleUnitDetail.propertyId !== createKeysAndLockDto.propertyId
      ) {
        throw new BadRequestException(
          `Single unit detail ${createKeysAndLockDto.singleUnitDetailId} does not belong to property ${createKeysAndLockDto.propertyId}`,
        );
      }
    }

    // Prepare data for creation
    const data: Prisma.KeyCreateInput = {
      property: {
        connect: { id: createKeysAndLockDto.propertyId },
      },
      keyName: createKeysAndLockDto.keyName,
      keyType: createKeysAndLockDto.keyType,
      description: createKeysAndLockDto.description,
      keyPhotoUrl: createKeysAndLockDto.keyPhotoUrl,
      status: createKeysAndLockDto.status || KeyStatus.AVAILABLE,
      issuedTo: createKeysAndLockDto.issuedTo,
      issuedDate: createKeysAndLockDto.issuedDate
        ? new Date(createKeysAndLockDto.issuedDate)
        : undefined,
      returnedDate: createKeysAndLockDto.returnedDate
        ? new Date(createKeysAndLockDto.returnedDate)
        : undefined,
    };

    // Connect unit if provided
    if (createKeysAndLockDto.unitId) {
      data.unit = {
        connect: { id: createKeysAndLockDto.unitId },
      };
    }

    // Connect singleUnitDetail if provided
    if (createKeysAndLockDto.singleUnitDetailId) {
      data.singleUnitDetail = {
        connect: { id: createKeysAndLockDto.singleUnitDetailId },
      };
    }

    const key = await this.prisma.key.create({
      data,
      include: keyInclude as unknown as Prisma.KeyInclude,
    });

    return key;
  }

  async findAll(userId: string) {
    const keys = await this.prisma.key.findMany({
      where: {
        property: {
          managerId: userId,
        },
      },
      include: keyInclude as unknown as Prisma.KeyInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return keys;
  }

  async findByPropertyId(propertyId: string, userId: string) {
    // Verify that the property exists and belongs to the user
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

    if (property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access keys for this property',
      );
    }

    const keys = await this.prisma.key.findMany({
      where: {
        propertyId: propertyId,
      },
      include: keyInclude as unknown as Prisma.KeyInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return keys;
  }

  async findByUnitId(unitId: string, userId: string) {
    // Verify that the unit exists and belongs to a property owned by the user
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

    if (unit.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access keys for this unit',
      );
    }

    const keys = await this.prisma.key.findMany({
      where: {
        unitId: unitId,
      },
      include: keyInclude as unknown as Prisma.KeyInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return keys;
  }

  async findBySingleUnitDetailId(singleUnitDetailId: string, userId: string) {
    // Verify that the single unit detail exists and belongs to a property owned by the user
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

    if (singleUnitDetail.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access keys for this single unit detail',
      );
    }

    const keys = await this.prisma.key.findMany({
      where: {
        singleUnitDetailId: singleUnitDetailId,
      },
      include: keyInclude as unknown as Prisma.KeyInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return keys;
  }

  async findOne(id: string, userId: string) {
    const key = await this.prisma.key.findUnique({
      where: { id },
      include: keyInclude as unknown as Prisma.KeyInclude,
    });

    if (!key) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    // Ensure the key belongs to a property owned by the authenticated user
    // Use managerId from property for permission check
    if (key.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this key',
      );
    }

    return key;
  }

  async update(id: string, updateKeysAndLockDto: UpdateKeysAndLockDto, userId: string) {
    // Verify that the key exists
    const existingKey = await this.prisma.key.findUnique({
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

    if (!existingKey) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    // Ensure the key belongs to a property owned by the authenticated user
    if (existingKey.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this key',
      );
    }

    // Validate that unitId and singleUnitDetailId are not both provided
    if (
      updateKeysAndLockDto.unitId !== undefined &&
      updateKeysAndLockDto.singleUnitDetailId !== undefined
    ) {
      if (
        updateKeysAndLockDto.unitId !== null &&
        updateKeysAndLockDto.singleUnitDetailId !== null
      ) {
        throw new BadRequestException(
          'Cannot specify both unitId and singleUnitDetailId',
        );
      }
    }

    // Validate unitId if provided
    if (updateKeysAndLockDto.unitId !== undefined) {
      if (updateKeysAndLockDto.unitId === null) {
        // Allow setting unitId to null
      } else {
        const unit = await this.prisma.unit.findUnique({
          where: { id: updateKeysAndLockDto.unitId },
        });

        if (!unit) {
          throw new NotFoundException(
            `Unit with ID ${updateKeysAndLockDto.unitId} not found`,
          );
        }

        if (unit.propertyId !== existingKey.propertyId) {
          throw new BadRequestException(
            `Unit ${updateKeysAndLockDto.unitId} does not belong to property ${existingKey.propertyId}`,
          );
        }
      }
    }

    // Validate singleUnitDetailId if provided
    if (updateKeysAndLockDto.singleUnitDetailId !== undefined) {
      if (updateKeysAndLockDto.singleUnitDetailId === null) {
        // Allow setting singleUnitDetailId to null
      } else {
        const singleUnitDetail =
          await this.prisma.singleUnitDetail.findUnique({
            where: { id: updateKeysAndLockDto.singleUnitDetailId },
          });

        if (!singleUnitDetail) {
          throw new NotFoundException(
            `Single unit detail with ID ${updateKeysAndLockDto.singleUnitDetailId} not found`,
          );
        }

        if (singleUnitDetail.propertyId !== existingKey.propertyId) {
          throw new BadRequestException(
            `Single unit detail ${updateKeysAndLockDto.singleUnitDetailId} does not belong to property ${existingKey.propertyId}`,
          );
        }
      }
    }

    // Prepare update data
    const updateData: Prisma.KeyUpdateInput = {};

    if (updateKeysAndLockDto.keyName !== undefined) {
      updateData.keyName = updateKeysAndLockDto.keyName;
    }

    if (updateKeysAndLockDto.keyType !== undefined) {
      updateData.keyType = updateKeysAndLockDto.keyType;
    }

    if (updateKeysAndLockDto.description !== undefined) {
      updateData.description = updateKeysAndLockDto.description;
    }

    if (updateKeysAndLockDto.keyPhotoUrl !== undefined) {
      updateData.keyPhotoUrl = updateKeysAndLockDto.keyPhotoUrl;
    }

    if (updateKeysAndLockDto.status !== undefined) {
      updateData.status = updateKeysAndLockDto.status;
    }

    if (updateKeysAndLockDto.issuedTo !== undefined) {
      updateData.issuedTo = updateKeysAndLockDto.issuedTo;
    }

    if (updateKeysAndLockDto.issuedDate !== undefined) {
      updateData.issuedDate = updateKeysAndLockDto.issuedDate
        ? new Date(updateKeysAndLockDto.issuedDate)
        : null;
    }

    if (updateKeysAndLockDto.returnedDate !== undefined) {
      updateData.returnedDate = updateKeysAndLockDto.returnedDate
        ? new Date(updateKeysAndLockDto.returnedDate)
        : null;
    }

    // Handle unitId update
    if (updateKeysAndLockDto.unitId !== undefined) {
      if (updateKeysAndLockDto.unitId === null) {
        updateData.unit = {
          disconnect: true,
        };
      } else {
        updateData.unit = {
          connect: { id: updateKeysAndLockDto.unitId },
        };
      }
    }

    // Handle singleUnitDetailId update
    if (updateKeysAndLockDto.singleUnitDetailId !== undefined) {
      if (updateKeysAndLockDto.singleUnitDetailId === null) {
        updateData.singleUnitDetail = {
          disconnect: true,
        };
      } else {
        updateData.singleUnitDetail = {
          connect: { id: updateKeysAndLockDto.singleUnitDetailId },
        };
      }
    }

    const updatedKey = await this.prisma.key.update({
      where: { id },
      data: updateData,
      include: keyInclude as unknown as Prisma.KeyInclude,
    });

    return updatedKey;
  }

  async remove(id: string, userId: string) {
    // Verify that the key exists
    const existingKey = await this.prisma.key.findUnique({
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

    if (!existingKey) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    // Ensure the key belongs to a property owned by the authenticated user
    if (existingKey.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this key',
      );
    }

    // Delete the key
    await this.prisma.key.delete({
      where: { id },
    });

    return {
      message: 'Key deleted successfully',
      key: existingKey,
    };
  }
}
