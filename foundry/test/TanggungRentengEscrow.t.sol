// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IRRTypes} from "../src/interfaces/IRRTypes.sol";
import {RRParticipationToken} from "../src/RRParticipationToken.sol";
import {RRLoanPosition} from "../src/RRLoanPosition.sol";
import {TanggungRentengEscrow} from "../src/TanggungRentengEscrow.sol";

contract TanggungRentengEscrowTest is Test, IRRTypes {
    RRParticipationToken token;
    RRLoanPosition position;
    TanggungRentengEscrow ledger;

    address relayer = makeAddr("relayer");
    address memberWallet = makeAddr("member");
    address secondWallet = makeAddr("second");
    address outsider = makeAddr("outsider");
    bytes32 koperasiId = keccak256("koperasi-mawar");
    bytes32 groupId = keccak256("group-mawar");
    bytes32 memberHash = keccak256("salted-member-one");
    bytes32 secondHash = keccak256("salted-member-two");
    bytes32 inviteHash = keccak256("MAWAR9-with-secret-salt");

    function setUp() public {
        token = new RRParticipationToken(address(this));
        position = new RRLoanPosition(address(this), "ipfs://test/{id}.json");
        ledger = new TanggungRentengEscrow(address(this), relayer, token, position);
        token.grantRole(token.LEDGER_ROLE(), address(ledger));
        position.grantRole(position.LEDGER_ROLE(), address(ledger));

        ledger.registerMember(memberHash, koperasiId, memberWallet);
        ledger.registerMember(secondHash, koperasiId, secondWallet);
        ledger.registerGroup(groupId, koperasiId, memberHash, 15_000_000, inviteHash);
        ledger.joinGroup(groupId, secondHash, inviteHash);
    }

    function _createLoan(bytes32 borrower, uint64 tenor, uint256 installment) internal returns (uint256 id) {
        vm.prank(relayer);
        id = ledger.createLoan(
            groupId,
            borrower,
            1_000_000,
            tenor,
            installment,
            80,
            AIFlag.HIJAU,
            keccak256("screening+consent"),
            block.timestamp + 30 days
        );
        ledger.approveLoan(id);
        vm.prank(relayer);
        ledger.disburseLoan(id);
    }

    function testEKYCGroupInviteAndSavings() public {
        assertTrue(ledger.groupMembers(groupId, memberHash));
        assertTrue(ledger.groupMembers(groupId, secondHash));
        vm.prank(relayer);
        ledger.recordSavings(memberHash, SavingsType.POKOK, 100_000, PaymentMethod.QRIS);
        assertEq(token.balanceOf(memberWallet), 100_000);
    }

    function testPositiveRepaymentsCloseLoan() public {
        uint256 id = _createLoan(memberHash, 2, 550_000);
        vm.startPrank(relayer);
        ledger.recordRepayment(id, 1, true);
        ledger.recordRepayment(id, 2, true);
        vm.stopPrank();
        (, LoanStatus status,, bool exists) = position.positions(id);
        assertTrue(exists);
        assertEq(uint256(status), uint256(LoanStatus.Lunas));
        assertEq(token.balanceOf(memberWallet), 1_100_000);
    }

    function testHardshipSocialFundAndThirdUseRejected() public {
        uint256 id = _createLoan(memberHash, 3, 400_000);
        vm.prank(relayer);
        ledger.fundSocialFund(groupId, 400_000);
        ledger.markHardship(memberHash, groupId);
        vm.prank(relayer);
        ledger.applySocialFund(id, 1);
        (,,,, uint256 balance,,,) = ledger.groups(groupId);
        assertEq(balance, 0);

        ledger.clearHardship(memberHash, groupId);
        ledger.markHardship(memberHash, groupId);
        ledger.clearHardship(memberHash, groupId);
        vm.expectRevert(TanggungRentengEscrow.HardshipLimitReached.selector);
        ledger.markHardship(memberHash, groupId);
    }

    function testInsufficientSocialFundFallsBackToRestructure() public {
        uint256 id = _createLoan(memberHash, 4, 300_000);
        ledger.markHardship(memberHash, groupId);
        vm.expectRevert(TanggungRentengEscrow.InsufficientSocialFund.selector);
        vm.prank(relayer);
        ledger.applySocialFund(id, 1);
        ledger.restructure(id, 1, 180_000, 6);
        (,,,, uint256 installment, uint256 remaining,,,,,,,,,) = ledger.loans(id);
        assertEq(installment, 180_000);
        assertEq(remaining, 6);
    }

    function testLateRentengBlocksAndRepaymentRestores() public {
        uint256 id = _createLoan(memberHash, 2, 550_000);
        vm.warp(block.timestamp + 40 days);
        vm.prank(relayer);
        ledger.activateRenteng(id, 1, 7 days);
        assertEq(ledger.memberTalanganOutstanding(memberHash), 550_000);
        (,,,, bool blocked,,) = ledger.members(memberHash);
        assertTrue(blocked);

        vm.expectRevert(TanggungRentengEscrow.MemberBlocked.selector);
        vm.prank(relayer);
        ledger.createLoan(
            groupId, memberHash, 500_000, 1, 550_000, 80, AIFlag.HIJAU, bytes32(uint256(1)), block.timestamp + 30 days
        );

        vm.prank(relayer);
        ledger.repayTalangan(id, 550_000);
        (,,,, blocked,,) = ledger.members(memberHash);
        assertFalse(blocked);
        (,,,,,, bool rentengActive,) = ledger.groups(groupId);
        assertFalse(rentengActive);
    }

    function testRepeatedDefaultSanctionAndAppeal() public {
        uint256 id = _createLoan(memberHash, 2, 550_000);
        ledger.applySanction(id, keccak256("MEDIATION"));
        (, LoanStatus status,,) = position.positions(id);
        assertEq(uint256(status), uint256(LoanStatus.Mangkir));

        vm.prank(memberWallet);
        ledger.fileAppeal(id, keccak256("private-appeal-reason"));
        ledger.resolveAppeal(id, true);
        (,,,, bool blocked,,) = ledger.members(memberHash);
        assertFalse(blocked);
    }

    function testOnlyMemberCanFileAppeal() public {
        uint256 id = _createLoan(memberHash, 1, 1_100_000);
        vm.expectRevert(TanggungRentengEscrow.InvalidState.selector);
        vm.prank(outsider);
        ledger.fileAppeal(id, keccak256("reason"));
    }

    function testRolesPauseAndSoulboundProtections() public {
        vm.expectRevert();
        vm.prank(outsider);
        ledger.recordSavings(memberHash, SavingsType.WAJIB, 50_000, PaymentMethod.CASH);

        ledger.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(relayer);
        ledger.recordSavings(memberHash, SavingsType.WAJIB, 50_000, PaymentMethod.CASH);
        ledger.unpause();

        vm.prank(relayer);
        ledger.recordSavings(memberHash, SavingsType.WAJIB, 50_000, PaymentMethod.CASH);
        vm.expectRevert(RRParticipationToken.NonTransferable.selector);
        vm.prank(memberWallet);
        token.transfer(outsider, 1);

        uint256 id = _createLoan(memberHash, 1, 1_100_000);
        vm.expectRevert(RRLoanPosition.NonTransferable.selector);
        vm.prank(memberWallet);
        position.safeTransferFrom(memberWallet, outsider, id, 1, "");
    }

    function testFuzzScheduleAndRepaymentCount(uint8 rawTenor) public {
        uint64 tenor = uint64(bound(rawTenor, 1, 24));
        uint256 id = _createLoan(memberHash, tenor, 100_000);
        for (uint256 period = 1; period <= tenor; ++period) {
            assertEq(ledger.installmentDueDate(id, period), block.timestamp + 30 days + ((period - 1) * 30 days));
            vm.prank(relayer);
            ledger.recordRepayment(id, period, period % 2 == 0);
        }
        (, LoanStatus status,,) = position.positions(id);
        assertEq(uint256(status), uint256(LoanStatus.Lunas));
        assertEq(token.balanceOf(memberWallet), uint256(tenor) * 100_000);
    }
}
