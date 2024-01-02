// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockPmon is ERC20 {
    constructor() ERC20("PMON", "PMON") {
        _mint(msg.sender, 1000 ** 18);
    }
}
