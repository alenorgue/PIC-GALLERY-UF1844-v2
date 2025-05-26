require('dotenv').config();
const cloudinary = require('cloudinary').v2;

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

// Obtiene imágenes y metadatos solo de Cloudinary
async function obtenerImagenesCloudinary(folder) {
  let recursos = [];
  let next_cursor = null;
  do {
    const resultado = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${folder}/`,
      max_results: 500,
      next_cursor: next_cursor,
      colors: true, // Solicita colores dominantes si está habilitado en Cloudinary
      context: true // Solicita metadatos personalizados si existen
    });
    recursos = recursos.concat(resultado.resources);
    next_cursor = resultado.next_cursor;
  } while (next_cursor);
  return recursos;
}

// Obtiene y muestra metadatos de Cloudinary
async function mostrarImagenesCloudinary() {
  const carpeta = 'Gallery';
  const recursosCloudinary = await obtenerImagenesCloudinary(carpeta);
  console.log(`Recursos obtenidos de Cloudinary: ${recursosCloudinary.length}`);

  const imagenes = recursosCloudinary
    .filter(r => ['jpg', 'jpeg'].includes(r.format.toLowerCase()))
    .map(r => {
      // Título: nombre del archivo sin extensión
      const title = r.public_id.split('/').pop().split('.')[0];
      // Fecha: fecha de creación
      const date = new Date(r.created_at).toISOString().split('T')[0];
      // Color dominante: primer color si existe
      const color = r.colors && r.colors.length > 0 ? r.colors[0][0] : '';
      // Categoría: desde context o tags si existe
      let category = '';
      if (r.context && r.context.custom && r.context.custom.category) {
        category = r.context.custom.category;
      } else if (r.tags && r.tags.length > 0) {
        category = r.tags[0];
      }
      return {
        id: r.asset_id,
        title,
        url: r.secure_url,
        date,
        color,
        category,
        public_id: r.public_id,
      };
    });

  // Muestra los metadatos en consola (puedes exportar o usar en tu app)
  console.log(imagenes);
  return imagenes;
}

// Ejecuta la función principal
mostrarImagenesCloudinary().catch(console.error);
