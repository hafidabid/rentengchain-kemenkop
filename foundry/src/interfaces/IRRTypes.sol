// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Shared canonical vocabulary matching the RantaiRenteng UI.
interface IRRTypes {
    enum LoanStatus {
        Diajukan,
        Disetujui,
        Cair,
        Ditunda,
        Mangkir,
        Lunas
    }
    enum InstallmentStatus {
        PAID,
        UNPAID,
        TUNGGAKAN,
        DITALANGI
    }
    enum SavingsType {
        POKOK,
        WAJIB,
        SUKARELA
    }
    enum PaymentMethod {
        QRIS,
        CASH
    }
    enum AIFlag {
        HIJAU,
        KUNING,
        MERAH
    }
    enum ScoreReason {
        SAVINGS,
        ONTIME_REPAY,
        RENTENG_PENALTY,
        TALANGAN_REPAID,
        OTHER
    }
}
