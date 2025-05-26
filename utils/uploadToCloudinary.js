// services/uploadToCloudinary.js
const cloudinary = require('cloudinary').v2;

async function uploadToCloudinary(filePath, options = {}) {
  // options: { folder, context, tags }
  const result = await cloudinary.uploader.upload(filePath, {
    folder: options.folder || 'Gallery',
    context: options.context || {},
    tags: options.tags || [],
    type: 'upload',
    resource_type: 'image',
  });
  return result;
}

module.exports = uploadToCloudinary;