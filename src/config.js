const NODE_ENV = process.env.NODE_ENV;
const PORT = process.env.PORT || '3001';
let API_BASE_URL = '';
if (NODE_ENV == 'react') {
    API_BASE_URL = `http://localhost:${PORT}`;
}
export default API_BASE_URL;