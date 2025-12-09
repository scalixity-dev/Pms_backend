import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, ApplicationStatus } from '@prisma/client';

const applicationInclude = {
  leasing: {
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
        include: {
          amenities: true,
        },
      },
      singleUnitDetail: {
        include: {
          amenities: true,
        },
      },
    },
  },
  invitedBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  applicants: true,
  occupants: true,
  pets: true,
  vehicles: true,
  residenceHistory: true,
  incomeDetails: true,
  emergencyContacts: true,
  referenceContacts: true,
  backgroundQuestions: true,
} as const;

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(createApplicationDto: CreateApplicationDto, userId?: string) {
    // Verify that the leasing exists
    const leasing = await this.prisma.propertyLeasing.findUnique({
      where: { id: createApplicationDto.leasingId },
      include: {
        property: {
          select: {
            managerId: true,
          },
        },
      },
    });

    if (!leasing) {
      throw new NotFoundException(
        `Leasing with ID ${createApplicationDto.leasingId} not found`,
      );
    }

    // If userId is provided, verify permission to create application for this leasing
    if (userId && leasing.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to create applications for this property',
      );
    }

    // If invitedById is provided, verify the user exists and is a property manager
    if (createApplicationDto.invitedById) {
      const inviter = await this.prisma.user.findUnique({
        where: { id: createApplicationDto.invitedById },
      });

      if (!inviter) {
        throw new NotFoundException(
          `User with ID ${createApplicationDto.invitedById} not found`,
        );
      }
    }

    // Ensure at least one applicant is marked as primary
    const hasPrimary = createApplicationDto.applicants.some(
      (app) => app.isPrimary === true,
    );
    if (!hasPrimary) {
      createApplicationDto.applicants[0].isPrimary = true;
    }

    // Create application with all related data
    const application = await this.prisma.application.create({
      data: {
        leasingId: createApplicationDto.leasingId,
        invitedById: createApplicationDto.invitedById ?? null,
        status: (createApplicationDto.status as ApplicationStatus) ?? ApplicationStatus.DRAFT,
        moveInDate: new Date(createApplicationDto.moveInDate),
        bio: createApplicationDto.bio,
        imageUrl: createApplicationDto.imageUrl,
        applicants: {
          create: createApplicationDto.applicants.map((applicant) => ({
            firstName: applicant.firstName,
            middleName: applicant.middleName,
            lastName: applicant.lastName,
            email: applicant.email,
            phoneNumber: applicant.phoneNumber,
            dateOfBirth: new Date(applicant.dateOfBirth),
            isPrimary: applicant.isPrimary ?? false,
          })),
        },
        occupants: createApplicationDto.occupants
          ? {
              create: createApplicationDto.occupants.map((occupant) => ({
                name: occupant.name,
                email: occupant.email,
                phoneNumber: occupant.phoneNumber,
                dateOfBirth: new Date(occupant.dateOfBirth),
                relationship: occupant.relationship,
              })),
            }
          : undefined,
        pets: createApplicationDto.pets
          ? {
              create: createApplicationDto.pets.map((pet) => ({
                type: pet.type,
                name: pet.name,
                weight:
                  pet.weight !== undefined && pet.weight !== null
                    ? new Decimal(pet.weight)
                    : null,
                breed: pet.breed,
                photoUrl: pet.photoUrl,
              })),
            }
          : undefined,
        vehicles: createApplicationDto.vehicles
          ? {
              create: createApplicationDto.vehicles.map((vehicle) => ({
                type: vehicle.type,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
                licensePlate: vehicle.licensePlate,
                registeredIn: vehicle.registeredIn,
              })),
            }
          : undefined,
        residenceHistory: createApplicationDto.residenceHistory
          ? {
              create: createApplicationDto.residenceHistory.map((residence) => ({
                residenceType: residence.residenceType,
                monthlyRent:
                  residence.monthlyRent !== undefined &&
                  residence.monthlyRent !== null
                    ? new Decimal(residence.monthlyRent)
                    : null,
                moveInDate: new Date(residence.moveInDate),
                moveOutDate: residence.moveOutDate
                  ? new Date(residence.moveOutDate)
                  : null,
                landlordName: residence.landlordName,
                landlordEmail: residence.landlordEmail,
                landlordPhone: residence.landlordPhone,
                address: residence.address,
                city: residence.city,
                state: residence.state,
                zipCode: residence.zipCode,
                country: residence.country,
                additionalInfo: residence.additionalInfo,
              })),
            }
          : undefined,
        incomeDetails: createApplicationDto.incomeDetails
          ? {
              create: createApplicationDto.incomeDetails.map((income) => ({
                incomeType: income.incomeType,
                companyName: income.companyName,
                positionTitle: income.positionTitle,
                startDate: new Date(income.startDate),
                monthlyIncome: new Decimal(income.monthlyIncome),
                officeAddress: income.officeAddress,
                supervisorName: income.supervisorName,
                supervisorPhone: income.supervisorPhone,
                additionalInfo: income.additionalInfo,
              })),
            }
          : undefined,
        emergencyContacts: createApplicationDto.emergencyContacts
          ? {
              create: createApplicationDto.emergencyContacts.map((contact) => ({
                contactName: contact.contactName,
                phoneNumber: contact.phoneNumber,
                email: contact.email,
                relationship: contact.relationship,
                details: contact.details,
              })),
            }
          : undefined,
        referenceContacts: createApplicationDto.referenceContacts
          ? {
              create: createApplicationDto.referenceContacts.map((contact) => ({
                contactName: contact.contactName,
                phoneNumber: contact.phoneNumber,
                email: contact.email,
                relationship: contact.relationship,
                yearsKnown: contact.yearsKnown,
              })),
            }
          : undefined,
        backgroundQuestions: createApplicationDto.backgroundQuestions
          ? {
              create: {
                smoke: createApplicationDto.backgroundQuestions.smoke,
                militaryMember:
                  createApplicationDto.backgroundQuestions.militaryMember,
                criminalRecord:
                  createApplicationDto.backgroundQuestions.criminalRecord,
                bankruptcy: createApplicationDto.backgroundQuestions.bankruptcy,
                refusedRent:
                  createApplicationDto.backgroundQuestions.refusedRent,
                evicted: createApplicationDto.backgroundQuestions.evicted,
              },
            }
          : undefined,
      },
      include: applicationInclude as Prisma.ApplicationInclude,
    });

    const leasingForCache = await this.prisma.propertyLeasing.findUnique({
      where: { id: application.leasingId },
      select: { property: { select: { managerId: true } } },
    });

    if (leasingForCache?.property.managerId) {
      await this.cache.invalidateApplication(leasingForCache.property.managerId, application.id, application.leasingId);
    }

    const cacheKey = this.cache.applicationDetailKey(application.id);
    await this.cache.set(cacheKey, application, this.cache.getTTL('APPLICATION_DETAIL'));

    return application;
  }

  async findAll(userId?: string) {
    const cacheKey = this.cache.applicationListKey(userId);
    const ttl = this.cache.getTTL('APPLICATION_LIST');

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const where: Prisma.ApplicationWhereInput = {};

        if (userId) {
          where.leasing = {
            property: {
              managerId: userId,
            },
          };
        }

        const applications = await this.prisma.application.findMany({
          where,
          include: applicationInclude as Prisma.ApplicationInclude,
          orderBy: {
            createdAt: 'desc',
          },
        });

        return applications;
      },
      ttl,
    );
  }

  async findByLeasingId(leasingId: string, userId?: string) {
    const leasing = await this.prisma.propertyLeasing.findUnique({
      where: { id: leasingId },
      include: {
        property: {
          select: {
            managerId: true,
          },
        },
      },
    });

    if (!leasing) {
      throw new NotFoundException(`Leasing with ID ${leasingId} not found`);
    }

    if (userId && leasing.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access applications for this property',
      );
    }

    const cacheKey = this.cache.applicationListKey(userId, leasingId);
    const ttl = this.cache.getTTL('APPLICATION_LIST');

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const applications = await this.prisma.application.findMany({
          where: { leasingId },
          include: applicationInclude as Prisma.ApplicationInclude,
          orderBy: {
            createdAt: 'desc',
          },
        });

        return applications;
      },
      ttl,
    );
  }

  async findOne(id: string, userId?: string) {
    const cacheKey = this.cache.applicationDetailKey(id);
    const ttl = this.cache.getTTL('APPLICATION_DETAIL');

    const application = await this.cache.getOrSet(
      cacheKey,
      async () => {
        const application = await this.prisma.application.findUnique({
          where: { id },
          include: applicationInclude as Prisma.ApplicationInclude,
        });

        if (!application) {
          throw new NotFoundException(`Application with ID ${id} not found`);
        }

        return application;
      },
      ttl,
    );

    if (userId) {
      const leasing = await this.prisma.propertyLeasing.findUnique({
        where: { id: application.leasingId },
        include: {
          property: {
            select: {
              managerId: true,
            },
          },
        },
      });

      if (leasing && leasing.property.managerId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to access this application',
        );
      }
    }

    return application;
  }

  async update(
    id: string,
    updateApplicationDto: UpdateApplicationDto,
    userId?: string,
  ) {
    // Verify that the application exists
    const existingApplication = await this.prisma.application.findUnique({
      where: { id },
      include: {
        leasing: {
          include: {
            property: {
              select: {
                managerId: true,
              },
            },
          },
        },
      },
    });

    if (!existingApplication) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    // If userId is provided, verify permission
    if (userId && existingApplication.leasing.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this application',
      );
    }

    // If leasingId is being updated, verify it exists
    if (updateApplicationDto.leasingId) {
      const leasing = await this.prisma.propertyLeasing.findUnique({
        where: { id: updateApplicationDto.leasingId },
        include: {
          property: {
            select: { managerId: true },
          },
        },
      });

      if (!leasing) {
        throw new NotFoundException(
          `Leasing with ID ${updateApplicationDto.leasingId} not found`,
        );
      }
      if (userId && leasing.property.managerId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to move this application to that leasing',
        );
      }
    }

    // Build update data
    const updateData: Prisma.ApplicationUncheckedUpdateInput = {};

    if (updateApplicationDto.leasingId !== undefined) {
      updateData.leasingId = updateApplicationDto.leasingId;
    }

    if (updateApplicationDto.invitedById !== undefined) {
      updateData.invitedById = updateApplicationDto.invitedById;
    }

    if (updateApplicationDto.status !== undefined) {
      updateData.status = updateApplicationDto.status;
    }

    if (updateApplicationDto.moveInDate !== undefined) {
      updateData.moveInDate = new Date(updateApplicationDto.moveInDate);
    }

    if (updateApplicationDto.bio !== undefined) {
      updateData.bio = updateApplicationDto.bio;
    }

    if (updateApplicationDto.imageUrl !== undefined) {
      updateData.imageUrl = updateApplicationDto.imageUrl;
    }

    // Update nested relations
    if (updateApplicationDto.applicants) {
      // Delete existing applicants and create new ones
      await this.prisma.applicant.deleteMany({
        where: { applicationId: id },
      });
      updateData.applicants = {
        create: updateApplicationDto.applicants.map((applicant) => ({
          firstName: applicant.firstName,
          middleName: applicant.middleName,
          lastName: applicant.lastName,
          email: applicant.email,
          phoneNumber: applicant.phoneNumber,
          dateOfBirth: new Date(applicant.dateOfBirth),
          isPrimary: applicant.isPrimary ?? false,
        })),
      };
    }

    if (updateApplicationDto.occupants !== undefined) {
      await this.prisma.occupant.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.occupants.length > 0) {
        (updateData as any).occupants = {
          create: updateApplicationDto.occupants.map((occupant) => ({
            name: occupant.name,
            email: occupant.email,
            phoneNumber: occupant.phoneNumber,
            dateOfBirth: new Date(occupant.dateOfBirth),
            relationship: occupant.relationship,
          })),
        };
      }
    }

    if (updateApplicationDto.pets !== undefined) {
      await this.prisma.pet.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.pets.length > 0) {
        (updateData as any).pets = {
          create: updateApplicationDto.pets.map((pet) => ({
            type: pet.type,
            name: pet.name,
            weight:
              pet.weight !== undefined && pet.weight !== null
                ? new Decimal(pet.weight)
                : null,
            breed: pet.breed,
            photoUrl: pet.photoUrl,
          })),
        };
      }
    }

    if (updateApplicationDto.vehicles !== undefined) {
      await this.prisma.vehicle.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.vehicles.length > 0) {
        (updateData as any).vehicles = {
          create: updateApplicationDto.vehicles.map((vehicle) => ({
            type: vehicle.type,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            licensePlate: vehicle.licensePlate,
            registeredIn: vehicle.registeredIn,
          })),
        };
      }
    }

    if (updateApplicationDto.residenceHistory !== undefined) {
      await this.prisma.residenceHistory.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.residenceHistory.length > 0) {
        (updateData as any).residenceHistory = {
          create: updateApplicationDto.residenceHistory.map((residence) => ({
            residenceType: residence.residenceType,
            monthlyRent:
              residence.monthlyRent !== undefined &&
              residence.monthlyRent !== null
                ? new Decimal(residence.monthlyRent)
                : null,
            moveInDate: new Date(residence.moveInDate),
            moveOutDate: residence.moveOutDate
              ? new Date(residence.moveOutDate)
              : null,
            landlordName: residence.landlordName,
            landlordEmail: residence.landlordEmail,
            landlordPhone: residence.landlordPhone,
            address: residence.address,
            city: residence.city,
            state: residence.state,
            zipCode: residence.zipCode,
            country: residence.country,
            additionalInfo: residence.additionalInfo,
          })),
        };
      }
    }

    if (updateApplicationDto.incomeDetails !== undefined) {
      await this.prisma.incomeDetail.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.incomeDetails.length > 0) {
        (updateData as any).incomeDetails = {
          create: updateApplicationDto.incomeDetails.map((income) => ({
            incomeType: income.incomeType,
            companyName: income.companyName,
            positionTitle: income.positionTitle,
            startDate: new Date(income.startDate),
            monthlyIncome: new Decimal(income.monthlyIncome),
            officeAddress: income.officeAddress,
            supervisorName: income.supervisorName,
            supervisorPhone: income.supervisorPhone,
            additionalInfo: income.additionalInfo,
          })),
        };
      }
    }

    if (updateApplicationDto.emergencyContacts !== undefined) {
      await this.prisma.emergencyContact.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.emergencyContacts.length > 0) {
        (updateData as any).emergencyContacts = {
          create: updateApplicationDto.emergencyContacts.map((contact) => ({
            contactName: contact.contactName,
            phoneNumber: contact.phoneNumber,
            email: contact.email,
            relationship: contact.relationship,
            details: contact.details,
          })),
        };
      }
    }

    if (updateApplicationDto.referenceContacts !== undefined) {
      await this.prisma.referenceContact.deleteMany({
        where: { applicationId: id },
      });
      if (updateApplicationDto.referenceContacts.length > 0) {
        (updateData as any).referenceContacts = {
          create: updateApplicationDto.referenceContacts.map((contact) => ({
            contactName: contact.contactName,
            phoneNumber: contact.phoneNumber,
            email: contact.email,
            relationship: contact.relationship,
            yearsKnown: contact.yearsKnown,
          })),
        };
      }
    }

    if (updateApplicationDto.backgroundQuestions !== undefined) {
      // Delete existing if exists, then create new
      await this.prisma.backgroundQuestion.deleteMany({
        where: { applicationId: id },
      });
      (updateData as any).backgroundQuestions = {
        create: {
          smoke: updateApplicationDto.backgroundQuestions.smoke,
          militaryMember:
            updateApplicationDto.backgroundQuestions.militaryMember,
          criminalRecord:
            updateApplicationDto.backgroundQuestions.criminalRecord,
          bankruptcy: updateApplicationDto.backgroundQuestions.bankruptcy,
          refusedRent: updateApplicationDto.backgroundQuestions.refusedRent,
          evicted: updateApplicationDto.backgroundQuestions.evicted,
        },
      };
    }

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: updateData,
      include: applicationInclude as Prisma.ApplicationInclude,
    });

    if (userId) {
      await this.cache.invalidateApplication(userId, id, updatedApplication.leasingId);
    }

    const cacheKey = this.cache.applicationDetailKey(id);
    await this.cache.set(cacheKey, updatedApplication, this.cache.getTTL('APPLICATION_DETAIL'));

    return updatedApplication;
  }

  async remove(id: string, userId?: string) {
    // Verify that the application exists
    const existingApplication = await this.prisma.application.findUnique({
      where: { id },
      include: {
        leasing: {
          include: {
            property: {
              select: {
                managerId: true,
              },
            },
          },
        },
      },
    });

    if (!existingApplication) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    // If userId is provided, verify permission
    if (userId && existingApplication.leasing.property.managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this application',
      );
    }

    await this.prisma.application.delete({
      where: { id },
    });

    if (userId) {
      await this.cache.invalidateApplication(userId, id, existingApplication.leasingId);
    }

    return {
      message: 'Application deleted successfully',
      application: existingApplication,
    };
  }
}
