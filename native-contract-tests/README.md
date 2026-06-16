# Native Contract Tests

This directory holds the platform-neutral updater behavior contract for CodePushGo.

The React Native package runs these fixtures in JavaScript today. Native iOS and Android runners should load the same JSON once the native bridge/build work is added, so bundle selection and update-state decisions stay aligned across platforms.

Current runner:
```bash
npx vitest run packages/react-native-updater/test/native-contract.test.ts
```
```
