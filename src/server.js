const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const apiRouter = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const API_PREFIX = '/api/v1';

app.get('/', (req, res) => res.redirect('/api-docs'));
app.get('/health', (req, res) => res.json({ status: 'ok', storage: 'in-memory', domain: 'real-estate' }));

// Documentation interactive générée à partir de la spec OpenAPI
const openapiDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
app.get('/api-docs.json', (req, res) => res.json(openapiDocument));

app.use(API_PREFIX, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Real Estate (mock, stockage en mémoire) démarrée sur http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Documentation Swagger UI disponible sur http://localhost:${PORT}/api-docs`);
});

module.exports = app;
