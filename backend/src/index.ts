import app from './app';

const PORT = process.env.PORT || 5000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

app.listen(Number(PORT), HOST, () => {
  console.log(`✅ Backend Server is running on http://${HOST}:${PORT}`);
});
