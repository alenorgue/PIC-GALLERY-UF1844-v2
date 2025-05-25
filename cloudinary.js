require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error(
    'Faltan variables de entorno de Cloudinary. Por favor, define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en tu archivo .env'
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const jsonPath = path.join(__dirname, 'data', 'images.json');

function leerImagenesLocales() {
  if (!fs.existsSync(jsonPath)) return [];
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function guardarImagenes(images) {
  fs.writeFileSync(jsonPath, JSON.stringify(images, null, 2), 'utf8');
}

async function obtenerImagenesCloudinary(folder) {
  let recursos = [];
  let next_cursor = null;
  do {
    const resultado = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${folder}/`,
      max_results: 500,
      next_cursor: next_cursor,
    });
    recursos = recursos.concat(resultado.resources);
    next_cursor = resultado.next_cursor;
  } while (next_cursor);
  return recursos;
}

async function actualizarJSON() {
  const carpeta = 'Gallery';
  const imagenesLocales = leerImagenesLocales();
  const localesPorPublicId = {};

  imagenesLocales.forEach(img => {
    if (img.public_id) {
      localesPorPublicId[img.public_id] = img;
    }
  });

  const recursosCloudinary = await obtenerImagenesCloudinary(carpeta);
console.log(`Recursos obtenidos de Cloudinary: ${recursosCloudinary.length}`);
  const nuevasImagenes = recursosCloudinary
    .filter(r =>
      ['jpg', 'jpeg'].includes(r.format.toLowerCase())
    )
    .map(r => {
      const local = localesPorPublicId[r.public_id];
      return {
        id: local?.id || uuidv4(),
        title: local?.title || r.public_id.split('/').pop().split('.')[0], // título desde nombre del archivo
        url: r.secure_url,
        date: local?.date || new Date(r.created_at).toISOString().split('T')[0],
        color: local?.color || '',
        category: local?.category || '',
        public_id: r.public_id,
      };
    });

  // Si hay imágenes locales que no están en Cloudinary, las mantenemos
  const cloudinaryIds = new Set(nuevasImagenes.map(img => img.public_id));
  const imagenesExtrasLocales = imagenesLocales.filter(
    img => img.public_id && !cloudinaryIds.has(img.public_id)
  );

  const final = [...nuevasImagenes, ...imagenesExtrasLocales];

  guardarImagenes(final);
  console.log(`✅ JSON actualizado con ${final.length} imágenes (Cloudinary + locales no duplicadas).`);
}

actualizarJSON().catch(console.error);
