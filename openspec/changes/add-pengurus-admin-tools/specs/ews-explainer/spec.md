## ADDED Requirements

### Requirement: EWS is explained wherever it appears

The system SHALL present a clear explanation of EWS (Early Warning System) — the Gemini-based
AI credit-risk screening that produces a score (0–100) and a `HIJAU`/`KUNING`/`MERAH` flag —
both inline (an explainer section) and via a tooltip attached to EWS mentions in the UI.

#### Scenario: Tooltip explains an EWS flag

- **WHEN** a user focuses or hovers an EWS mention (e.g. a flag badge or the risk screener label)
- **THEN** a tooltip explains that EWS is the AI early-warning risk score and what the flag means

#### Scenario: Inline explainer is available

- **WHEN** a user views a surface that features EWS prominently
- **THEN** a short inline explanation of EWS is present without requiring interaction
