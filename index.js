const express = require('express');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
require('./auth');
const app = express();
const router = express.Router();
const path = require('path');
const PORT = process.env.PORT || 5000
const fs = require('fs');
const getDominantColorFromUrl = require('./utils/getColor');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const multer = require("multer");

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Multer: guardar copia en /uploads
const upload = multer({ dest: "public/uploads" });


// Middleware para procesar peticiones POST que vengan de un formulario
app.use(session({ secret: 'cats',  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // debe ser true si usas HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 1 día
  }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Función para verificar si el usuario está loggeado
function isLoggedIn(req, res, next){
  req.user ? next() : res.render('login-required.ejs');
}

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Click 'View API Keys' above to copy your API secret
});

// Nueva función: obtener imágenes y metadatos solo de Cloudinary
async function getCloudinaryImages(folder = 'Gallery') {
  let recursos = [];
  let next_cursor = null;
  do {
    const resultado = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${folder}/`,
      max_results: 500,
      next_cursor: next_cursor,
      colors: true,
      context: true
    });
    recursos = recursos.concat(resultado.resources);
    next_cursor = resultado.next_cursor;
  } while (next_cursor);

  return recursos
    .filter(r => ['jpg', 'jpeg'].includes(r.format.toLowerCase()))
    .map(r => {
      const title = r.public_id.split('/').pop().split('.')[0];
      const date = new Date(r.created_at).toISOString().split('T')[0];
      const color = r.colors && r.colors.length > 0 ? r.colors[0][0] : '';
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
}

// Rutas principales adaptadas para solo Cloudinary
app.get("/", async (req, res) => {
  const images = await getCloudinaryImages();
  const { search } = req.query;
  let filtered = images;
  if (search) {
    const lowerSearch = search.toLowerCase();
    filtered = filtered.filter(img =>
      img.title.toLowerCase().includes(lowerSearch) ||
      (img.category && img.category.toLowerCase().includes(lowerSearch))
    );
  }
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.render('home', {
    images: filtered,
    query: req.query
  });
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'] })
);

app.get('/google/callback',
  passport.authenticate('google', {
    successRedirect: '/home',
    failureRedirect: 'auth/failure',
  })
);
app.get('/auth/failure', (req, res) => {
  res.send('Error durante la auntentificación...');
});

// Ruta a home
app.get("/home", async (req, res) => {
  const images = await getCloudinaryImages();
  const { search } = req.query;
  let filtered = images;
  if (search) {
    const lowerSearch = search.toLowerCase();
    filtered = filtered.filter(img =>
      img.title.toLowerCase().includes(lowerSearch) ||
      (img.category && img.category.toLowerCase().includes(lowerSearch))
    );
  }
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.render('home', {
    images: filtered,
    query: req.query
  });
});

// Ruta para mostrar el formulario de nueva imagen
app.get("/new-image", isLoggedIn, (req, res) => {
   res.render("add-img.ejs", {
    message: undefined // no tengo nada que informar al usuario por el momento
  });
});

const uploadToCloudinary = require('./utils/uploadToCloudinary');

// Ruta para manejar el envío del formulario
app.post("/new-image", upload.single('image'), async (req, res) => {
  const { title, date, category } = req.body;
  const file = req.file;
  const errors = [];

  const titlePattern = /^[a-zA-Z0-9 _áéíóúÁÉÍÓÚñÑüÜ]{1,30}$/;
  if (!titlePattern.test(title)) {
    errors.push('Título inválido.');
  }
  if (!file) {
    errors.push('Debes seleccionar una imagen.');
  }
  if (errors.length > 0) {
    return res.render('add-img.ejs', { message: errors.join(' ') });
  }

  try {
    // Sube la imagen a Cloudinary con metadatos
    const result = await uploadToCloudinary(file.path, {
      folder: 'Gallery',
      context: { title, category },
      tags: category ? [category] : [],
    });
    // Elimina el archivo local tras subir
    fs.unlinkSync(file.path);
    res.render("add-img.ejs", {
      message: "La imagen se ha añadido correctamente"
    });
  } catch (err) {
    res.render('add-img.ejs', { message: 'Error al subir la imagen a Cloudinary.' });
  }
});

// Ruta para mostrar todas las imágenes desde el archivo JSON
app.get('/show-images', isLoggedIn, async (req, res) => {
  const images = await getCloudinaryImages();
  const { search } = req.query;
  let filtered = images;
  if (search) {
    const lowerSearch = search.toLowerCase();
    filtered = filtered.filter(img =>
      img.title.toLowerCase().includes(lowerSearch) ||
      (img.category && img.category.toLowerCase().includes(lowerSearch))
    );
  }
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.render('show-img', {
    combinedImages: filtered,
    query: req.query
  });
});

// Eliminar imagen de Cloudinary
app.post('/delete-image', isLoggedIn, async (req, res) => {
  const { public_id } = req.body;
  try {
    await cloudinary.uploader.destroy(public_id);
    res.redirect('/show-images');
  } catch (err) {
    res.send('Error al eliminar la imagen de Cloudinary.');
  }
});

app.get('/logout', (req, res )=> {
  const displayName = req.user ? req.user.displayName : 'usuario';
  req.logout(() => {
    req.session.destroy();
    res.render('goodbye', { name: displayName });
  });
})

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});