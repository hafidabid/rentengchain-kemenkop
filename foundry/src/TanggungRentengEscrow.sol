// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRRTypes} from "./interfaces/IRRTypes.sol";
import {RRParticipationToken} from "./RRParticipationToken.sol";
import {RRLoanPosition} from "./RRLoanPosition.sol";

/// @title Tanggung Renteng Escrow Ledger
/// @notice Tracking-only cooperative ledger. It never receives or transfers real financial value.
/// @dev Only hashes derived with per-cooperative salts belong on-chain; never submit raw PII.
contract TanggungRentengEscrow is AccessControl, Pausable, ReentrancyGuard, IRRTypes {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant KOPERASI_ROLE = keccak256("KOPERASI_ROLE");
    uint256 public constant MAX_TENOR = 60;
    uint256 public constant HARDSHIP_LIMIT = 2;
    uint256 public constant YEAR = 365 days;

    RRParticipationToken public immutable participationToken;
    RRLoanPosition public immutable loanPosition;
    uint256 public nextLoanId = 1;

    struct Member {
        bytes32 koperasiId;
        address wallet;
        bool registered;
        bool hardship;
        bool blocked;
        uint64 hardshipYear;
        uint8 hardshipCount;
    }

    struct Group {
        bytes32 koperasiId;
        bytes32 chairHash;
        bytes32 inviteCodeHash;
        uint256 plafonMaks;
        uint256 socialFundBalance;
        uint256 talanganOutstanding;
        bool rentengActive;
        bool exists;
    }

    struct Loan {
        bytes32 koperasiId;
        bytes32 groupId;
        bytes32 memberHash;
        uint256 nominal;
        uint256 installment;
        uint256 remainingPeriods;
        uint256 talanganOutstanding;
        uint64 tenor;
        uint64 createdAt;
        LoanStatus status;
        InstallmentStatus installmentStatus;
        AIFlag aiFlag;
        uint8 aiScore;
        bool appealOpen;
        bool exists;
    }

    mapping(bytes32 => Member) public members;
    mapping(bytes32 => Group) public groups;
    mapping(bytes32 => mapping(bytes32 => bool)) public groupMembers;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => mapping(uint256 => uint256)) public installmentDueDate;
    mapping(uint256 => mapping(uint256 => InstallmentStatus)) public installmentStatuses;
    mapping(uint256 => mapping(uint256 => bool)) public installmentSettled;
    mapping(bytes32 => uint256) public memberTalanganOutstanding;

    error AlreadyExists();
    error NotFound();
    error InvalidInput();
    error InvalidState();
    error UnauthorizedCooperative();
    error MemberBlocked();
    error GroupBlocked();
    error HardshipLimitReached();
    error InsufficientSocialFund();
    error GracePeriodActive();
    error AlreadySettled();
    error AmountTooHigh();

    event MemberRegistered(
        bytes32 indexed memberHash, bytes32 indexed koperasiId, address indexed wallet, uint256 timestamp
    );
    event GroupRegistered(
        bytes32 indexed groupId,
        bytes32 indexed koperasiId,
        bytes32 indexed ketuaHash,
        uint256 plafonMaks,
        bytes32 inviteCodeHash,
        uint256 timestamp
    );
    event MemberJoinedGroup(
        bytes32 indexed groupId, bytes32 indexed memberHash, bytes32 indexed koperasiId, uint256 timestamp
    );
    event SavingsRecorded(
        bytes32 indexed memberHash,
        bytes32 indexed koperasiId,
        SavingsType jenis,
        uint256 nominal,
        PaymentMethod metode,
        uint256 timestamp
    );
    event SocialFundFunded(
        bytes32 indexed groupId, bytes32 indexed koperasiId, uint256 amount, uint256 balance, uint256 timestamp
    );
    event LoanCreated(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 nominal,
        uint256 tenor,
        uint256 cicilanBulanan,
        uint256 timestamp
    );
    event ScreeningRecorded(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint8 skorAi,
        AIFlag flagAi,
        bytes32 paramsHash,
        uint256 timestamp
    );
    event LoanApproved(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 timestamp
    );
    event LoanDisbursed(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 timestamp
    );
    event LoanDeferred(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 timestamp
    );
    event InstallmentScheduled(
        uint256 indexed loanId,
        bytes32 indexed groupId,
        bytes32 indexed memberHash,
        bytes32 koperasiId,
        uint256 period,
        uint256 dueDate,
        uint256 amount,
        uint256 timestamp
    );
    event RepaymentRecorded(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 period,
        uint256 amount,
        bool onTime,
        uint256 timestamp
    );
    event LoanClosed(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 timestamp
    );
    event HardshipMarked(
        bytes32 indexed memberHash,
        bytes32 indexed koperasiId,
        bytes32 indexed groupId,
        uint256 uzurCountThisYear,
        uint256 timestamp
    );
    event HardshipCleared(
        bytes32 indexed memberHash, bytes32 indexed koperasiId, bytes32 indexed groupId, uint256 timestamp
    );
    event SocialFundApplied(
        bytes32 indexed groupId,
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 koperasiId,
        uint256 period,
        uint256 amount,
        uint256 kasSosialSisa,
        uint256 timestamp
    );
    event RentengActivated(
        bytes32 indexed groupId,
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 koperasiId,
        uint256 period,
        uint256 talanganAmount,
        uint256 timestamp
    );
    event TalanganRepaid(
        bytes32 indexed groupId,
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 koperasiId,
        uint256 amount,
        uint256 remaining,
        uint256 timestamp
    );
    event LoanRestructured(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        uint256 oldInstallment,
        uint256 newInstallment,
        uint256 oldRemaining,
        uint256 newRemaining,
        uint256 timestamp
    );
    event SanctionApplied(
        bytes32 indexed memberHash,
        uint256 indexed loanId,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        bytes32 sanctionType,
        uint256 timestamp
    );
    event AppealFiled(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        bytes32 reasonHash,
        uint256 timestamp
    );
    event AppealResolved(
        uint256 indexed loanId,
        bytes32 indexed memberHash,
        bytes32 indexed groupId,
        bytes32 koperasiId,
        bool accepted,
        uint256 timestamp
    );
    event ScoreAdjusted(
        bytes32 indexed memberHash,
        bytes32 indexed koperasiId,
        bytes32 indexed groupId,
        int256 delta,
        ScoreReason reasonCode,
        uint256 timestamp
    );

    constructor(address admin, address relayer, RRParticipationToken token, RRLoanPosition position) {
        if (
            admin == address(0) || relayer == address(0) || address(token) == address(0)
                || address(position) == address(0)
        ) revert InvalidInput();
        participationToken = token;
        loanPosition = position;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, relayer);
        _grantRole(KOPERASI_ROLE, admin);
    }

    modifier onlyKnownLoan(uint256 loanId) {
        if (!loans[loanId].exists) revert NotFound();
        _;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function registerMember(bytes32 memberHash, bytes32 koperasiId, address wallet)
        external
        onlyRole(KOPERASI_ROLE)
        whenNotPaused
    {
        if (memberHash == bytes32(0) || koperasiId == bytes32(0) || wallet == address(0)) {
            revert InvalidInput();
        }
        if (members[memberHash].registered) revert AlreadyExists();
        members[memberHash] = Member(koperasiId, wallet, true, false, false, 0, 0);
        emit MemberRegistered(memberHash, koperasiId, wallet, block.timestamp);
    }

    function registerGroup(
        bytes32 groupId,
        bytes32 koperasiId,
        bytes32 chairHash,
        uint256 plafonMaks,
        bytes32 inviteCodeHash
    ) external onlyRole(KOPERASI_ROLE) whenNotPaused {
        if (groupId == bytes32(0) || koperasiId == bytes32(0) || chairHash == bytes32(0) || plafonMaks == 0) revert InvalidInput();
        if (groups[groupId].exists) revert AlreadyExists();
        if (!members[chairHash].registered || members[chairHash].koperasiId != koperasiId) {
            revert UnauthorizedCooperative();
        }
        groups[groupId] = Group(koperasiId, chairHash, inviteCodeHash, plafonMaks, 0, 0, false, true);
        groupMembers[groupId][chairHash] = true;
        emit GroupRegistered(groupId, koperasiId, chairHash, plafonMaks, inviteCodeHash, block.timestamp);
    }

    function joinGroup(bytes32 groupId, bytes32 memberHash, bytes32 inviteCodeHash)
        external
        onlyRole(KOPERASI_ROLE)
        whenNotPaused
    {
        Group storage group = groups[groupId];
        Member storage member = members[memberHash];
        if (!group.exists || !member.registered) revert NotFound();
        if (group.koperasiId != member.koperasiId) revert UnauthorizedCooperative();
        if (group.inviteCodeHash != bytes32(0) && group.inviteCodeHash != inviteCodeHash) revert InvalidInput();
        if (groupMembers[groupId][memberHash]) revert AlreadyExists();
        groupMembers[groupId][memberHash] = true;
        emit MemberJoinedGroup(groupId, memberHash, group.koperasiId, block.timestamp);
    }

    function recordSavings(bytes32 memberHash, SavingsType jenis, uint256 nominal, PaymentMethod metode)
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
    {
        Member storage member = members[memberHash];
        if (!member.registered) revert NotFound();
        if (nominal == 0) revert InvalidInput();
        participationToken.mint(member.wallet, nominal);
        emit SavingsRecorded(memberHash, member.koperasiId, jenis, nominal, metode, block.timestamp);
        emit ScoreAdjusted(memberHash, member.koperasiId, bytes32(0), 2, ScoreReason.SAVINGS, block.timestamp);
    }

    function fundSocialFund(bytes32 groupId, uint256 amount) external onlyRole(RELAYER_ROLE) whenNotPaused {
        Group storage group = groups[groupId];
        if (!group.exists) revert NotFound();
        if (amount == 0) revert InvalidInput();
        group.socialFundBalance += amount;
        emit SocialFundFunded(groupId, group.koperasiId, amount, group.socialFundBalance, block.timestamp);
    }

    function createLoan(
        bytes32 groupId,
        bytes32 memberHash,
        uint256 nominal,
        uint64 tenor,
        uint256 cicilanBulanan,
        uint8 skorAi,
        AIFlag flagAi,
        bytes32 paramsHash,
        uint256 firstDueDate
    ) external onlyRole(RELAYER_ROLE) whenNotPaused returns (uint256 loanId) {
        Group storage group = groups[groupId];
        Member storage member = members[memberHash];
        if (!group.exists || !member.registered || !groupMembers[groupId][memberHash]) revert NotFound();
        if (member.blocked) revert MemberBlocked();
        if (group.rentengActive) revert GroupBlocked();
        if (
            nominal == 0 || nominal > group.plafonMaks || tenor == 0 || tenor > MAX_TENOR || cicilanBulanan == 0
                || skorAi > 100 || firstDueDate <= block.timestamp
        ) revert InvalidInput();
        loanId = nextLoanId++;
        loans[loanId] = Loan(
            group.koperasiId,
            groupId,
            memberHash,
            nominal,
            cicilanBulanan,
            tenor,
            0,
            tenor,
            uint64(block.timestamp),
            LoanStatus.Diajukan,
            InstallmentStatus.UNPAID,
            flagAi,
            skorAi,
            false,
            true
        );
        loanPosition.create(loanId, member.wallet, memberHash);
        emit LoanCreated(loanId, memberHash, groupId, group.koperasiId, nominal, tenor, cicilanBulanan, block.timestamp);
        emit ScreeningRecorded(
            loanId, memberHash, groupId, group.koperasiId, skorAi, flagAi, paramsHash, block.timestamp
        );
        for (uint256 period = 1; period <= tenor; ++period) {
            uint256 dueDate = firstDueDate + ((period - 1) * 30 days);
            installmentDueDate[loanId][period] = dueDate;
            installmentStatuses[loanId][period] = InstallmentStatus.UNPAID;
            emit InstallmentScheduled(
                loanId, groupId, memberHash, group.koperasiId, period, dueDate, cicilanBulanan, block.timestamp
            );
        }
    }

    function recordScreening(uint256 loanId, uint8 skorAi, AIFlag flagAi, bytes32 paramsHash)
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        if (skorAi > 100) revert InvalidInput();
        Loan storage loan = loans[loanId];
        loan.aiScore = skorAi;
        loan.aiFlag = flagAi;
        emit ScreeningRecorded(
            loanId, loan.memberHash, loan.groupId, loan.koperasiId, skorAi, flagAi, paramsHash, block.timestamp
        );
    }

    function approveLoan(uint256 loanId) external onlyRole(KOPERASI_ROLE) whenNotPaused onlyKnownLoan(loanId) {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Diajukan) revert InvalidState();
        if (members[loan.memberHash].blocked || groups[loan.groupId].rentengActive) revert MemberBlocked();
        loan.status = LoanStatus.Disetujui;
        loanPosition.setStatus(loanId, LoanStatus.Disetujui);
        emit LoanApproved(loanId, loan.memberHash, loan.groupId, loan.koperasiId, block.timestamp);
    }

    function disburseLoan(uint256 loanId) external onlyRole(RELAYER_ROLE) whenNotPaused onlyKnownLoan(loanId) {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Disetujui) revert InvalidState();
        if (members[loan.memberHash].blocked || groups[loan.groupId].rentengActive) revert MemberBlocked();
        loan.status = LoanStatus.Cair;
        loanPosition.setStatus(loanId, LoanStatus.Cair);
        emit LoanDisbursed(loanId, loan.memberHash, loan.groupId, loan.koperasiId, block.timestamp);
    }

    function deferLoan(uint256 loanId) external onlyRole(KOPERASI_ROLE) whenNotPaused onlyKnownLoan(loanId) {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Diajukan) revert InvalidState();
        loan.status = LoanStatus.Ditunda;
        loanPosition.setStatus(loanId, LoanStatus.Ditunda);
        emit LoanDeferred(loanId, loan.memberHash, loan.groupId, loan.koperasiId, block.timestamp);
    }

    function recordRepayment(uint256 loanId, uint256 period, bool onTime)
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        nonReentrant
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Cair || period == 0 || period > loan.tenor) revert InvalidState();
        if (installmentSettled[loanId][period]) revert AlreadySettled();
        installmentSettled[loanId][period] = true;
        installmentStatuses[loanId][period] = InstallmentStatus.PAID;
        loan.installmentStatus = InstallmentStatus.PAID;
        loan.remainingPeriods--;
        loanPosition.setInstallmentStatus(loanId, InstallmentStatus.PAID);
        participationToken.mint(members[loan.memberHash].wallet, loan.installment);
        emit RepaymentRecorded(
            loanId, loan.memberHash, loan.groupId, loan.koperasiId, period, loan.installment, onTime, block.timestamp
        );
        if (onTime) {
            emit ScoreAdjusted(
                loan.memberHash, loan.koperasiId, loan.groupId, 4, ScoreReason.ONTIME_REPAY, block.timestamp
            );
        }
        _closeIfComplete(loanId, loan);
    }

    function markHardship(bytes32 memberHash, bytes32 groupId) external onlyRole(KOPERASI_ROLE) whenNotPaused {
        Member storage member = members[memberHash];
        if (!member.registered || !groupMembers[groupId][memberHash]) revert NotFound();
        uint64 year = uint64(block.timestamp / YEAR);
        if (member.hardshipYear != year) {
            member.hardshipYear = year;
            member.hardshipCount = 0;
        }
        if (member.hardshipCount >= HARDSHIP_LIMIT) revert HardshipLimitReached();
        member.hardship = true;
        member.hardshipCount++;
        emit HardshipMarked(memberHash, member.koperasiId, groupId, member.hardshipCount, block.timestamp);
    }

    function clearHardship(bytes32 memberHash, bytes32 groupId) external onlyRole(KOPERASI_ROLE) whenNotPaused {
        Member storage member = members[memberHash];
        if (!member.registered || !groupMembers[groupId][memberHash]) revert NotFound();
        member.hardship = false;
        emit HardshipCleared(memberHash, member.koperasiId, groupId, block.timestamp);
    }

    function applySocialFund(uint256 loanId, uint256 period)
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        Group storage group = groups[loan.groupId];
        if (!members[loan.memberHash].hardship || loan.status != LoanStatus.Cair || period == 0 || period > loan.tenor) revert InvalidState();
        if (installmentSettled[loanId][period]) revert AlreadySettled();
        if (group.socialFundBalance < loan.installment) revert InsufficientSocialFund();
        group.socialFundBalance -= loan.installment;
        installmentSettled[loanId][period] = true;
        installmentStatuses[loanId][period] = InstallmentStatus.PAID;
        loan.installmentStatus = InstallmentStatus.PAID;
        loan.remainingPeriods--;
        loanPosition.setInstallmentStatus(loanId, InstallmentStatus.PAID);
        emit SocialFundApplied(
            loan.groupId,
            loanId,
            loan.memberHash,
            loan.koperasiId,
            period,
            loan.installment,
            group.socialFundBalance,
            block.timestamp
        );
        _closeIfComplete(loanId, loan);
    }

    function restructure(uint256 loanId, uint256 period, uint256 newInstallment, uint256 newRemaining)
        external
        onlyRole(KOPERASI_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        if (
            !members[loan.memberHash].hardship || loan.status != LoanStatus.Cair || installmentSettled[loanId][period]
                || newInstallment == 0 || newRemaining == 0 || newRemaining > MAX_TENOR
        ) revert InvalidState();
        uint256 oldInstallment = loan.installment;
        uint256 oldRemaining = loan.remainingPeriods;
        installmentSettled[loanId][period] = true;
        installmentStatuses[loanId][period] = InstallmentStatus.PAID;
        loan.installmentStatus = InstallmentStatus.PAID;
        loan.installment = newInstallment;
        loan.remainingPeriods = newRemaining;
        loanPosition.setInstallmentStatus(loanId, InstallmentStatus.PAID);
        emit LoanRestructured(
            loanId,
            loan.memberHash,
            loan.groupId,
            loan.koperasiId,
            oldInstallment,
            newInstallment,
            oldRemaining,
            newRemaining,
            block.timestamp
        );
    }

    function activateRenteng(uint256 loanId, uint256 period, uint256 gracePeriod)
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        Group storage group = groups[loan.groupId];
        if (
            loan.status != LoanStatus.Cair || members[loan.memberHash].hardship || period == 0 || period > loan.tenor
                || installmentSettled[loanId][period]
        ) revert InvalidState();
        if (block.timestamp <= installmentDueDate[loanId][period] + gracePeriod) revert GracePeriodActive();
        installmentSettled[loanId][period] = true;
        installmentStatuses[loanId][period] = InstallmentStatus.DITALANGI;
        loan.installmentStatus = InstallmentStatus.DITALANGI;
        loan.remainingPeriods--;
        loan.talanganOutstanding += loan.installment;
        memberTalanganOutstanding[loan.memberHash] += loan.installment;
        group.talanganOutstanding += loan.installment;
        group.rentengActive = true;
        members[loan.memberHash].blocked = true;
        loanPosition.setInstallmentStatus(loanId, InstallmentStatus.DITALANGI);
        emit RentengActivated(
            loan.groupId, loanId, loan.memberHash, loan.koperasiId, period, loan.installment, block.timestamp
        );
        emit ScoreAdjusted(
            loan.memberHash, loan.koperasiId, loan.groupId, -15, ScoreReason.RENTENG_PENALTY, block.timestamp
        );
    }

    function repayTalangan(uint256 loanId, uint256 amount)
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        Group storage group = groups[loan.groupId];
        if (amount == 0 || loan.talanganOutstanding == 0) revert InvalidInput();
        if (amount > loan.talanganOutstanding) revert AmountTooHigh();
        loan.talanganOutstanding -= amount;
        memberTalanganOutstanding[loan.memberHash] -= amount;
        group.talanganOutstanding -= amount;
        if (memberTalanganOutstanding[loan.memberHash] == 0) members[loan.memberHash].blocked = false;
        if (group.talanganOutstanding == 0) group.rentengActive = false;
        emit TalanganRepaid(
            loan.groupId, loanId, loan.memberHash, loan.koperasiId, amount, loan.talanganOutstanding, block.timestamp
        );
        if (loan.talanganOutstanding == 0) {
            emit ScoreAdjusted(
                loan.memberHash, loan.koperasiId, loan.groupId, 0, ScoreReason.TALANGAN_REPAID, block.timestamp
            );
        }
        _closeIfComplete(loanId, loan);
    }

    function applySanction(uint256 loanId, bytes32 sanctionType)
        external
        onlyRole(KOPERASI_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        if (sanctionType == bytes32(0)) revert InvalidInput();
        loan.status = LoanStatus.Mangkir;
        loan.aiFlag = AIFlag.MERAH;
        members[loan.memberHash].blocked = true;
        loanPosition.setStatus(loanId, LoanStatus.Mangkir);
        emit SanctionApplied(loan.memberHash, loanId, loan.groupId, loan.koperasiId, sanctionType, block.timestamp);
    }

    function fileAppeal(uint256 loanId, bytes32 reasonHash) external whenNotPaused onlyKnownLoan(loanId) {
        Loan storage loan = loans[loanId];
        if (msg.sender != members[loan.memberHash].wallet || reasonHash == bytes32(0) || loan.appealOpen) {
            revert InvalidState();
        }
        loan.appealOpen = true;
        emit AppealFiled(loanId, loan.memberHash, loan.groupId, loan.koperasiId, reasonHash, block.timestamp);
    }

    function resolveAppeal(uint256 loanId, bool accepted)
        external
        onlyRole(KOPERASI_ROLE)
        whenNotPaused
        onlyKnownLoan(loanId)
    {
        Loan storage loan = loans[loanId];
        if (!loan.appealOpen) revert InvalidState();
        loan.appealOpen = false;
        if (accepted && memberTalanganOutstanding[loan.memberHash] == 0) members[loan.memberHash].blocked = false;
        emit AppealResolved(loanId, loan.memberHash, loan.groupId, loan.koperasiId, accepted, block.timestamp);
    }

    function _closeIfComplete(uint256 loanId, Loan storage loan) internal {
        if (loan.remainingPeriods == 0 && loan.talanganOutstanding == 0) {
            loan.status = LoanStatus.Lunas;
            loanPosition.setStatus(loanId, LoanStatus.Lunas);
            emit LoanClosed(loanId, loan.memberHash, loan.groupId, loan.koperasiId, block.timestamp);
        }
    }
}
