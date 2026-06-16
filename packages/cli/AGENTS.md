# CLI Agent Notes

- Keep command registration in `src/index.ts`.
- Use `bunx react-native bundle` for local React Native bundle generation.
- Default app identity to the detected React Native bundle id from app.json, Gradle, or Xcode project files.
- Keep Capgo-like command shapes (`app add`, `bundle upload [appId]`, `bundle list [appId]`) whenever possible.
- Public docs can show `npx @codepushgo/cli@latest`; repo execution should use `bun`/`bunx`.
