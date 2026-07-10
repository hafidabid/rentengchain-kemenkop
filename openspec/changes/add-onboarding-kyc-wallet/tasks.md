## 1. KYC submission

- [ ] 1.1 Create a `kyc/` module (controller + service) in the backend
- [ ] 1.2 `POST /api/kyc/submit` accepts profile fields (nama, nik, noHp, alamat, pekerjaan, peran) + a pre-seeded `ktpUrl`, persists a member with `statusKyc: Requested` and null `walletAddress`
- [ ] 1.3 Validate input with a DTO + `ValidationPipe`; reject duplicate NIK

## 2. Pengurus approval → wallet mint → on-chain register

- [ ] 2.1 `POST /api/kyc/approve/:id` guarded by `@Roles('Pengurus')`
- [ ] 2.2 On approve: set `statusKyc: Approved`, then generate a custodial wallet via `WalletService.generate()` and persist the checksummed `walletAddress`
- [ ] 2.3 Compute `memberHash` (NIK + coop salt) and `koperasiId` via the hashing helper, then call `registerMember(memberHash, koperasiId, wallet)` on the escrow via the contract client; capture the `txHash`
- [ ] 2.4 Append an audit entry (`aktor` = approving Pengurus, `aksi` = `KYC_APPROVED`, `detail` includes member name + resulting `txHash`)
- [ ] 2.5 Guard against re-minting: approving a member that already has a `walletAddress` keeps the existing address

## 3. Reject path (shallow)

- [ ] 3.1 `POST /api/kyc/reject/:id` (Pengurus) sets `statusKyc: Rejected`, mints no wallet, appends an audit entry

## 4. Cross-surface visibility

- [ ] 4.1 Confirm the foundation member read returns the new `walletAddress` for both Anggota (`/api/members/me`) and Pengurus (`/api/members/:id`) with no additional endpoint

## 5. Quality gates

- [ ] 5.1 `npm run build` and `npm run lint` pass
- [ ] 5.2 Unit test: approve flips status, persists a valid checksummed address, and calls `registerMember` exactly once; Anggota role is blocked from approve/reject
- [ ] 5.3 Integration smoke: seed Ira as `Requested` → approve as Pengurus → Ira has a checksummed Base Sepolia `walletAddress` visible on both surfaces and an audit entry with a `txHash` that resolves on the explorer
