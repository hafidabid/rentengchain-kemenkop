// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RRParticipationToken} from "../src/RRParticipationToken.sol";
import {RRLoanPosition} from "../src/RRLoanPosition.sol";
import {TanggungRentengEscrow} from "../src/TanggungRentengEscrow.sol";

contract Deploy is Script {
    function run()
        external
        returns (RRParticipationToken token, RRLoanPosition position, TanggungRentengEscrow ledger)
    {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        string memory metadataUri = vm.envOr("LOAN_METADATA_URI", string("ipfs://rantairenteng/{id}.json"));
        require(vm.addr(privateKey) == admin, "PRIVATE_KEY must belong to ADMIN_ADDRESS");

        vm.startBroadcast(privateKey);
        token = new RRParticipationToken(admin);
        position = new RRLoanPosition(admin, metadataUri);
        ledger = new TanggungRentengEscrow(admin, relayer, token, position);
        token.grantRole(token.LEDGER_ROLE(), address(ledger));
        position.grantRole(position.LEDGER_ROLE(), address(ledger));
        vm.stopBroadcast();

        console2.log("RRParticipationToken", address(token));
        console2.log("RRLoanPosition", address(position));
        console2.log("TanggungRentengEscrow", address(ledger));
        console2.log("Ledger roles granted atomically");
    }
}
