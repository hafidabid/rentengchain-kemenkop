// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IRRTypes} from "./interfaces/IRRTypes.sol";

/// @title RantaiRenteng Loan Position
/// @notice Soulbound loan receipts and their canonical UI statuses.
contract RRLoanPosition is ERC1155, AccessControl, Pausable, IRRTypes {
    bytes32 public constant LEDGER_ROLE = keccak256("LEDGER_ROLE");

    struct Position {
        bytes32 memberHash;
        LoanStatus status;
        InstallmentStatus installmentStatus;
        bool exists;
    }

    mapping(uint256 => Position) public positions;
    error NonTransferable();
    error PositionExists();
    error UnknownPosition();

    constructor(address admin, string memory metadataUri) ERC1155(metadataUri) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function create(uint256 id, address account, bytes32 memberHash) external onlyRole(LEDGER_ROLE) whenNotPaused {
        if (positions[id].exists) revert PositionExists();
        positions[id] = Position(memberHash, LoanStatus.Diajukan, InstallmentStatus.UNPAID, true);
        _mint(account, id, 1, "");
    }

    function setStatus(uint256 id, LoanStatus status_) external onlyRole(LEDGER_ROLE) whenNotPaused {
        if (!positions[id].exists) revert UnknownPosition();
        positions[id].status = status_;
    }

    function setInstallmentStatus(uint256 id, InstallmentStatus status_) external onlyRole(LEDGER_ROLE) whenNotPaused {
        if (!positions[id].exists) revert UnknownPosition();
        positions[id].installmentStatus = status_;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public pure override {
        revert NonTransferable();
    }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
    {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert NonTransferable();
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
