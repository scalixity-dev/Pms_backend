# Upload Service Setup Guide

## Installation

Install the required AWS SDK packages:

```bash
cd pms_backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D @types/multer
```

## Environment Variables

Add these to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

## S3 Bucket Setup

1. Create an S3 bucket in AWS Console
2. Configure bucket permissions:
   - Enable public read access for uploaded files (or use presigned URLs for private files)
   - Set CORS configuration to allow uploads from your frontend domain
3. Create an IAM user with S3 permissions:
   - `s3:PutObject` - for uploading files
   - `s3:DeleteObject` - for deleting files
   - `s3:GetObject` - for reading files (if using presigned URLs)

## API Endpoints

### Upload File
**POST** `/upload/file`
- **Body (form-data):**
  - `file`: The file to upload
  - `category`: `IMAGE`, `VIDEO`, or `DOCUMENT`
  - `propertyId` (optional): Property ID to associate the file with
  - `description` (optional): File description
- **Response:** Returns S3 URL and database record (if propertyId provided)

### Upload Image
**POST** `/upload/image`
- **Body (form-data):**
  - `file`: The image file to upload
  - `propertyId` (optional): Property ID to associate the image with
  - `description` (optional): Image description
- **Response:** Returns S3 URL and PropertyPhoto record (if propertyId provided)

### Delete File
**DELETE** `/upload/file`
- **Body (JSON):**
  - `fileUrl`: The S3 URL of the file to delete
- **Response:** Success message

## File Size Limits

- **Images:** 10MB max
- **Videos:** 100MB max
- **Documents:** 50MB max

## Supported File Types

### Images
- JPEG, JPG, PNG, GIF, WEBP, SVG

### Videos
- MP4, MPEG, MOV, AVI, WEBM

### Documents
- PDF, DOC, DOCX, XLS, XLSX

## Usage Example

```typescript
// Frontend upload example
const formData = new FormData();
formData.append('file', file);
formData.append('category', 'IMAGE');
formData.append('propertyId', 'property-id-here');

const response = await fetch('/upload/file', {
  method: 'POST',
  body: formData,
  credentials: 'include',
});
```

