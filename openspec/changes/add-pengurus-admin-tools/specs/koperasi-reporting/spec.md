## ADDED Requirements

### Requirement: e-RAT aggregate report data

The system SHALL expose e-RAT report aggregates for the Pengurus — chart-ready series and
tabular rows covering savings, loans by AI flag/status, social fund, member composition, and
renteng activity.

#### Scenario: Report endpoint returns chart + table data

- **WHEN** a Pengurus requests the e-RAT report
- **THEN** the response contains both chart-ready series and tabular rows derived from the current data

### Requirement: XLSX export

The system SHALL let a Pengurus export the e-RAT report as an `.xlsx` workbook containing the
tabular data.

#### Scenario: Export downloads a spreadsheet

- **WHEN** a Pengurus triggers the export
- **THEN** the system returns an `.xlsx` file (correct content type) whose sheets contain the report's tabular data

### Requirement: Report visualization in the dashboard

The system SHALL present the e-RAT report with chart visualizations and data tables in the
Pengurus Laporan view.

#### Scenario: Laporan renders charts and tables

- **WHEN** a Pengurus opens the Laporan e-RAT view
- **THEN** it renders at least one chart and the corresponding data table, with an export action
