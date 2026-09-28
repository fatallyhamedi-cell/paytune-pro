import { v2 as cloudinary } from 'cloudinary';

const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  return '';
};

cloudinary.config({
  cloud_name: getEnvVar('CLOUDINARY_CLOUD_NAME'),
  api_key: getEnvVar('CLOUDINARY_API_KEY'),
  api_secret: getEnvVar('CLOUDINARY_API_SECRET'),
});

export default cloudinary;
