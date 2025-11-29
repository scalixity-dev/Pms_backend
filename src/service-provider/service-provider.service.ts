import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import {
  Prisma,
  AssignmentStatus,
  MaintenanceStatus,
} from '@prisma/client';

const serviceProviderInclude = {
  assignments: {
    include: {
      request: {
        include: {
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
            select: {
              id: true,
              unitName: true,
            },
          },
          singleUnitDetail: {
            select: {
              id: true,
            },
          },
          equipment: {
            select: {
              id: true,
              category: true,
              brand: true,
              model: true,
            },
          },
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
    orderBy: {
      createdAt: 'desc',
    },
  },
} as const;

@Injectable()
export class ServiceProviderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createServiceProviderDto: CreateServiceProviderDto) {
    const data: Prisma.ServiceProviderCreateInput = {
      photoUrl: createServiceProviderDto.photoUrl,
      firstName: createServiceProviderDto.firstName,
      middleName: createServiceProviderDto.middleName,
      lastName: createServiceProviderDto.lastName,
      phoneNumber: createServiceProviderDto.phoneNumber,
      companyName: createServiceProviderDto.companyName,
      companyWebsite: createServiceProviderDto.companyWebsite,
      faxNumber: createServiceProviderDto.faxNumber,
      email: createServiceProviderDto.email,
      category: createServiceProviderDto.category,
      subcategory: createServiceProviderDto.subcategory,
      address: createServiceProviderDto.address,
      city: createServiceProviderDto.city,
      state: createServiceProviderDto.state,
      zipCode: createServiceProviderDto.zipCode,
      country: createServiceProviderDto.country,
      isActive: createServiceProviderDto.isActive ?? true,
    };

    const serviceProvider = await this.prisma.serviceProvider.create({
      data,
      include: serviceProviderInclude,
    });

    return serviceProvider;
  }

  async findAll(isActive?: boolean) {
    const where: Prisma.ServiceProviderWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const serviceProviders = await this.prisma.serviceProvider.findMany({
      where,
      include: serviceProviderInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return serviceProviders;
  }

  async findByCategory(category: string, isActive?: boolean) {
    const where: Prisma.ServiceProviderWhereInput = {
      category: {
        equals: category,
        mode: 'insensitive',
      },
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const serviceProviders = await this.prisma.serviceProvider.findMany({
      where,
      include: serviceProviderInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return serviceProviders;
  }

  async findOne(id: string) {
    const serviceProvider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: serviceProviderInclude,
    });

    if (!serviceProvider) {
      throw new NotFoundException(
        `Service provider with ID ${id} not found`,
      );
    }

    return serviceProvider;
  }

  async update(
    id: string,
    updateServiceProviderDto: UpdateServiceProviderDto,
  ) {
    // Verify service provider exists
    const existingProvider = await this.prisma.serviceProvider.findUnique({
      where: { id },
    });

    if (!existingProvider) {
      throw new NotFoundException(
        `Service provider with ID ${id} not found`,
      );
    }

    // Prepare update data
    const updateData: Prisma.ServiceProviderUpdateInput = {};

    if (updateServiceProviderDto.photoUrl !== undefined) {
      updateData.photoUrl = updateServiceProviderDto.photoUrl;
    }

    if (updateServiceProviderDto.firstName !== undefined) {
      updateData.firstName = updateServiceProviderDto.firstName;
    }

    if (updateServiceProviderDto.middleName !== undefined) {
      updateData.middleName = updateServiceProviderDto.middleName;
    }

    if (updateServiceProviderDto.lastName !== undefined) {
      updateData.lastName = updateServiceProviderDto.lastName;
    }

    if (updateServiceProviderDto.phoneNumber !== undefined) {
      updateData.phoneNumber = updateServiceProviderDto.phoneNumber;
    }

    if (updateServiceProviderDto.companyName !== undefined) {
      updateData.companyName = updateServiceProviderDto.companyName;
    }

    if (updateServiceProviderDto.companyWebsite !== undefined) {
      updateData.companyWebsite = updateServiceProviderDto.companyWebsite;
    }

    if (updateServiceProviderDto.faxNumber !== undefined) {
      updateData.faxNumber = updateServiceProviderDto.faxNumber;
    }

    if (updateServiceProviderDto.email !== undefined) {
      updateData.email = updateServiceProviderDto.email;
    }

    if (updateServiceProviderDto.category !== undefined) {
      updateData.category = updateServiceProviderDto.category;
    }

    if (updateServiceProviderDto.subcategory !== undefined) {
      updateData.subcategory = updateServiceProviderDto.subcategory;
    }

    if (updateServiceProviderDto.address !== undefined) {
      updateData.address = updateServiceProviderDto.address;
    }

    if (updateServiceProviderDto.city !== undefined) {
      updateData.city = updateServiceProviderDto.city;
    }

    if (updateServiceProviderDto.state !== undefined) {
      updateData.state = updateServiceProviderDto.state;
    }

    if (updateServiceProviderDto.zipCode !== undefined) {
      updateData.zipCode = updateServiceProviderDto.zipCode;
    }

    if (updateServiceProviderDto.country !== undefined) {
      updateData.country = updateServiceProviderDto.country;
    }

    if (updateServiceProviderDto.isActive !== undefined) {
      updateData.isActive = updateServiceProviderDto.isActive;
    }

    const updatedProvider = await this.prisma.serviceProvider.update({
      where: { id },
      data: updateData,
      include: serviceProviderInclude,
    });

    return updatedProvider;
  }

  async remove(id: string) {
    // Verify service provider exists
    const existingProvider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: {
        assignments: {
          where: {
            status: {
              in: [
                AssignmentStatus.ASSIGNED,
                AssignmentStatus.VENDOR_NOTIFIED,
                AssignmentStatus.IN_PROGRESS,
              ],
            },
          },
        },
      },
    });

    if (!existingProvider) {
      throw new NotFoundException(
        `Service provider with ID ${id} not found`,
      );
    }

    // Check if service provider has active assignments
    if (existingProvider.assignments.length > 0) {
      throw new BadRequestException(
        'Cannot delete service provider with active maintenance assignments. Please complete or cancel all active assignments first.',
      );
    }

    await this.prisma.serviceProvider.delete({
      where: { id },
    });

    return { message: 'Service provider deleted successfully' };
  }

  // Maintenance Assignment Methods

  async getAssignments(serviceProviderId: string, status?: AssignmentStatus) {
    // Verify service provider exists
    const serviceProvider = await this.prisma.serviceProvider.findUnique({
      where: { id: serviceProviderId },
    });

    if (!serviceProvider) {
      throw new NotFoundException(
        `Service provider with ID ${serviceProviderId} not found`,
      );
    }

    const where: Prisma.MaintenanceAssignmentWhereInput = {
      serviceProviderId,
    };

    if (status) {
      where.status = status;
    }

    const assignments = await this.prisma.maintenanceAssignment.findMany({
      where,
      include: {
        request: {
          include: {
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
              select: {
                id: true,
                unitName: true,
              },
            },
            singleUnitDetail: {
              select: {
                id: true,
              },
            },
            equipment: {
              select: {
                id: true,
                category: true,
                brand: true,
                model: true,
              },
            },
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return assignments;
  }

  async assignToMaintenanceRequest(
    serviceProviderId: string,
    requestId: string,
    scheduledDate?: Date,
    notes?: string,
    userId?: string,
  ) {
    // Verify service provider exists
    const serviceProvider = await this.prisma.serviceProvider.findUnique({
      where: { id: serviceProviderId },
    });

    if (!serviceProvider) {
      throw new NotFoundException(
        `Service provider with ID ${serviceProviderId} not found`,
      );
    }

    if (!serviceProvider.isActive) {
      throw new BadRequestException(
        'Cannot assign inactive service provider to maintenance request',
      );
    }

    // Verify maintenance request exists
    const maintenanceRequest =
      await this.prisma.maintenanceRequest.findUnique({
        where: { id: requestId },
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

    if (!maintenanceRequest) {
      throw new NotFoundException(
        `Maintenance request with ID ${requestId} not found`,
      );
    }

    // Verify user has permission to assign to this maintenance request
    if (userId && maintenanceRequest.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to assign service provider to this maintenance request',
      );
    }

    // Check if service provider is already assigned to this request
    const existingAssignment =
      await this.prisma.maintenanceAssignment.findFirst({
        where: {
          requestId,
          serviceProviderId,
          status: {
            in: [
              AssignmentStatus.ASSIGNED,
              AssignmentStatus.VENDOR_NOTIFIED,
              AssignmentStatus.IN_PROGRESS,
            ],
          },
        },
      });

    if (existingAssignment) {
      throw new BadRequestException(
        'Service provider is already assigned to this maintenance request',
      );
    }

    // Create assignment
    const assignment = await this.prisma.maintenanceAssignment.create({
      data: {
        request: {
          connect: { id: requestId },
        },
        serviceProvider: {
          connect: { id: serviceProviderId },
        },
        scheduledDate: scheduledDate,
        status: AssignmentStatus.ASSIGNED,
        notes: notes,
        ...(userId && {
          assignedToUser: {
            connect: { id: userId },
          },
        }),
      },
      include: {
        request: {
          include: {
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
          },
        },
        serviceProvider: true,
        assignedToUser: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Update maintenance request status to ASSIGNED if it's NEW or IN_REVIEW
    if (
      maintenanceRequest.status === MaintenanceStatus.NEW ||
      maintenanceRequest.status === MaintenanceStatus.IN_REVIEW
    ) {
      await this.prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: MaintenanceStatus.ASSIGNED,
        },
      });
    }

    return assignment;
  }

  async updateAssignmentStatus(
    serviceProviderId: string,
    assignmentId: string,
    status: AssignmentStatus,
    notes?: string,
  ) {
    // Verify service provider exists
    const serviceProvider = await this.prisma.serviceProvider.findUnique({
      where: { id: serviceProviderId },
    });

    if (!serviceProvider) {
      throw new NotFoundException(
        `Service provider with ID ${serviceProviderId} not found`,
      );
    }

    // Verify assignment exists and belongs to this service provider
    const assignment = await this.prisma.maintenanceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        request: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${assignmentId} not found`,
      );
    }

    if (assignment.serviceProviderId !== serviceProviderId) {
      throw new ForbiddenException(
        'This assignment does not belong to the specified service provider',
      );
    }

    // Update assignment
    const updatedAssignment = await this.prisma.maintenanceAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        ...(notes !== undefined && { notes }),
      },
      include: {
        request: {
          include: {
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
          },
        },
        serviceProvider: true,
        assignedToUser: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Update maintenance request status if assignment is completed
    // Only mark request as COMPLETED when all assignments are COMPLETED
    if (status === AssignmentStatus.COMPLETED) {
      await this.prisma.$transaction(async (tx) => {
        // Count assignments with status != COMPLETED for this request
        const activeAssignmentsCount = await tx.maintenanceAssignment.count({
          where: {
            requestId: assignment.requestId,
            status: {
              not: AssignmentStatus.COMPLETED,
            },
          },
        });

        // Only update the request if no active assignments remain
        if (activeAssignmentsCount === 0) {
          await tx.maintenanceRequest.update({
            where: { id: assignment.requestId },
            data: {
              status: MaintenanceStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
        }
      });
    }

    return updatedAssignment;
  }

  async removeAssignment(
    serviceProviderId: string,
    assignmentId: string,
    userId?: string,
  ) {
    // Verify service provider exists
    const serviceProvider = await this.prisma.serviceProvider.findUnique({
      where: { id: serviceProviderId },
    });

    if (!serviceProvider) {
      throw new NotFoundException(
        `Service provider with ID ${serviceProviderId} not found`,
      );
    }

    // Verify assignment exists and belongs to this service provider
    const assignment = await this.prisma.maintenanceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        request: {
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
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${assignmentId} not found`,
      );
    }

    if (assignment.serviceProviderId !== serviceProviderId) {
      throw new ForbiddenException(
        'This assignment does not belong to the specified service provider',
      );
    }

    // Verify user has permission (must be the manager of the property)
    if (userId && assignment.request.property.manager.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to remove this assignment',
      );
    }

    await this.prisma.maintenanceAssignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Assignment removed successfully' };
  }
}
