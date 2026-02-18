# TestMaker

Aplicacion de quizzes con Angular 19 (standalone), Signals y Tailwind CSS (CDN).

## Requisitos
- Node.js 20+
- npm 10+

## Scripts
- `npm start`: entorno local en `http://localhost:4200/`
- `npm run build`: build de produccion en `dist/test-maker`
- `npm run watch`: build en modo watch

## Flujo de la app
1. Carga del banco de preguntas desde `public/assets/master-data.json` (APP_INITIALIZER).
2. Setup de sesion en `/`: temas, numero de preguntas y shuffles.
3. Ejecucion en `/quiz`: navegacion y respuesta por pregunta.
4. Revision en `/results`: filtros y exportacion PDF con jsPDF.

## Rutas
- `/` Setup Session
- `/quiz` Quiz Runner (protegida por `activeQuizGuard`)
- `/results` Results Review (protegida por `activeQuizGuard`)

## Estructura
- `src/app/core/data`: interfaces y contratos
- `src/app/core/services`: estado global (`QuizService`) y tema (`ThemeService`)
- `src/app/core/guards`: guards de navegacion
- `src/app/features/quiz-config`: configuracion del quiz
- `src/app/features/quiz-runner`: ejecucion del quiz
- `src/app/features/quiz-results`: revision y exportacion PDF
- `public/assets/master-data.json`: datos maestros
- `src/app/initial-design`: HTML estaticos de referencia de diseno

## Nota preproduccion
- Tailwind se sirve por CDN en `src/index.html`; para produccion final se recomienda integrarlo en pipeline de build.
