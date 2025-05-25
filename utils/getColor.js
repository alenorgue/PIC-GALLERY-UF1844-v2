const getColors = require('get-image-colors');
const fetch = require('node-fetch');
const FileType = require('file-type');

async function getDominantColorFromUrl(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    const buffer = await res.buffer();

    const type = await FileType.fileTypeFromBuffer(buffer); // fileTypeFromBuffer en lugar de fromBuffer
    if (!type || !type.mime.startsWith('image/')) {
      throw new Error('Tipo de archivo no reconocido como imagen');
    }

    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];
    if (!supportedTypes.includes(type.mime)) {
      throw new Error(`Tipo MIME no compatible: ${type.mime}`);
    }

    const colors = await getColors(buffer, type.mime);
    return colors[0].hex();
  } catch (error) {
    console.error('Error al obtener color:', error.message);
    return '#cccccc';
  }
}

module.exports = getDominantColorFromUrl;
