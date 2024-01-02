// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    uint256 public tokenIndex;

    constructor() ERC721("Test", "Test") {}

    function mint(address to) external {
        _mint(to, tokenIndex++);
    }
}
