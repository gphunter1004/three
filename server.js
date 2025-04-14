const express = require('express');
const multer = require('multer');
const path = require('path');
const mime = require('mime');
const app = express();
const PORT = 3000;

// multer 저장 설정
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.static('public'));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'three.html'));
});

// .glb 파일의 MIME 타입 지정 후 static 제공
app.use('/uploads', (req, res, next) => {
  if (req.url.endsWith('.glb')) {
    res.setHeader('Content-Type', 'model/gltf-binary');
  }
  next();
}, express.static('uploads'));

// 업로드 라우팅
app.post('/upload', upload.single('glbFile'), (req, res) => {
  if (!req.file) return res.status(400).send('파일 없음');
  res.json({ fileUrl: `/uploads/${req.file.filename}` });
});


app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
