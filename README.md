# Analizador de Contratos IA

Una aplicación web impulsada por Inteligencia Artificial diseñada para analizar contratos legales en formato PDF. Extrae información clave como fechas de vigencia, obligaciones, penalizaciones y cláusulas abusivas, y permite a los usuarios interactuar con el documento a través de un chat en tiempo real.

Construida con un enfoque estricto en la **privacidad del usuario** y diseñada para ser desplegada en entornos **Serverless** (como Vercel).

---

## Características Principales

- **Análisis Inteligente**: Sube contratos en formato PDF y obtén un resumen detallado generado por Google Gemini.
- **Chat Interactivo**: Hazle preguntas específicas a la IA sobre el contenido exacto de tu contrato.
- **Privacy-First (Privacidad Total)**: 
  - Los documentos no se guardan en servidores ni bases de datos.
  - El historial de conversaciones se almacena localmente en tu navegador (`localStorage`).
  - Botón de "Autodestrucción" para eliminar permanentemente los archivos de los servidores de Google a petición del usuario.
- **UI/UX Moderna**: Diseño estilo *Glassmorphism* con soporte nativo para **Modo Oscuro**, optimizado para dispositivos móviles.

---

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3 (Variables y UI responsiva), JavaScript Vanilla (ES6)
- **Inteligencia Artificial**: Google Gemini API (v1beta - File API & Generative AI)
- **Procesamiento de Archivos**: Multer (Memory Storage)
- **Despliegue (Deployment)**: Vercel (Serverless Functions via `@vercel/node`)

---

## Prerrequisitos

Para correr este proyecto de forma local, necesitarás:

- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- Una clave de API de **Google Gemini**. Puedes obtenerla gratis en [Google AI Studio](https://aistudio.google.com/).

---

## Getting Started (Desarrollo Local)

Sigue estos pasos para levantar el entorno de desarrollo en tu computadora:

### 1. Clonar el repositorio

```bash
git clone https://github.com/Kromilla/analizador-contratos-ia.git
cd analizador-contratos-ia
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo para crear tu propio archivo `.env`:

```bash
cp .env.example .env
```

Abre el archivo `.env` en tu editor de código y reemplaza el valor con tu clave de Gemini:

```env
GEMINI_API_KEY="TU_API_KEY_DE_GEMINI_AQUI"
PORT=3000
```

### 4. Iniciar el servidor

Inicia la aplicación en modo desarrollo:

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación funcionando.

---

## Arquitectura del Sistema

### Flujo de Datos (Upload & Chat)

1. El usuario sube un PDF a través de la interfaz.
2. `Multer` captura el archivo en la **memoria RAM** (`memoryStorage`), sin escribir nada en el disco duro (crítico para Vercel).
3. El servidor sube el buffer del PDF temporalmente a la **Gemini File API** y recibe un `fileUri`.
4. El backend le pide a Gemini un análisis estructurado en JSON sobre ese documento.
5. El servidor responde al frontend con el análisis y el `fileUri`.
6. **Chat**: El usuario hace una pregunta. El frontend envía el mensaje junto con el `fileUri` al backend. Gemini responde usando el contexto del documento.

---

## Despliegue en Vercel

Este proyecto está optimizado y pre-configurado para desplegarse fácilmente en Vercel mediante el archivo `vercel.json`.

1. Haz un fork o sube este repositorio a tu cuenta de GitHub.
2. Inicia sesión en [Vercel](https://vercel.com/) y haz clic en **"Add New Project"**.
3. Importa el repositorio `analizador-contratos-ia`.
4. En la sección **Environment Variables**, añade:
   - `GEMINI_API_KEY`: *(tu clave secreta)*
5. Haz clic en **Deploy**.

Vercel detectará la configuración automáticamente, enrutará las peticiones `/api/*` hacia tu `server.js` como Funciones Serverless, y servirá los archivos HTML/CSS/JS como recursos estáticos ultrarrápidos.

---

## Consideraciones Legales y de Seguridad

- **Límites de peticiones**: Se recomienda añadir una capa de seguridad extra (Rate Limiting) si se planea un tráfico masivo.
- **Aviso Legal**: Esta herramienta no reemplaza el consejo legal profesional de un abogado colegiado.
