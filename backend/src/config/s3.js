import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Configure AWS SDK v3
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
};

console.log('🔧 AWS Configuration:', {
  region: awsConfig.region,
  accessKeyId: awsConfig.credentials.accessKeyId ? 'SET' : 'NOT SET',
  secretAccessKey: awsConfig.credentials.secretAccessKey ? 'SET' : 'NOT SET'
});

// Create S3 client with explicit region and credentials
const s3Client = new S3Client(awsConfig);

// S3 bucket configuration
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'sparqit-files';
const BUCKET_REGION = awsConfig.region;

// Ensure bucket exists
const ensureBucketExists = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ S3 bucket '${BUCKET_NAME}' exists`);
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`📦 Creating S3 bucket '${BUCKET_NAME}'...`);
      try {
        await s3Client.send(new CreateBucketCommand({
          Bucket: BUCKET_NAME,
          CreateBucketConfiguration: BUCKET_REGION === 'us-east-1' ? undefined : {
            LocationConstraint: BUCKET_REGION
          }
        }));
        console.log(`✅ S3 bucket '${BUCKET_NAME}' created successfully`);
      } catch (createError) {
        console.error('❌ Failed to create S3 bucket:', createError);
        throw createError;
      }
    } else {
      console.error('❌ S3 bucket check failed:', error);
      throw error;
    }
  }
};

// Generate unique file key
const generateFileKey = (workspaceId, originalName, options = {}) => {
  const { isGenerated = false, generationType = null, workspaceName = null } = options;
  
  if (isGenerated && generationType && workspaceName) {
    // For generated files, use structured naming: workspace_generatetype_datetime
    const cleanWorkspaceName = workspaceName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20);
    
    const cleanGenerationType = generationType
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');
    
    // Create readable datetime format: YYYY-MM-DD_HH-MM-SS
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const datetime = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    
    const extension = originalName.split('.').pop() || 'pdf';
    
    return `generated/${workspaceId}/${cleanWorkspaceName}_${cleanGenerationType}_${datetime}.${extension}`;
  } else {
    // For regular uploads, use the existing pattern
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    return `workspaces/${workspaceId}/${timestamp}-${randomString}.${extension}`;
  }
};

// Generate file key specifically for generated content
// Format: workspace_generatetype_YYYY-MM-DD_HH-MM-SS.pdf
const generateGeneratedFileKey = (workspaceId, workspaceName, generationType, originalName) => {
  return generateFileKey(workspaceId, originalName, {
    isGenerated: true,
    generationType,
    workspaceName
  });
};

// Upload file to S3
const uploadToS3 = async (file, workspaceId, options = {}) => {
  console.log('🔍 uploadToS3 called with:', {
    hasFile: !!file,
    hasBuffer: !!file?.buffer,
    bufferLength: file?.buffer?.length,
    originalname: file?.originalname,
    mimetype: file?.mimetype,
    workspaceId,
    bufferType: typeof file?.buffer,
    bufferIsBuffer: Buffer.isBuffer(file?.buffer),
    options
  });
  
  console.log('🔧 Using S3 client with region:', awsConfig.region);
  
  const fileKey = generateFileKey(workspaceId, file.originalname, options);
  
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: {
      originalName: file.originalname,
      uploadedBy: workspaceId.toString(),
      uploadedAt: new Date().toISOString()
    }
  };

  console.log('📤 Upload params:', {
    Bucket: uploadParams.Bucket,
    Key: uploadParams.Key,
    ContentType: uploadParams.ContentType,
    BodyLength: uploadParams.Body?.length,
    BodyType: typeof uploadParams.Body,
    BodyIsBuffer: Buffer.isBuffer(uploadParams.Body)
  });

  try {
    const result = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('✅ S3 upload successful:', result.Location);
    return {
      s3Key: fileKey,
      s3Bucket: BUCKET_NAME,
      s3Url: `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${fileKey}`,
      fileName: fileKey.split('/').pop()
    };
  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    console.error('Error details:', {
      name: error.name,
      statusCode: error.$metadata?.httpStatusCode,
      region: error.$metadata?.region,
      requestId: error.$metadata?.requestId
    });
    throw new Error('Failed to upload file to S3');
  }
};

// Delete file from S3
const deleteFromS3 = async (s3Key) => {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    }));
    console.log(`✅ File deleted from S3: ${s3Key}`);
  } catch (error) {
    console.error('❌ Failed to delete file from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
};

// Get file from S3
const getFileFromS3 = async (s3Key) => {
  try {
    console.log(`🔍 [S3] Attempting to get file: ${s3Key} from bucket: ${BUCKET_NAME}`);
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    }));
    
    console.log(`✅ [S3] File retrieved successfully, converting stream to buffer...`);
    // Convert stream to buffer to avoid circular references
    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log(`✅ [S3] Buffer created successfully, size: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error('❌ Failed to get file from S3:', {
      error: error.message,
      s3Key,
      bucket: BUCKET_NAME,
      hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    });
    throw new Error(`Failed to get file from S3: ${error.message}`);
  }
};

export {
  s3Client,
  BUCKET_NAME,
  ensureBucketExists,
  uploadToS3,
  deleteFromS3,
  getFileFromS3,
  generateGeneratedFileKey
}; 