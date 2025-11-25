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

@Injectable()
export class LeasingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLeasingDto: CreateLeasingDto) {
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

    // Create the leasing record
    const leasing = await this.prisma.propertyLeasing.create({
      data: {
        propertyId: createLeasingDto.propertyId,
        monthlyRent: new Decimal(createLeasingDto.monthlyRent),
        securityDeposit: createLeasingDto.securityDeposit
          ? new Decimal(createLeasingDto.securityDeposit)
          : null,
        amountRefundable: createLeasingDto.amountRefundable
          ? new Decimal(createLeasingDto.amountRefundable)
          : null,
        dateAvailable: new Date(createLeasingDto.dateAvailable),
        minLeaseDuration: createLeasingDto.minLeaseDuration,
        maxLeaseDuration: createLeasingDto.maxLeaseDuration,
        description: createLeasingDto.description,
        petsAllowed: createLeasingDto.petsAllowed,
        petCategory: createLeasingDto.petCategory ?? [],
        petDeposit: createLeasingDto.petDeposit
          ? new Decimal(createLeasingDto.petDeposit)
          : null,
        petFee: createLeasingDto.petFee
          ? new Decimal(createLeasingDto.petFee)
          : null,
        petDescription: createLeasingDto.petDescription,
        onlineRentalApplication: createLeasingDto.onlineRentalApplication,
        requireApplicationFee: createLeasingDto.requireApplicationFee ?? false,
        applicationFee: createLeasingDto.applicationFee
          ? new Decimal(createLeasingDto.applicationFee)
          : null,
        applicantName: createLeasingDto.applicantName,
        applicantContact: createLeasingDto.applicantContact,
        applicantEmail: createLeasingDto.applicantEmail,
      },
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
    });

    return leasing;
  }

  async findAll() {
    const leasings = await this.prisma.propertyLeasing.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return leasings;
  }

  async findOne(id: string) {
    const leasing = await this.prisma.propertyLeasing.findUnique({
      where: { id },
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
    });

    if (!leasing) {
      throw new NotFoundException(`Leasing with ID ${id} not found`);
    }

    return leasing;
  }

  async findByPropertyId(propertyId: string) {
    const leasing = await this.prisma.propertyLeasing.findUnique({
      where: { propertyId },
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
    });

    if (!leasing) {
      throw new NotFoundException(
        `Leasing for property with ID ${propertyId} not found`,
      );
    }

    return leasing;
  }

  async update(id: string, updateLeasingDto: UpdateLeasingDto) {
    // Verify that the leasing exists
    const existingLeasing = await this.prisma.propertyLeasing.findUnique({
      where: { id },
    });

    if (!existingLeasing) {
      throw new NotFoundException(`Leasing with ID ${id} not found`);
    }

    // If propertyId is being updated, verify that the property exists
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

    // Build update data
    const updateData: Prisma.PropertyLeasingUpdateInput = {};

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

    if (updateLeasingDto.applicantName !== undefined) {
      updateData.applicantName = updateLeasingDto.applicantName;
    }

    if (updateLeasingDto.applicantContact !== undefined) {
      updateData.applicantContact = updateLeasingDto.applicantContact;
    }

    if (updateLeasingDto.applicantEmail !== undefined) {
      updateData.applicantEmail = updateLeasingDto.applicantEmail;
    }

    if (updateLeasingDto.propertyId !== undefined) {
      updateData.property = {
        connect: { id: updateLeasingDto.propertyId },
      };
    }

    // Update the leasing
    const updatedLeasing = await this.prisma.propertyLeasing.update({
      where: { id },
      data: updateData,
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
    });

    return updatedLeasing;
  }

  async remove(id: string) {
    // Verify that the leasing exists
    const existingLeasing = await this.prisma.propertyLeasing.findUnique({
      where: { id },
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
    });

    if (!existingLeasing) {
      throw new NotFoundException(`Leasing with ID ${id} not found`);
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
}
