## ADDED Requirements

### Requirement: Idempotent KTP upload to object storage

The system SHALL store member KTP images in an S3-compatible bucket (AWS S3 or MinIO),
uploading an object only when it is not already present, and SHALL derive a public URL for
each stored object. Configuration (endpoint, region, bucket, credentials) comes from env.

#### Scenario: Ensure-upload creates a missing object

- **WHEN** `ensureObject(key, factory, contentType)` is called and the object does not exist
- **THEN** the system uploads the generated body and returns its public URL

#### Scenario: Ensure-upload skips an existing object

- **WHEN** `ensureObject` is called for a key that already exists in the bucket
- **THEN** the system does not re-upload and returns the existing object's public URL

### Requirement: Dummy KTP image generation

The system SHALL generate a dummy KTP image for a member from their name and NIK, suitable
for upload, so the demo has a real, viewable KTP without a real ID scan.

#### Scenario: Generator produces a valid image body

- **WHEN** a dummy KTP is generated for a member
- **THEN** it returns a non-empty body, a content type, and a deterministic object key based on the member's NIK

### Requirement: KTP upload endpoint

The system SHALL expose a multipart endpoint that uploads a KTP file and returns its stored
URL, for use during onboarding.

#### Scenario: Uploading a KTP returns its URL

- **WHEN** a client POSTs a file to `/api/kyc/upload-ktp`
- **THEN** the response contains a `ktpUrl` pointing at the stored object

### Requirement: Graceful degradation when storage is unconfigured

The system SHALL boot and run when S3 is not configured; storage operations SHALL fail with
a clear error (upload endpoint) or be skipped with a log (seed step) rather than crashing.

#### Scenario: Upload without configured storage

- **WHEN** `/api/kyc/upload-ktp` is called and no S3 credentials/endpoint are configured
- **THEN** the response is a clear error indicating storage is unavailable, and the server stays up
