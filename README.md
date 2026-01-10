# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the ## Mobile Development (Android & iOS)

This project is configured with **Capacitor** to run as a native mobile app.

### Prerequisites
- **Android**: Install Android Studio and set up an emulator or device.
- **iOS**: Install Xcode (macOS only).

### Running on Mobile

1. **Sync Web Assets**:
   ```bash
   npm run build
   npx cap sync
   ```

2. **Open Native IDE**:
   ```bash
   # Android
   npx cap open android

   # iOS
   npx cap open ios
   ```

3. **Run**: Use the "Run" button in Android Studio or Xcode to deploy to your device/emulator.

### Mobile-Specific features
- **Safe Area**: CSS handles notches automatically via `env(safe-area-inset-*)`.
- **Permissions**: Camera permissions are pre-configured in `AndroidManifest.xml`.

