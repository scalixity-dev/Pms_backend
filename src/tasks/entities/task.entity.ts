import { TaskStatus, TaskFrequency } from '@prisma/client';

export class Task {
  id: string;
  userId: string;
  title: string;
  status: TaskStatus;
  description?: string;
  date?: Date;
  time?: string;
  assignee?: string;
  propertyId?: string;
  recurring: boolean;
  frequency?: TaskFrequency;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
