# Changelog

All notable changes to this project will be documented in this file.

## [v0.1.0] - 2026-02-14

### Added

- **Playwright E2E Tests**: Set up Playwright for end-to-end testing, including tests for language switching, auto-save, and UI components.
- **I18n Support**: Implemented internationalization with Chinese and English support.
- **Settings Persistence**: User settings are now persisted across sessions.
- **Character Count**: Real-time character count display in the editor.
- **Clear Button**: Added functionality to quickly clear the input text.
- **Landing Page**: New landing page for the extension.
- **Privacy Policy**: Added and refined privacy policy display.
- **Store Assets**: Added screenshots and promotional materials for the Chrome Web Store.

### Changed

- **UI Refactoring**: Improved sidepanel UI with separate Proofread and Rewrite sections.
- **State Management**: Optimized settings management by eliminating temporary states.
- **Build System**: Configured WXT for production-ready extension builds.

### Fixed

- **Env Detection**: Fixed issues with environment detection during initialization.
- **Style Issues**: Resolved various layout and styling bugs in the sidepanel.
