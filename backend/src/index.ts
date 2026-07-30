import app from './app';

const PORT = process.env.PORT || 5000;
const HOST = '127.0.0.1';

app.listen(Number(PORT), HOST, () => {
  console.log(`✅ Backend Server is running on http://${HOST}:${PORT}`);
  console.log(`✅ Frontend is available at http://127.0.0.1:5173`);
});
