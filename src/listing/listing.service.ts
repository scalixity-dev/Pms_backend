import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

const listingInclude = {
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
      amenities: true,
      photos: true,
      singleUnitDetails: {
        include: {
          amenities: true,
        },
      },
      leasing: {
        include: {
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
    },
  },
  unit: {
    include: {
      amenities: true,
    },
  },
} as const;

@Injectable()
export class ListingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a listing from a property
   * This will:
   * 1. Verify the property exists and user has permission
   * 2. Fetch property and leasing data
   * 3. Create a Listing record
   * 4. Update Property status to ACTIVE
   */
  async create(createListingDto: CreateListingDto, userId?: string) {
    // Verify that the property exists
    const property = await this.prisma.property.findUnique({
      where: { id: createListingDto.propertyId },
      include: {
        leasing: true,
        units: true,
        singleUnitDetails: true,
      },
    });

    if (!property) {
      throw new NotFoundException(
        `Property with ID ${createListingDto.propertyId} not found`,
      );
    }

    // Check if user has permission
    if (userId && property.managerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to create a listing for this property',
      );
    }

    // Verify that leasing exists for this property
    if (!property.leasing) {
      throw new BadRequestException(
        `Leasing must be created before creating a listing for property ${createListingDto.propertyId}`,
      );
    }

    const leasing = property.leasing;

    // Determine listing type based on property type
    const listingType =
      createListingDto.listingType ||
      (property.propertyType === 'MULTI' ? 'UNIT' : 'ENTIRE_PROPERTY');

    // Determine unitId - enforce explicit selection for MULTI properties
    let unitId = createListingDto.unitId;
    if (property.propertyType === 'MULTI') {
      // For MULTI properties, unitId must be explicitly provided
      if (!unitId) {
        // Check if there are any units available
        if (!property.units || property.units.length === 0) {
          throw new BadRequestException(
            `Cannot create listing for MULTI property ${createListingDto.propertyId}: property has no units. Please create units first.`,
          );
        }
        
        // Only auto-assign if there is exactly one unit
        if (property.units.length === 1) {
          unitId = property.units[0].id;
        } else {
          // Multiple units exist - require explicit selection
          throw new BadRequestException(
            `unitId is required for MULTI property ${createListingDto.propertyId}. This property has ${property.units.length} unit(s). Please specify which unit to list.`,
          );
        }
      } else {
        // Validate that the provided unitId exists for this property
        const unitExists = property.units.some(unit => unit.id === unitId);
        if (!unitExists) {
          throw new BadRequestException(
            `Unit with ID ${unitId} does not belong to property ${createListingDto.propertyId}`,
          );
        }
      }
    }

    // Build listing data from property and leasing
    const listingData: Prisma.ListingUncheckedCreateInput = {
      propertyId: property.id,
      unitId: unitId || null,
      listingType: listingType as any,
      listingStatus: createListingDto.listingStatus || 'ACTIVE',
      occupancyStatus: createListingDto.occupancyStatus || 'VACANT',
      visibility: createListingDto.visibility || 'PUBLIC',
      // Pricing from leasing (can be overridden by DTO)
      listingPrice: createListingDto.listingPrice !== undefined
        ? (createListingDto.listingPrice !== null
            ? new Decimal(createListingDto.listingPrice)
            : null)
        : null,
      monthlyRent: createListingDto.monthlyRent
        ? new Decimal(createListingDto.monthlyRent)
        : leasing.monthlyRent,
      securityDeposit: createListingDto.securityDeposit !== undefined
        ? (createListingDto.securityDeposit !== null
            ? new Decimal(createListingDto.securityDeposit)
            : null)
        : leasing.securityDeposit,
      amountRefundable: createListingDto.amountRefundable !== undefined
        ? (createListingDto.amountRefundable !== null
            ? new Decimal(createListingDto.amountRefundable)
            : null)
        : leasing.amountRefundable,
      minLeaseDuration: createListingDto.minLeaseDuration || leasing.minLeaseDuration,
      maxLeaseDuration: createListingDto.maxLeaseDuration || leasing.maxLeaseDuration,
      // Availability dates
      availableFrom: createListingDto.availableFrom
        ? new Date(createListingDto.availableFrom)
        : leasing.dateAvailable,
      expiresAt: createListingDto.expiresAt
        ? new Date(createListingDto.expiresAt)
        : null,
      // Pet information
      petsAllowed: createListingDto.petsAllowed !== undefined
        ? createListingDto.petsAllowed
        : leasing.petsAllowed,
      petCategory: createListingDto.petCategory || leasing.petCategory || [],
      // Application information
      applicationFee: createListingDto.applicationFee !== undefined
        ? (createListingDto.applicationFee !== null
            ? new Decimal(createListingDto.applicationFee)
            : null)
        : (leasing.applicationFee || null),
      onlineApplicationAvailable:
        createListingDto.onlineApplicationAvailable !== undefined
          ? createListingDto.onlineApplicationAvailable
          : leasing.onlineRentalApplication,
      // Listing metadata
      title: createListingDto.title || property.propertyName,
      description: createListingDto.description || property.description || leasing.description || null,
      isActive: createListingDto.isActive !== undefined ? createListingDto.isActive : true,
      // External metadata
      externalListingUrl: createListingDto.externalListingUrl || null,
      source: createListingDto.source || null,
    };

    // Create listing and update property status in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the listing
      const listing = await tx.listing.create({
        data: listingData,
        include: listingInclude as Prisma.ListingInclude,
      });

      // Update property status to ACTIVE
      await tx.property.update({
        where: { id: property.id },
        data: { status: 'ACTIVE' },
      });

      return listing;
    });

    return result;
  }

  async findAll(userId?: string) {
    const listings = await this.prisma.listing.findMany({
      where: userId
        ? {
            property: {
              managerId: userId,
            },
          }
        : undefined,
      include: listingInclude as Prisma.ListingInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return listings;
  }

  async findOne(id: string, userId?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude as Prisma.ListingInclude,
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    if (userId && listing.property.managerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to access this listing',
      );
    }

    return listing;
  }

  async findByPropertyId(propertyId: string, userId?: string) {
    const listings = await this.prisma.listing.findMany({
      where: { propertyId },
      include: listingInclude as Prisma.ListingInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (listings.length === 0) {
      return [];
    }

    // Check permission
    if (userId && listings[0].property.managerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to access listings for this property',
      );
    }

    return listings;
  }

  async update(id: string, updateListingDto: UpdateListingDto, userId?: string) {
    // Verify that the listing exists
    const existingListing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!existingListing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    // Check permission
    if (userId && existingListing.property.managerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to update this listing',
      );
    }

    // Build update data
    const updateData: Prisma.ListingUncheckedUpdateInput = {};

    if (updateListingDto.listingStatus !== undefined) {
      updateData.listingStatus = updateListingDto.listingStatus as any;
    }

    if (updateListingDto.occupancyStatus !== undefined) {
      updateData.occupancyStatus = updateListingDto.occupancyStatus as any;
    }

    if (updateListingDto.visibility !== undefined) {
      updateData.visibility = updateListingDto.visibility as any;
    }

    if (updateListingDto.listingPrice !== undefined) {
      updateData.listingPrice =
        updateListingDto.listingPrice !== null
          ? new Decimal(updateListingDto.listingPrice)
          : null;
    }

    if (updateListingDto.monthlyRent !== undefined) {
      updateData.monthlyRent =
        updateListingDto.monthlyRent !== null
          ? new Decimal(updateListingDto.monthlyRent)
          : null;
    }

    if (updateListingDto.securityDeposit !== undefined) {
      updateData.securityDeposit =
        updateListingDto.securityDeposit !== null
          ? new Decimal(updateListingDto.securityDeposit)
          : null;
    }

    if (updateListingDto.amountRefundable !== undefined) {
      updateData.amountRefundable =
        updateListingDto.amountRefundable !== null
          ? new Decimal(updateListingDto.amountRefundable)
          : null;
    }

    if (updateListingDto.minLeaseDuration !== undefined) {
      updateData.minLeaseDuration = updateListingDto.minLeaseDuration as any;
    }

    if (updateListingDto.maxLeaseDuration !== undefined) {
      updateData.maxLeaseDuration = updateListingDto.maxLeaseDuration as any;
    }

    if (updateListingDto.availableFrom !== undefined) {
      updateData.availableFrom = updateListingDto.availableFrom
        ? new Date(updateListingDto.availableFrom)
        : null;
    }

    if (updateListingDto.expiresAt !== undefined) {
      updateData.expiresAt = updateListingDto.expiresAt
        ? new Date(updateListingDto.expiresAt)
        : null;
    }

    if (updateListingDto.isActive !== undefined) {
      updateData.isActive = updateListingDto.isActive;
    }

    if (updateListingDto.petsAllowed !== undefined) {
      updateData.petsAllowed = updateListingDto.petsAllowed;
    }

    if (updateListingDto.petCategory !== undefined) {
      updateData.petCategory = updateListingDto.petCategory;
    }

    if (updateListingDto.applicationFee !== undefined) {
      updateData.applicationFee =
        updateListingDto.applicationFee !== null
          ? new Decimal(updateListingDto.applicationFee)
          : null;
    }

    if (updateListingDto.onlineApplicationAvailable !== undefined) {
      updateData.onlineApplicationAvailable =
        updateListingDto.onlineApplicationAvailable;
    }

    if (updateListingDto.title !== undefined) {
      updateData.title = updateListingDto.title;
    }

    if (updateListingDto.description !== undefined) {
      updateData.description = updateListingDto.description;
    }

    if (updateListingDto.externalListingUrl !== undefined) {
      updateData.externalListingUrl = updateListingDto.externalListingUrl;
    }

    if (updateListingDto.source !== undefined) {
      updateData.source = updateListingDto.source;
    }

    // Update the listing
    const updatedListing = await this.prisma.listing.update({
      where: { id },
      data: updateData,
      include: listingInclude as Prisma.ListingInclude,
    });

    return updatedListing;
  }

  async remove(id: string, userId?: string) {
    // Verify that the listing exists
    const existingListing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!existingListing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    // Check permission
    if (userId && existingListing.property.managerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to delete this listing',
      );
    }

    // Delete the listing
    await this.prisma.listing.delete({
      where: { id },
    });

    return {
      message: 'Listing deleted successfully',
      listing: existingListing,
    };
  }
}

