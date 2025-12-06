import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

const taskInclude = {
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto, userId: string) {
    const data: Prisma.TaskCreateInput = {
      user: {
        connect: { id: userId },
      },
      title: createTaskDto.title,
      status: createTaskDto.status || TaskStatus.OPEN,
      description: createTaskDto.description,
      date: createTaskDto.date ? new Date(createTaskDto.date) : undefined,
      time: createTaskDto.time,
      assignee: createTaskDto.assignee,
      propertyId: createTaskDto.propertyId,
      recurring: createTaskDto.recurring || false,
      frequency: createTaskDto.frequency,
      endDate: createTaskDto.endDate
        ? new Date(createTaskDto.endDate)
        : undefined,
    };

    const task = await this.prisma.task.create({
      data,
      include: taskInclude,
    });

    return task;
  }

  async findAll(userId?: string, filters?: { status?: TaskStatus; propertyId?: string }) {
    const where: Prisma.TaskWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.propertyId) {
      where.propertyId = filters.propertyId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks;
  }

  async findByPropertyId(propertyId: string, userId?: string) {
    const where: Prisma.TaskWhereInput = {
      propertyId,
    };

    if (userId) {
      where.userId = userId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks;
  }

  async findOne(id: string, userId?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Verify user has permission to view this task
    if (userId && task.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this task',
      );
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId?: string) {
    // Verify task exists
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Verify user has permission to update this task
    if (userId && existingTask.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this task',
      );
    }

    // Prepare update data
    const updateData: Prisma.TaskUpdateInput = {};

    if (updateTaskDto.title !== undefined) {
      updateData.title = updateTaskDto.title;
    }

    if (updateTaskDto.status !== undefined) {
      updateData.status = updateTaskDto.status;
    }

    if (updateTaskDto.description !== undefined) {
      updateData.description = updateTaskDto.description;
    }

    if (updateTaskDto.date !== undefined) {
      updateData.date = updateTaskDto.date
        ? new Date(updateTaskDto.date)
        : null;
    }

    if (updateTaskDto.time !== undefined) {
      updateData.time = updateTaskDto.time;
    }

    if (updateTaskDto.assignee !== undefined) {
      updateData.assignee = updateTaskDto.assignee;
    }

    if (updateTaskDto.propertyId !== undefined) {
      updateData.propertyId = updateTaskDto.propertyId;
    }

    if (updateTaskDto.recurring !== undefined) {
      updateData.recurring = updateTaskDto.recurring;
    }

    if (updateTaskDto.frequency !== undefined) {
      updateData.frequency = updateTaskDto.frequency;
    }

    if (updateTaskDto.endDate !== undefined) {
      updateData.endDate = updateTaskDto.endDate
        ? new Date(updateTaskDto.endDate)
        : null;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateData,
      include: taskInclude,
    });

    return updatedTask;
  }

  async remove(id: string, userId?: string) {
    // Verify task exists
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Verify user has permission to delete this task
    if (userId && existingTask.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this task',
      );
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }
}
