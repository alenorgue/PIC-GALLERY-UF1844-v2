// services/uploadToCloudinary.js
const cloudinary = require("../config/cloudinary");

async function subirImagenPorURL(imageUrl, folder = "Gallery") {
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder,
    type: "upload"
  });
  return result.secure_url; // URL pública segura
}

module.exports = subirImagenPorURL;