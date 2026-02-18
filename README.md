# TestMaker
Aplicacion de quizzes en Angular (standalone components) con estado global usando Signals.

## Stack
- Angular 19
- Angular Signals
- Tailwind CSS (CDN)

## Ejecutar
```bash
npm install
npm start
```
Abre `http://localhost:4200/`.

## Build
```bash
npm run build
```
Salida en `dist/test-maker`.

## Rutas
- `/` configuracion del quiz
- `/quiz` ejecucion del quiz
- `/results` revision de resultados

`/quiz` y `/results` estan protegidas por `activeQuizGuard`.

## Estructura
- `src/app/core/data` modelos + mock data
- `src/app/core/services` `QuizService` (Signals + logica de negocio)
- `src/app/core/guards` guards de navegacion
- `src/app/features/quiz-config` pantalla de configuracion
- `src/app/features/quiz-runner` pantalla interactiva del quiz
- `src/app/features/quiz-results` pantalla de resultados + export PDF
- `src/app/initial-design` HTML estaticos de referencia

## Notas
- El modo oscuro se fuerza por clase `dark`.
- Export PDF usa `html2canvas` y `jspdf` via CDN en `src/index.html`.
