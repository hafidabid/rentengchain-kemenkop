// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title RantaiRenteng Participation Token
/// @notice Non-transferable accounting units; this token is not money or a claim on money.
contract RRParticipationToken is ERC20, AccessControl, Pausable {
    bytes32 public constant LEDGER_ROLE = keccak256("LEDGER_ROLE");

    error NonTransferable();

    constructor(address admin) ERC20("RantaiRenteng Participation", "RRP") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address account, uint256 amount) external onlyRole(LEDGER_ROLE) whenNotPaused {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyRole(LEDGER_ROLE) whenNotPaused {
        _burn(account, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function transfer(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }
}
